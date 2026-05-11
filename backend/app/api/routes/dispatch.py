import json
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, aliased, joinedload

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    DriverProfile,
    Trip,
    TripLocationUpdate,
    TruckAssignment,
    TruckAssignmentStatus,
    TruckSlotHold,
    TruckSlotHoldStatus,
    TripStatus,
    Truck,
    User,
    UserRole,
)
from app.services.email_templates import EmailTemplate
from app.services.notifications import send_email_notification
from app.services.booking_paid_amount import paid_verified_amount_by_booking_ids
from app.services.booking_status_aggregate import (
    aggregate_customer_display_from_trips,
    apply_aggregate_booking_status,
)
from app.services.routing import optimize_route as legacy_optimize_route
from app.services.scheduler import find_available_driver, find_available_helper, find_available_truck
from app.constants.fleet_capacity import FLEET_TRUCK_COUNT, trucks_required_for_cargo
from app.services.booking_road_distance import booking_pickup_dropoff_distance_km
from app.services.booking_schedule import (
    booking_interval,
    driver_free_for_booking,
    helper_free_for_booking,
    intervals_overlap,
    truck_free_for_booking,
)


router = APIRouter(prefix="/dispatch", tags=["dispatch"])

ACTIVE_TRIP_STATUSES = [
    TripStatus.PENDING,
    TripStatus.ASSIGNED,
    TripStatus.ACCEPTED,
    TripStatus.DEPARTED,
    TripStatus.LOADING,
    TripStatus.IN_DELIVERY,
]


@router.get("/dashboard")
def dispatcher_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Aggregate stats + recent trips for dispatcher / manager console."""
    today = datetime.utcnow().date()

    pending_orders = (
        db.query(func.count(Booking.id))
        .filter(
            Booking.status.in_([
                BookingStatus.PAYMENT_VERIFICATION,
                BookingStatus.PAYMENT_VERIFIED,
                BookingStatus.READY_FOR_ASSIGNMENT,
                BookingStatus.PENDING_APPROVAL,
                BookingStatus.APPROVED,
            ])
        )
        .scalar()
        or 0
    )

    active_trips = (
        db.query(func.count(Trip.id)).filter(Trip.status.in_(ACTIVE_TRIP_STATUSES)).scalar()
        or 0
    )

    trips_assigned_today = (
        db.query(func.count(Trip.id))
        .filter(
            Trip.assigned_at.isnot(None),
            func.date(Trip.assigned_at) == today,
        )
        .scalar()
        or 0
    )

    trips_completed_today = (
        db.query(func.count(Trip.id))
        .filter(
            Trip.completed_at.isnot(None),
            func.date(Trip.completed_at) == today,
        )
        .scalar()
        or 0
    )

    trucks_total = db.query(func.count(Truck.id)).scalar() or 0
    busy_truck_ids = (
        db.query(Trip.truck_id)
        .filter(Trip.status.in_(ACTIVE_TRIP_STATUSES))
        .distinct()
        .all()
    )
    busy_trucks_count = len({row[0] for row in busy_truck_ids if row[0] is not None})
    available_trucks = max(0, trucks_total - busy_trucks_count)

    drivers_total = (
        db.query(func.count(User.id)).filter(User.role == UserRole.DRIVER).scalar() or 0
    )
    busy_driver_rows = (
        db.query(Trip.driver_id)
        .filter(Trip.status.in_(ACTIVE_TRIP_STATUSES))
        .distinct()
        .all()
    )
    drivers_busy = len({row[0] for row in busy_driver_rows if row[0] is not None})
    drivers_idle = max(0, drivers_total - drivers_busy)

    driver_user = aliased(User)
    recent_rows = (
        db.query(Trip, Booking, driver_user)
        .outerjoin(Booking, Booking.id == Trip.booking_id)
        .outerjoin(driver_user, driver_user.id == Trip.driver_id)
        .order_by(Trip.id.desc())
        .limit(12)
        .all()
    )

    trips_out = []
    for tr, booking, driver in recent_rows:
        route = ""
        if booking:
            pickup = (booking.pickup_location or "").strip()
            drop = (booking.dropoff_location or "").strip()
            route = f"{pickup[:40]}{'…' if len(pickup) > 40 else ''} → {drop[:40]}{'…' if len(drop) > 40 else ''}"
            if route == " → ":
                route = "(No route)"
        trips_out.append(
            {
                "id": tr.id,
                "display_id": f"TRP-{tr.id}",
                "driver_name": driver.full_name if driver else "—",
                "route": route or "—",
                "status": tr.status.value,
                "start_time": tr.assigned_at.isoformat() if tr.assigned_at else None,
                "eta": tr.estimated_delivery_time.isoformat() if tr.estimated_delivery_time else None,
                "booking_id": tr.booking_id,
            }
        )

    return {
        "kpis": {
            "pending_orders": pending_orders,
            "active_trips": active_trips,
            "available_trucks": available_trucks,
            "trucks_total": trucks_total,
            "drivers_total": drivers_total,
            "drivers_busy": drivers_busy,
            "drivers_idle": drivers_idle,
            "trips_assigned_today": trips_assigned_today,
            "trips_completed_today": trips_completed_today,
            "today_volume": trips_assigned_today + trips_completed_today,
        },
        "recent_trips": trips_out,
    }


@router.get("/roster")
def dispatch_roster(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Trucks and crew available to the dispatcher (fleet sized at four tractors)."""
    trucks = (
        db.query(Truck)
        .filter(Truck.status == "available")
        .order_by(Truck.id)
        .limit(FLEET_TRUCK_COUNT)
        .all()
    )
    drivers = (
        db.query(User)
        .filter(User.role == UserRole.DRIVER)
        .order_by(User.id)
        .limit(FLEET_TRUCK_COUNT)
        .all()
    )
    helpers = db.query(User).filter(User.role == UserRole.HELPER).order_by(User.full_name).all()
    return {
        "trucks": [{"id": t.id, "code": t.code, "capacity_tons": float(t.capacity_tons or 0)} for t in trucks],
        "drivers": [{"id": u.id, "name": u.full_name} for u in drivers],
        "helpers": [{"id": u.id, "name": u.full_name} for u in helpers],
    }


@router.get("/fleet-assets")
def fleet_assets(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """All drivers and trucks for the Assets console — live assignment from active trips."""
    active_rows = (
        db.query(Trip, Truck, User)
        .join(Truck, Truck.id == Trip.truck_id)
        .join(User, User.id == Trip.driver_id)
        .filter(Trip.status.in_(ACTIVE_TRIP_STATUSES))
        .all()
    )
    truck_active_driver: dict[int, dict] = {}
    driver_active_truck: dict[int, str] = {}
    for trip, truck, driver_u in active_rows:
        truck_active_driver[truck.id] = {"id": driver_u.id, "name": driver_u.full_name}
        driver_active_truck[driver_u.id] = truck.code

    drivers_out: list[dict] = []
    driver_users = db.query(User).filter(User.role == UserRole.DRIVER).order_by(User.full_name).all()
    for u in driver_users:
        dp = db.query(DriverProfile).filter(DriverProfile.user_id == u.id).first()
        rating = float(dp.rating) if dp else 5.0
        completed = (
            db.query(func.count(Trip.id))
            .filter(Trip.driver_id == u.id, Trip.status == TripStatus.COMPLETED)
            .scalar()
            or 0
        )
        on_trip = u.id in driver_active_truck
        drivers_out.append(
            {
                "id": u.id,
                "name": u.full_name,
                "phone": u.phone or "",
                "rating": round(rating, 1),
                "completed_trips": int(completed),
                "status": "on_trip" if on_trip else "available",
                "assigned_truck_code": driver_active_truck.get(u.id),
            }
        )

    trucks_out: list[dict] = []
    for t in db.query(Truck).order_by(Truck.id).all():
        ad = truck_active_driver.get(t.id)
        st = (t.status or "available").lower()
        if ad is not None:
            disp_status = "in_use"
        elif st == "maintenance":
            disp_status = "maintenance"
        else:
            disp_status = "available"
        trucks_out.append(
            {
                "id": t.id,
                "plate": t.code,
                "model_name": t.model_name or "",
                "capacity_tons": float(t.capacity_tons or 0),
                "status": disp_status,
                "db_status": st,
                "odometer_km": float(t.odometer_km or 0),
                "age_years": float(t.age_years or 0),
                "assigned_driver_name": ad["name"] if ad else None,
                "assigned_driver_id": ad["id"] if ad else None,
            }
        )

    return {"drivers": drivers_out, "trucks": trucks_out}


@router.get("/assignments-board")
def assignments_board(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Trips already assigned — used for capacity and dispatcher oversight."""
    trips = (
        db.query(Trip)
        .options(
            joinedload(Trip.booking).joinedload(Booking.customer),
            joinedload(Trip.driver),
            joinedload(Trip.helper),
            joinedload(Trip.truck),
        )
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Trip.status != TripStatus.CANCELLED)
        .order_by(Booking.scheduled_date.desc(), Trip.id.desc())
        .limit(200)
        .all()
    )
    trips_by_booking: defaultdict[int, list[Trip]] = defaultdict(list)
    for tr in trips:
        trips_by_booking[tr.booking_id].append(tr)
    booking_display_status = {
        bid: aggregate_customer_display_from_trips(ts) for bid, ts in trips_by_booking.items()
    }

    leg_km_cache: dict[int, float | None] = {}
    booking_ids = [tr.booking_id for tr in trips]
    paid_map = paid_verified_amount_by_booking_ids(db, booking_ids)
    out = []
    for tr in trips:
        bk = tr.booking
        tk = tr.truck
        dr = tr.driver
        hp = tr.helper
        cust = bk.customer if bk else None
        latest_loc = (
            db.query(TripLocationUpdate.location_name, TripLocationUpdate.created_at)
            .filter(TripLocationUpdate.trip_id == tr.id)
            .order_by(TripLocationUpdate.created_at.desc())
            .first()
        )
        loc_name = (latest_loc[0] if latest_loc else None) or getattr(tr, "latest_location", None)
        helper_status = getattr(tr, "helper_progress_status", None)
        effective_booking_status = booking_display_status.get(
            bk.id, bk.status.value if hasattr(bk.status, "value") else str(bk.status)
        )
        if bk.id not in leg_km_cache:
            leg_km_cache[bk.id] = booking_pickup_dropoff_distance_km(bk)
        geo_leg_km = leg_km_cache[bk.id]
        display_distance_km = float(geo_leg_km) if geo_leg_km is not None else float(tr.distance_km or 0)
        out.append(
            {
                "trip_id": tr.id,
                "trip_status": tr.status.value if hasattr(tr.status, "value") else str(tr.status),
                "booking_id": bk.id,
                "customer_id": bk.customer_id,
                "customer_name": cust.full_name if cust else None,
                "customer_company_name": (cust.company_name or None) if cust else None,
                "pickup_location": bk.pickup_location,
                "dropoff_location": bk.dropoff_location,
                "scheduled_date": bk.scheduled_date.isoformat(),
                "scheduled_time_slot": bk.scheduled_time_slot,
                "cargo_weight_tons": bk.cargo_weight_tons,
                "estimated_cost": float(bk.estimated_cost or 0),
                "booking_status": effective_booking_status,
                "paid_amount_verified": paid_map.get(bk.id),
                "truck_id": tk.id if tk else None,
                "truck_code": tk.code if tk else "",
                "driver_id": dr.id if dr else None,
                "driver_name": dr.full_name if dr else None,
                "helper_id": hp.id if hp else None,
                "helper_name": hp.full_name if hp else None,
                "helper_progress_status": helper_status,
                "distance_km": display_distance_km,
                "latest_location": loc_name,
                "last_updated": latest_loc[1].isoformat() if latest_loc and latest_loc[1] else None,
            }
        )
    return {"assignments": out}


class ManualAssignment(BaseModel):
    truck_id: int | None = None
    driver_id: int | None = None
    helper_id: int | None = None
    route_path: list[str] | None = None
    distance_km: float | None = None
    duration_hours: float | None = None
    fuel_cost: float | None = None
    toll_cost: float | None = None
    labor_cost: float | None = None
    predicted_total_cost: float | None = None


class MultiAssignmentItem(BaseModel):
    truck_id: int = Field(..., gt=0)
    driver_id: int = Field(..., gt=0)
    helper_id: int = Field(..., gt=0)
    assigned_weight: float = Field(..., gt=0)


class MultiAssignPayload(BaseModel):
    assignments: list[MultiAssignmentItem]


def _compute_weight_splits(total_weight: float, required: int) -> list[float]:
    remaining = round(float(total_weight), 3)
    out: list[float] = []
    for i in range(required):
        if i < required - 1:
            chunk = min(42.0, remaining)
            out.append(round(chunk, 3))
            remaining = round(max(0.0, remaining - chunk), 3)
        else:
            out.append(round(remaining, 3))
    return out


def _active_overlap_assignment_rows(db: Session, booking: Booking):
    ns, ne = booking_interval(booking)
    rows = (
        db.query(TruckAssignment, Booking)
        .join(Booking, Booking.id == TruckAssignment.booking_id)
        .filter(
            Booking.scheduled_date == booking.scheduled_date,
            TruckAssignment.assignment_status.in_(
                [TruckAssignmentStatus.ASSIGNED, TruckAssignmentStatus.IN_PROGRESS]
            ),
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.REJECTED]),
        )
        .all()
    )
    out: list[tuple[TruckAssignment, Booking]] = []
    for ta, b in rows:
        if b.id == booking.id:
            continue
        s, e = booking_interval(b)
        if intervals_overlap(ns, ne, s, e):
            out.append((ta, b))
    return out


def _available_resources_for_booking(db: Session, booking: Booking) -> dict:
    overlaps = _active_overlap_assignment_rows(db, booking)
    blocked_trucks = {ta.truck_id for ta, _ in overlaps if ta.truck_id}
    blocked_drivers = {ta.driver_id for ta, _ in overlaps if ta.driver_id}
    blocked_helpers = {ta.helper_id for ta, _ in overlaps if ta.helper_id}
    ns, ne = booking_interval(booking)
    trip_rows = (
        db.query(Trip, Booking)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(
            Booking.scheduled_date == booking.scheduled_date,
            Trip.status.in_(ACTIVE_TRIP_STATUSES),
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.REJECTED]),
        )
        .all()
    )
    for tr, bk in trip_rows:
        if bk.id == booking.id:
            continue
        s, e = booking_interval(bk)
        if not intervals_overlap(ns, ne, s, e):
            continue
        if tr.truck_id:
            blocked_trucks.add(tr.truck_id)
        if tr.driver_id:
            blocked_drivers.add(tr.driver_id)
        if tr.helper_id:
            blocked_helpers.add(tr.helper_id)

    current_rows = (
        db.query(TruckAssignment)
        .filter(
            TruckAssignment.booking_id == booking.id,
            TruckAssignment.assignment_status.in_(
                [TruckAssignmentStatus.ASSIGNED, TruckAssignmentStatus.IN_PROGRESS]
            ),
        )
        .all()
    )
    for ta in current_rows:
        if ta.truck_id:
            blocked_trucks.add(ta.truck_id)
        if ta.driver_id:
            blocked_drivers.add(ta.driver_id)
        if ta.helper_id:
            blocked_helpers.add(ta.helper_id)

    trucks = (
        db.query(Truck)
        .filter(func.lower(func.coalesce(Truck.status, "available")) == "available")
        .order_by(Truck.id.asc())
        .all()
    )
    drivers = (
        db.query(User)
        .filter(User.role == UserRole.DRIVER)
        .order_by(User.full_name.asc(), User.id.asc())
        .all()
    )
    helpers = (
        db.query(User)
        .filter(User.role == UserRole.HELPER)
        .order_by(User.full_name.asc(), User.id.asc())
        .all()
    )

    return {
        "trucks": [
            {"id": t.id, "code": t.code, "capacity_tons": float(t.capacity_tons or 0)}
            for t in trucks
            if t.id not in blocked_trucks
        ],
        "drivers": [{"id": u.id, "name": u.full_name} for u in drivers if u.id not in blocked_drivers],
        "helpers": [{"id": u.id, "name": u.full_name} for u in helpers if u.id not in blocked_helpers],
    }


@router.get("/booking/{booking_id}/availability")
def booking_resource_availability(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    required = int(booking.required_truck_count or trucks_required_for_cargo(booking.cargo_weight_tons))
    return {
        "booking_id": booking.id,
        "required_truck_count": required,
        "cargo_weight_tons": float(booking.cargo_weight_tons),
        "weight_splits": _compute_weight_splits(float(booking.cargo_weight_tons), required),
        **_available_resources_for_booking(db, booking),
    }


@router.post("/{booking_id}/assign-batch")
def assign_batch(
    booking_id: int,
    payload: MultiAssignPayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in {
        BookingStatus.PAYMENT_VERIFIED,
        BookingStatus.READY_FOR_ASSIGNMENT,
        BookingStatus.ASSIGNED,
        BookingStatus.APPROVED,
    }:
        raise HTTPException(status_code=400, detail=f"Booking status {booking.status} is not ready for assignment.")

    required = int(booking.required_truck_count or trucks_required_for_cargo(booking.cargo_weight_tons))
    rows = payload.assignments or []
    if len(rows) != required:
        raise HTTPException(status_code=400, detail=f"Exactly {required} assignment rows are required.")

    t_ids = [r.truck_id for r in rows]
    d_ids = [r.driver_id for r in rows]
    h_ids = [r.helper_id for r in rows]
    if len(set(t_ids)) != len(t_ids) or len(set(d_ids)) != len(d_ids) or len(set(h_ids)) != len(h_ids):
        raise HTTPException(status_code=400, detail="Duplicate truck/driver/helper selections are not allowed.")
    total_assigned = round(sum(float(r.assigned_weight) for r in rows), 3)
    if abs(total_assigned - round(float(booking.cargo_weight_tons), 3)) > 0.01:
        raise HTTPException(status_code=400, detail="Assigned weights must total the booking cargo weight.")

    availability = _available_resources_for_booking(db, booking)
    available_trucks = {x["id"] for x in availability["trucks"]}
    available_drivers = {x["id"] for x in availability["drivers"]}
    available_helpers = {x["id"] for x in availability["helpers"]}
    if any(t not in available_trucks for t in t_ids) or any(d not in available_drivers for d in d_ids) or any(
        h not in available_helpers for h in h_ids
    ):
        raise HTTPException(
            status_code=409,
            detail="One or more selected trucks, drivers, or helpers are no longer available for this schedule.",
        )

    created_trip_ids: list[int] = []
    for item in rows:
        truck = db.query(Truck).filter(Truck.id == item.truck_id).with_for_update().first()
        driver = db.query(User).filter(User.id == item.driver_id, User.role == UserRole.DRIVER).with_for_update().first()
        helper = db.query(User).filter(User.id == item.helper_id, User.role == UserRole.HELPER).with_for_update().first()
        if not truck or not driver or not helper:
            raise HTTPException(
                status_code=409,
                detail="One or more selected trucks, drivers, or helpers are no longer available for this schedule.",
            )
        if not truck_free_for_booking(db, truck.id, booking):
            raise HTTPException(
                status_code=409,
                detail="One or more selected trucks, drivers, or helpers are no longer available for this schedule.",
            )
        if not driver_free_for_booking(db, driver.id, booking) or not helper_free_for_booking(db, helper.id, booking):
            raise HTTPException(
                status_code=409,
                detail="One or more selected trucks, drivers, or helpers are no longer available for this schedule.",
            )

    geo_km = booking_pickup_dropoff_distance_km(booking)
    route_fb = legacy_optimize_route(booking.pickup_location, booking.dropoff_location, weight="distance")
    distance = float(geo_km) if geo_km is not None else float(route_fb.get("score") or 120)
    if distance <= 0:
        distance = 120.0
    duration = max(distance / 50.0, 1.0)
    for item in rows:
        trip = Trip(
            booking_id=booking.id,
            truck_id=item.truck_id,
            driver_id=item.driver_id,
            helper_id=item.helper_id,
            dispatcher_id=user.id,
            route_path=json.dumps(route_fb.get("path", [booking.pickup_location, booking.dropoff_location])),
            distance_km=distance,
            toll_cost=45.0,
            fuel_cost=120.0,
            labor_cost=80.0,
            duration_hours=duration,
            predicted_total_cost=0.0,
            status=TripStatus.ASSIGNED,
            helper_progress_status="for_pickup",
            assigned_at=datetime.utcnow(),
            estimated_delivery_time=datetime.utcnow() + timedelta(hours=duration + 2),
        )
        ta = TruckAssignment(
            booking_id=booking.id,
            truck_id=item.truck_id,
            driver_id=item.driver_id,
            helper_id=item.helper_id,
            assigned_weight=float(item.assigned_weight),
            assignment_status=TruckAssignmentStatus.FOR_PICKUP,
        )
        truck.availability_status = "assigned"
        driver.availability_status = "assigned"
        helper.availability_status = "assigned"
        db.add(trip)
        db.add(ta)
        db.flush()
        created_trip_ids.append(trip.id)

    apply_aggregate_booking_status(db, booking)
    db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
        {"hold_status": TruckSlotHoldStatus.ASSIGNED}
    )
    db.commit()

    return {"booking_id": booking.id, "trip_ids": created_trip_ids, "assigned_count": len(created_trip_ids)}


@router.post("/{booking_id}/assign")
def assign_trip(
    booking_id: int,
    payload: ManualAssignment | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Assign truck/driver/helper to a booking.

    Manual mode: the dispatcher passes truck_id/driver_id/helper_id (and optionally
    a route + cost preview from `/api/analytics/optimize-route`).
    Automatic mode: when no payload is provided we fall back to scheduler heuristics.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in {
        BookingStatus.PAYMENT_VERIFIED,
        BookingStatus.READY_FOR_ASSIGNMENT,
        BookingStatus.ASSIGNED,
        BookingStatus.APPROVED,
    }:
        raise HTTPException(
            status_code=400,
            detail=f"Booking status {booking.status} is not ready for dispatcher assignment.",
        )

    need = trucks_required_for_cargo(booking.cargo_weight_tons)
    active = (
        db.query(Trip)
        .filter(
            Trip.booking_id == booking.id,
            ~Trip.status.in_({TripStatus.COMPLETED, TripStatus.CANCELLED}),
        )
        .count()
    )
    if active >= need:
        raise HTTPException(
            status_code=400,
            detail="This booking already has the required number of truck assignments.",
        )

    payload = payload or ManualAssignment()

    truck: Truck | None = None
    driver: User | None = None
    helper: User | None = None

    if payload.truck_id:
        truck = db.query(Truck).filter(Truck.id == payload.truck_id).first()
    if payload.driver_id:
        driver = db.query(User).filter(
            User.id == payload.driver_id, User.role == UserRole.DRIVER
        ).first()
    if payload.helper_id:
        helper = db.query(User).filter(
            User.id == payload.helper_id, User.role == UserRole.HELPER
        ).first()

    if not truck:
        truck = find_available_truck(db, booking.scheduled_date, booking)
    if not driver:
        driver = find_available_driver(db, booking.scheduled_date, booking)
    if not helper:
        helper = find_available_helper(db, booking.scheduled_date, booking)

    if not truck or not driver:
        raise HTTPException(status_code=400, detail="No available truck/driver for this window")

    if not truck_free_for_booking(db, truck.id, booking):
        raise HTTPException(status_code=400, detail="Selected truck is already booked for an overlapping run")
    if not driver_free_for_booking(db, driver.id, booking):
        raise HTTPException(status_code=400, detail="Selected driver is already booked for an overlapping run")
    if helper is not None and not helper_free_for_booking(db, helper.id, booking):
        raise HTTPException(status_code=400, detail="Selected helper is already booked for an overlapping run")

    geo_km = booking_pickup_dropoff_distance_km(booking)
    route_fb = legacy_optimize_route(booking.pickup_location, booking.dropoff_location, weight="distance")
    path_list = (
        list(payload.route_path)
        if payload.route_path
        else route_fb.get("path", [booking.pickup_location, booking.dropoff_location])
    )
    if payload.distance_km is not None and float(payload.distance_km) > 0:
        distance = float(payload.distance_km)
    elif geo_km is not None:
        distance = float(geo_km)
    else:
        distance = float(route_fb.get("score") or 120)
    if distance <= 0:
        distance = 120.0
    duration = payload.duration_hours or max(distance / 50.0, 1.0)

    trip = Trip(
        booking_id=booking.id,
        truck_id=truck.id,
        driver_id=driver.id,
        helper_id=helper.id if helper else None,
        dispatcher_id=user.id,
        route_path=json.dumps(path_list),
        distance_km=float(distance),
        toll_cost=float(payload.toll_cost or 45),
        fuel_cost=float(payload.fuel_cost or 120),
        labor_cost=float(payload.labor_cost or 80),
        duration_hours=float(duration),
        predicted_total_cost=float(payload.predicted_total_cost or 0),
        status=TripStatus.ASSIGNED,
        helper_progress_status="for_pickup",
        assigned_at=datetime.utcnow(),
        estimated_delivery_time=datetime.utcnow() + timedelta(hours=duration + 2),
    )
    per_truck_weight = float(booking.cargo_weight_tons or 0) / max(1, int(need))
    db.add(
        TruckAssignment(
            booking_id=booking.id,
            truck_id=truck.id,
            driver_id=driver.id,
            helper_id=helper.id if helper else None,
            assigned_weight=per_truck_weight,
            assignment_status=TruckAssignmentStatus.FOR_PICKUP,
        )
    )
    truck.availability_status = "assigned"
    driver.availability_status = "assigned"
    if helper:
        helper.availability_status = "assigned"
    next_hold_status = (
        TruckSlotHoldStatus.ASSIGNED if active + 1 >= need else TruckSlotHoldStatus.READY_FOR_ASSIGNMENT
    )
    db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
        {"hold_status": next_hold_status}
    )

    db.add(trip)
    db.flush()
    apply_aggregate_booking_status(db, booking)
    db.commit()
    db.refresh(trip)

    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer:
        subject, html_body = EmailTemplate.trip_assigned(
            trip_id=trip.id,
            driver_name=driver.full_name,
            truck_code=truck.code,
            pickup=booking.pickup_location,
            dropoff=booking.dropoff_location,
        )
        send_email_notification(to_email=customer.email, subject=subject, html_body=html_body)

    return {
        "trip_id": trip.id,
        "booking_id": booking.id,
        "truck_id": truck.id,
        "driver_id": driver.id,
        "helper_id": helper.id if helper else None,
        "route": route,
    }


@router.post("/trip/{trip_id}/status")
def update_trip_status(
    trip_id: int,
    status: BookingStatus,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.DRIVER, UserRole.ADMIN)),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = status
    db.commit()
    return {"booking_id": booking.id, "status": booking.status}
