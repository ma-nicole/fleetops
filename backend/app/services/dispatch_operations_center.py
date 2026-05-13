"""Real-time dispatcher operations payload — database-backed only (no mock analytics)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.constants.booking_time_slots import is_allowed_time_slot
from app.constants.fleet_capacity import trucks_required_for_cargo
from app.services.booking_schedule import booking_interval
from app.services.latest_location_display import latest_location_display_for_trip
from app.models.entities import (
    Booking,
    BookingStatus,
    Payment,
    PaymentStatus,
    Trip,
    TripIssue,
    TripLocationUpdate,
    TripStatus,
    Truck,
    TruckSlotHold,
    TruckSlotHoldStatus,
    User,
    UserRole,
    VehicleIssueReport,
    VehicleIssueReportStatus,
)

TERMINAL_TRIP: tuple[TripStatus, ...] = (TripStatus.COMPLETED, TripStatus.CANCELLED)

# In-flight execution (dispatcher board — excludes pending pre-assign and terminal states).
ACTIVE_EXECUTION: tuple[TripStatus, ...] = (
    TripStatus.ASSIGNED,
    TripStatus.ACCEPTED,
    TripStatus.DEPARTED,
    TripStatus.LOADING,
    TripStatus.IN_DELIVERY,
)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat()


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def _operational_bucket(trip: Trip) -> str:
    """Bucket for summary counts: assigned | for_pickup | picked_up | en_route | dropped_off."""
    st = trip.status
    hp = _norm(trip.helper_progress_status)
    if st == TripStatus.ASSIGNED:
        return "assigned"
    if hp == "dropped_off":
        return "dropped_off"
    if hp == "en_route" or st == TripStatus.IN_DELIVERY:
        return "en_route"
    if hp == "picked_up" or st == TripStatus.LOADING:
        return "picked_up"
    if hp == "for_pickup" or st in (TripStatus.ACCEPTED, TripStatus.DEPARTED):
        return "for_pickup"
    if st in ACTIVE_EXECUTION:
        return "for_pickup"
    return "assigned"


def _display_status(trip: Trip) -> str:
    hp = _norm(trip.helper_progress_status)
    if hp in ("for_pickup", "picked_up", "en_route", "dropped_off", "completed"):
        return hp
    if trip.status == TripStatus.ASSIGNED:
        return "assigned"
    if trip.status == TripStatus.ACCEPTED:
        return "for_pickup"
    if trip.status == TripStatus.LOADING:
        return "picked_up"
    if trip.status == TripStatus.IN_DELIVERY:
        return "en_route"
    if trip.status == TripStatus.DEPARTED:
        return "en_route"
    return trip.status.value


def _off_duty(avail: str | None) -> bool:
    return _norm(avail) in ("off_duty", "off duty", "offduty")


def _busy_resource_ids(db: Session) -> tuple[set[int], set[int], set[int]]:
    rows = (
        db.query(Trip.truck_id, Trip.driver_id, Trip.helper_id)
        .filter(Trip.status.in_(ACTIVE_EXECUTION))
        .all()
    )
    trucks_b: set[int] = set()
    drivers_b: set[int] = set()
    helpers_b: set[int] = set()
    for tid, did, hid in rows:
        if tid:
            trucks_b.add(tid)
        if did:
            drivers_b.add(did)
        if hid:
            helpers_b.add(hid)
    return trucks_b, drivers_b, helpers_b


def build_operations_center_payload(db: Session) -> dict[str, Any]:
    now = datetime.utcnow()
    today = now.date()

    pending_payment_verification = (
        db.query(func.count(Booking.id))
        .filter(Booking.status == BookingStatus.PAYMENT_VERIFICATION)
        .scalar()
        or 0
    )

    cancelled_bookings = (
        db.query(func.count(Booking.id)).filter(Booking.status == BookingStatus.CANCELLED).scalar() or 0
    )

    completed_today = (
        db.query(func.count(Trip.id))
        .filter(Trip.completed_at.isnot(None), func.date(Trip.completed_at) == today)
        .scalar()
        or 0
    )

    active_exec_trips = (
        db.query(Trip).filter(Trip.status.in_(ACTIVE_EXECUTION)).all()
    )
    bucket_counts = {"assigned": 0, "for_pickup": 0, "picked_up": 0, "en_route": 0, "dropped_off": 0}
    for t in active_exec_trips:
        b = _operational_bucket(t)
        if b in bucket_counts:
            bucket_counts[b] += 1

    # Waiting for assignment: paid/ready, zero active legs, still needs trucks.
    assignable_statuses = (
        BookingStatus.PAYMENT_VERIFIED,
        BookingStatus.READY_FOR_ASSIGNMENT,
    )
    wait_rows = (
        db.query(Booking)
        .filter(Booking.status.in_(assignable_statuses))
        .order_by(Booking.id.desc())
        .limit(200)
        .all()
    )
    batch_ids = [b.id for b in wait_rows]
    active_by: dict[int, int] = {}
    if batch_ids:
        tc_rows = (
            db.query(Trip.booking_id, func.count(Trip.id))
            .filter(Trip.booking_id.in_(batch_ids), ~Trip.status.in_(TERMINAL_TRIP))
            .group_by(Trip.booking_id)
            .all()
        )
        active_by = {bid: int(n) for bid, n in tc_rows}

    verified_at_by: dict[int, datetime] = {}
    if batch_ids:
        pay_rows = (
            db.query(Payment)
            .filter(Payment.booking_id.in_(batch_ids), Payment.status == PaymentStatus.VERIFIED)
            .order_by(Payment.id.desc())
            .all()
        )
        for p in pay_rows:
            if p.booking_id not in verified_at_by:
                verified_at_by[p.booking_id] = p.reviewed_at or p.paid_at or p.created_at

    waiting_for_assignment: list[dict[str, Any]] = []
    waiting_count = 0
    for bk in wait_rows:
        need = int(bk.required_truck_count or trucks_required_for_cargo(float(bk.cargo_weight_tons or 0)))
        active_legs = active_by.get(bk.id, 0)
        if active_legs == 0 and need > 0:
            waiting_count += 1
            pv = verified_at_by.get(bk.id)
            waiting_for_assignment.append(
                {
                    "booking_id": bk.id,
                    "cargo_weight_tons": float(bk.cargo_weight_tons or 0),
                    "required_trucks": need,
                    "pickup_location": (bk.pickup_location or "").strip() or "—",
                    "dropoff_location": (bk.dropoff_location or "").strip() or "—",
                    "scheduled_date": bk.scheduled_date.isoformat(),
                    "scheduled_time_slot": bk.scheduled_time_slot,
                    "payment_verified_at": _iso(pv),
                }
            )

    trucks_b, drivers_b, helpers_b = _busy_resource_ids(db)

    trucks_total = db.query(func.count(Truck.id)).scalar() or 0
    trucks_maintenance = (
        db.query(func.count(Truck.id)).filter(func.lower(Truck.status) == "maintenance").scalar() or 0
    )
    operational_trucks = (
        db.query(func.count(Truck.id)).filter(func.lower(Truck.status) == "available").scalar() or 0
    )
    busy_ops_trucks = (
        db.query(func.count(func.distinct(Trip.truck_id)))
        .join(Truck, Truck.id == Trip.truck_id)
        .filter(Trip.status.in_(ACTIVE_EXECUTION), func.lower(Truck.status) == "available")
        .scalar()
        or 0
    )
    available_trucks = max(0, operational_trucks - busy_ops_trucks)

    hold_rows = (
        db.query(func.coalesce(func.sum(TruckSlotHold.required_truck_count), 0))
        .filter(
            TruckSlotHold.hold_status.in_(
                [
                    TruckSlotHoldStatus.ON_HOLD,
                    TruckSlotHoldStatus.READY_FOR_ASSIGNMENT,
                ]
            )
        )
        .scalar()
    )
    trucks_on_hold = int(hold_rows or 0)

    trucks_assigned = len(trucks_b)

    drivers_all = db.query(User).filter(User.role == UserRole.DRIVER).all()
    helpers_all = db.query(User).filter(User.role == UserRole.HELPER).all()

    drivers_available = 0
    drivers_assigned = 0
    drivers_off_duty = 0
    for u in drivers_all:
        if _off_duty(u.availability_status):
            drivers_off_duty += 1
        elif u.id in drivers_b or _norm(u.availability_status) == "assigned":
            drivers_assigned += 1
        else:
            drivers_available += 1

    helpers_available = 0
    helpers_assigned = 0
    helpers_off_duty = 0
    for u in helpers_all:
        if _off_duty(u.availability_status):
            helpers_off_duty += 1
        elif u.id in helpers_b or _norm(u.availability_status) == "assigned":
            helpers_assigned += 1
        else:
            helpers_available += 1

    board_trips = (
        db.query(Trip)
        .options(
            joinedload(Trip.booking),
            joinedload(Trip.truck),
            joinedload(Trip.driver),
            joinedload(Trip.helper),
        )
        .filter(Trip.status.in_(ACTIVE_EXECUTION))
        .order_by(Trip.updated_at.desc())
        .limit(150)
        .all()
    )
    trip_ids = [t.id for t in board_trips]
    latest_loc: dict[int, tuple[str, datetime]] = {}
    if trip_ids:
        loc_rows = (
            db.query(TripLocationUpdate)
            .filter(TripLocationUpdate.trip_id.in_(trip_ids))
            .order_by(TripLocationUpdate.created_at.desc())
            .all()
        )
        for loc in loc_rows:
            if loc.trip_id not in latest_loc:
                latest_loc[loc.trip_id] = (loc.location_name or "—", loc.created_at)

    active_trips_board: list[dict[str, Any]] = []
    for tr in board_trips:
        bk = tr.booking
        loc_tuple = latest_loc.get(tr.id)
        raw_ping = (loc_tuple[0] if loc_tuple else None) or getattr(tr, "latest_location", None)
        if raw_ping == "—":
            raw_ping = None
        loc_name = latest_location_display_for_trip(tr, bk.dropoff_location, raw_ping)
        loc_at = loc_tuple[1] if loc_tuple else None
        last_upd = tr.updated_at
        if loc_at and (last_upd is None or loc_at > last_upd):
            last_upd = loc_at
        if last_upd is None:
            last_upd = datetime.utcnow()
        eta_iso = _iso(tr.estimated_delivery_time)
        overdue = bool(tr.estimated_delivery_time and tr.estimated_delivery_time < now)
        disp = _display_status(tr)
        badge_status = "delayed" if overdue else disp
        active_trips_board.append(
            {
                "trip_id": tr.id,
                "booking_id": tr.booking_id,
                "pickup": (bk.pickup_location or "").strip() or "—",
                "dropoff": (bk.dropoff_location or "").strip() or "—",
                "truck_code": tr.truck.code if tr.truck else "—",
                "driver_name": tr.driver.full_name if tr.driver else "—",
                "helper_name": tr.helper.full_name if tr.helper else "—",
                "current_status": disp,
                "badge_status": badge_status,
                "latest_location": loc_name,
                "scheduled_window": f"{bk.scheduled_date.isoformat()} · {bk.scheduled_time_slot or '—'}",
                "last_updated": _iso(last_upd),
                "eta": eta_iso,
            }
        )

    recent_updates: list[dict[str, Any]] = []
    loc_q = (
        db.query(TripLocationUpdate, User, Trip)
        .join(User, User.id == TripLocationUpdate.helper_id)
        .join(Trip, Trip.id == TripLocationUpdate.trip_id)
        .order_by(TripLocationUpdate.created_at.desc())
        .limit(30)
        .all()
    )
    for loc, helper, trip in loc_q:
        recent_updates.append(
            {
                "trip_id": trip.id,
                "helper_name": helper.full_name,
                "status": _display_status(trip),
                "location_text": (loc.location_name or "").strip() or "—",
                "updated_at": _iso(loc.created_at),
            }
        )

    alerts: list[dict[str, Any]] = []

    for tr in board_trips:
        if tr.estimated_delivery_time and tr.estimated_delivery_time < now:
            alerts.append(
                {
                    "severity": "high",
                    "code": "overdue_eta",
                    "message": f"Trip #{tr.id} (booking {tr.booking_id}) is past estimated delivery time.",
                    "trip_id": tr.id,
                    "booking_id": tr.booking_id,
                }
            )
        if _display_status(tr) == "en_route":
            _, loc_time = latest_loc.get(tr.id, ("", None))
            if loc_time is None or (now - loc_time) > timedelta(minutes=30):
                alerts.append(
                    {
                        "severity": "medium",
                        "code": "stale_location",
                        "message": f"Trip #{tr.id} is en route but has no location update in the last 30 minutes.",
                        "trip_id": tr.id,
                        "booking_id": tr.booking_id,
                    }
                )
        bk = tr.booking
        if bk is not None and is_allowed_time_slot(bk.scheduled_time_slot):
            _, win_end = booking_interval(bk)
            if win_end < now and _display_status(tr) in ("assigned", "for_pickup"):
                alerts.append(
                    {
                        "severity": "medium",
                        "code": "pickup_window_passed",
                        "message": f"Trip #{tr.id}: scheduled pickup window has ended but leg is still pre-pickup.",
                        "trip_id": tr.id,
                        "booking_id": tr.booking_id,
                    }
                )

    open_issues = (
        db.query(TripIssue)
        .filter(TripIssue.resolved.is_(False))
        .order_by(TripIssue.created_at.desc())
        .limit(50)
        .all()
    )
    for iss in open_issues:
        alerts.append(
            {
                "severity": iss.severity or "medium",
                "code": "trip_issue",
                "message": f"Trip #{iss.trip_id}: {iss.issue_type} — {iss.description[:120]}",
                "trip_id": iss.trip_id,
                "booking_id": None,
            }
        )

    open_vehicle_issues = (
        db.query(VehicleIssueReport)
        .filter(VehicleIssueReport.status == VehicleIssueReportStatus.SUBMITTED)
        .order_by(VehicleIssueReport.created_at.desc())
        .limit(50)
        .all()
    )
    for vir in open_vehicle_issues:
        sev = (vir.priority or "medium").lower()
        if sev not in ("low", "medium", "high", "critical"):
            sev = "medium"
        alerts.append(
            {
                "severity": sev,
                "code": "vehicle_issue",
                "message": f"Trip #{vir.trip_id}: vehicle — {vir.issue_type.replace('_', ' ')} — {vir.description[:100]}",
                "trip_id": vir.trip_id,
                "booking_id": vir.booking_id,
            }
        )

    seen_maint_truck: set[int] = set()
    for tid in trucks_b:
        truck = db.query(Truck).filter(Truck.id == tid).first()
        if truck and _norm(truck.status) == "maintenance" and truck.id not in seen_maint_truck:
            seen_maint_truck.add(truck.id)
            alerts.append(
                {
                    "severity": "high",
                    "code": "maintenance_active_trip",
                    "message": f"Truck {truck.code} is marked maintenance but has an active trip leg.",
                    "trip_id": None,
                    "booking_id": None,
                }
            )

    dup_drivers = (
        db.query(Trip.driver_id, func.count(Trip.id))
        .filter(Trip.status.in_(ACTIVE_EXECUTION), Trip.driver_id.isnot(None))
        .group_by(Trip.driver_id)
        .having(func.count(Trip.id) > 1)
        .all()
    )
    for did, cnt in dup_drivers:
        alerts.append(
            {
                "severity": "high",
                "code": "driver_double_booked",
                "message": f"Driver id {did} has {cnt} concurrent active trips (data conflict).",
                "trip_id": None,
                "booking_id": None,
            }
        )

    summary = {
        "pending_payment_verification": int(pending_payment_verification),
        "waiting_for_assignment": int(waiting_count),
        "assigned_trips": int(bucket_counts["assigned"]),
        "for_pickup": int(bucket_counts["for_pickup"]),
        "picked_up": int(bucket_counts["picked_up"]),
        "en_route": int(bucket_counts["en_route"]),
        "dropped_off": int(bucket_counts["dropped_off"]),
        "completed_today": int(completed_today),
        "cancelled_bookings": int(cancelled_bookings),
        "available_trucks": int(available_trucks),
        "trucks_under_maintenance": int(trucks_maintenance),
        "available_drivers": int(drivers_available),
        "available_helpers": int(helpers_available),
    }

    resources = {
        "trucks": {
            "available": int(available_trucks),
            "on_hold": int(trucks_on_hold),
            "assigned": int(trucks_assigned),
            "under_maintenance": int(trucks_maintenance),
            "total_registered": int(trucks_total),
        },
        "drivers": {
            "available": int(drivers_available),
            "assigned": int(drivers_assigned),
            "off_duty": int(drivers_off_duty),
            "total": int(len(drivers_all)),
        },
        "helpers": {
            "available": int(helpers_available),
            "assigned": int(helpers_assigned),
            "off_duty": int(helpers_off_duty),
            "total": int(len(helpers_all)),
        },
    }

    return {
        "generated_at": _iso(now),
        "summary": summary,
        "active_trips": active_trips_board,
        "waiting_for_assignment": waiting_for_assignment[:50],
        "resources": resources,
        "recent_location_updates": recent_updates,
        "alerts": alerts[:80],
    }
