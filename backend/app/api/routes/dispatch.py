import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    Trip,
    TripStatus,
    Truck,
    User,
    UserRole,
)
from app.services.email_templates import EmailTemplate
from app.services.notifications import send_email_notification
from app.services.routing import optimize_route as legacy_optimize_route
from app.services.scheduler import find_available_driver, find_available_helper, find_available_truck


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
        truck = find_available_truck(db, booking.scheduled_date)
    if not driver:
        driver = find_available_driver(db, booking.scheduled_date)
    if not helper:
        helper = find_available_helper(db, booking.scheduled_date)

    if not truck or not driver:
        raise HTTPException(status_code=400, detail="No available truck/driver")

    if payload.route_path:
        route = {"path": payload.route_path, "score": payload.distance_km or 120, "weight": "cost"}
    else:
        route = legacy_optimize_route(booking.pickup_location, booking.dropoff_location, weight="cost")

    distance = payload.distance_km or route.get("score", 120)
    duration = payload.duration_hours or max(distance / 50.0, 1.0)

    trip = Trip(
        booking_id=booking.id,
        truck_id=truck.id,
        driver_id=driver.id,
        helper_id=helper.id if helper else None,
        dispatcher_id=user.id,
        route_path=json.dumps(route.get("path", [booking.pickup_location, booking.dropoff_location])),
        distance_km=float(distance),
        toll_cost=float(payload.toll_cost or 45),
        fuel_cost=float(payload.fuel_cost or 120),
        labor_cost=float(payload.labor_cost or 80),
        duration_hours=float(duration),
        predicted_total_cost=float(payload.predicted_total_cost or 0),
        status=TripStatus.ASSIGNED,
        assigned_at=datetime.utcnow(),
        estimated_delivery_time=datetime.utcnow() + timedelta(hours=duration + 2),
    )
    booking.status = BookingStatus.ASSIGNED

    db.add(trip)
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
