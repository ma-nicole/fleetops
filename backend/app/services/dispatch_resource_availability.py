"""Dispatcher resource availability — schedule conflicts, status labels, and release on trip close."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.core.config import Settings, settings as app_settings
from app.models.entities import (
    Booking,
    BookingStatus,
    Trip,
    TripStatus,
    Truck,
    TruckAssignment,
    TruckAssignmentStatus,
    User,
    UserRole,
)

from app.services.booking_schedule import (
    booking_interval_resolved,
    intervals_overlap,
    trip_interval,
)

ResourceKind = Literal["truck", "driver", "helper"]
ResourceStatus = Literal["available", "assigned", "on_trip", "unavailable"]

_TERMINAL_TRIP: frozenset[TripStatus] = frozenset({TripStatus.COMPLETED, TripStatus.CANCELLED})
_ON_TRIP_STATUSES: frozenset[TripStatus] = frozenset(
    {TripStatus.DEPARTED, TripStatus.LOADING, TripStatus.IN_DELIVERY}
)
_NON_TERMINAL_ASSIGNMENT: frozenset[TruckAssignmentStatus] = frozenset(
    {
        TruckAssignmentStatus.ASSIGNED,
        TruckAssignmentStatus.FOR_PICKUP,
        TruckAssignmentStatus.PICKED_UP,
        TruckAssignmentStatus.EN_ROUTE,
        TruckAssignmentStatus.DROPPED_OFF,
        TruckAssignmentStatus.IN_PROGRESS,
    }
)
_OFF_DUTY_CREW_STATUSES = frozenset({"off_duty", "off-duty", "on_break", "break", "unavailable"})
_TERMINAL_BOOKING = frozenset({BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.EXPIRED})

_STATUS_LABELS: dict[ResourceStatus, str] = {
    "available": "Available",
    "assigned": "Assigned",
    "on_trip": "On Trip",
    "unavailable": "Unavailable",
}


def resource_status_label(status: ResourceStatus) -> str:
    return _STATUS_LABELS.get(status, status.replace("_", " ").title())


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _off_duty(status: str | None) -> bool:
    return _norm(status) in _OFF_DUTY_CREW_STATUSES


def _truck_operationally_unavailable(truck: Truck) -> bool:
    return _norm(truck.status) == "maintenance"


def _trip_status_value(trip: Trip) -> str:
    st = trip.status
    return st.value if hasattr(st, "value") else str(st)


def _assignment_status_value(ta: TruckAssignment) -> str:
    st = ta.assignment_status
    return st.value if hasattr(st, "value") else str(st)


def _active_trips(db: Session) -> list[tuple[Trip, Booking]]:
    rows = (
        db.query(Trip, Booking)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(~Trip.status.in_(_TERMINAL_TRIP), ~Booking.status.in_(_TERMINAL_BOOKING))
        .all()
    )
    return rows


def _active_assignments(db: Session) -> list[tuple[TruckAssignment, Booking]]:
    rows = (
        db.query(TruckAssignment, Booking)
        .join(Booking, Booking.id == TruckAssignment.booking_id)
        .filter(
            TruckAssignment.assignment_status.in_(_NON_TERMINAL_ASSIGNMENT),
            ~Booking.status.in_(_TERMINAL_BOOKING),
        )
        .all()
    )
    return rows


def _trip_on_resource(trip: Trip, kind: ResourceKind, resource_id: int) -> bool:
    if kind == "truck":
        return trip.truck_id == resource_id
    if kind == "driver":
        return trip.driver_id == resource_id
    return trip.helper_id == resource_id


def _assignment_on_resource(ta: TruckAssignment, kind: ResourceKind, resource_id: int) -> bool:
    if kind == "truck":
        return ta.truck_id == resource_id
    if kind == "driver":
        return ta.driver_id == resource_id
    return ta.helper_id == resource_id


def _global_resource_status(
    db: Session,
    *,
    kind: ResourceKind,
    resource_id: int,
    trip_rows: list[tuple[Trip, Booking]],
    assignment_rows: list[tuple[TruckAssignment, Booking]],
    truck: Truck | None = None,
    user: User | None = None,
) -> ResourceStatus:
    if kind == "truck" and truck is not None and _truck_operationally_unavailable(truck):
        return "unavailable"
    if kind in {"driver", "helper"} and user is not None and _off_duty(user.availability_status):
        return "unavailable"

    for trip, _ in trip_rows:
        if not _trip_on_resource(trip, kind, resource_id):
            continue
        if trip.status in _ON_TRIP_STATUSES:
            return "on_trip"
        return "assigned"

    for ta, _ in assignment_rows:
        if _assignment_on_resource(ta, kind, resource_id):
            return "assigned"

    if kind == "truck" and truck is not None and _norm(truck.availability_status) == "assigned":
        return "assigned"
    if user is not None and _norm(user.availability_status) == "assigned":
        return "assigned"

    return "available"


def _conflicts_for_resource(
    db: Session,
    *,
    kind: ResourceKind,
    resource_id: int,
    booking: Booking,
    cfg: Settings,
    exclude_booking_id: int | None = None,
) -> list[dict[str, Any]]:
    target_start, target_end = booking_interval_resolved(db, booking, cfg)
    conflicts: list[dict[str, Any]] = []
    now = datetime.utcnow()

    for trip, bk in _active_trips(db):
        if exclude_booking_id is not None and bk.id == exclude_booking_id:
            continue
        if not _trip_on_resource(trip, kind, resource_id):
            continue
        start, end = trip_interval(db, trip, cfg)
        # Live execution always blocks assignment, even if the planned window already ended (delays).
        live_busy = trip.status in _ON_TRIP_STATUSES
        if not live_busy and not intervals_overlap(target_start, target_end, start, end):
            continue
        window_end = end
        if live_busy and end < now:
            window_end = now
        conflicts.append(
            {
                "booking_id": bk.id,
                "trip_id": trip.id,
                "scheduled_date": str(bk.scheduled_date),
                "scheduled_time_slot": bk.scheduled_time_slot,
                "window_start": start.isoformat(),
                "window_end": window_end.isoformat(),
                "trip_status": _trip_status_value(trip),
                "source": "trip",
                "live_busy": live_busy,
            }
        )

    for ta, bk in _active_assignments(db):
        if exclude_booking_id is not None and bk.id == exclude_booking_id:
            continue
        if not _assignment_on_resource(ta, kind, resource_id):
            continue
        start, end = booking_interval_resolved(db, bk, cfg)
        if not intervals_overlap(target_start, target_end, start, end):
            continue
        if any(c["booking_id"] == bk.id and c.get("source") == "trip" for c in conflicts):
            continue
        conflicts.append(
            {
                "booking_id": bk.id,
                "assignment_id": ta.id,
                "scheduled_date": str(bk.scheduled_date),
                "scheduled_time_slot": bk.scheduled_time_slot,
                "window_start": start.isoformat(),
                "window_end": end.isoformat(),
                "assignment_status": _assignment_status_value(ta),
                "source": "assignment",
            }
        )

    return conflicts


def _resource_has_active_commitment(
    *,
    kind: ResourceKind,
    resource_id: int,
    trip_rows: list[tuple[Trip, Booking]],
    assignment_rows: list[tuple[TruckAssignment, Booking]],
    exclude_booking_id: int | None = None,
) -> bool:
    """True when the resource has any non-terminal trip or pending assignment (any schedule)."""
    for trip, bk in trip_rows:
        if exclude_booking_id is not None and bk.id == exclude_booking_id:
            continue
        if _trip_on_resource(trip, kind, resource_id):
            return True
    for ta, bk in assignment_rows:
        if exclude_booking_id is not None and bk.id == exclude_booking_id:
            continue
        if _assignment_on_resource(ta, kind, resource_id):
            return True
    return False


def _busy_conflict_reason(kind: ResourceKind, global_status: ResourceStatus) -> str:
    label = kind.replace("_", " ")
    if global_status == "on_trip":
        return f"{label.title()} is currently on an active trip."
    if global_status == "assigned":
        return f"{label.title()} already has a pending or active assignment."
    return f"{label.title()} is not available."


def _next_available_at(conflicts: list[dict[str, Any]]) -> str | None:
    if not conflicts:
        return None
    ends: list[datetime] = []
    for row in conflicts:
        raw = row.get("window_end")
        if not raw:
            continue
        try:
            ends.append(datetime.fromisoformat(str(raw)))
        except ValueError:
            continue
    if not ends:
        return None
    return max(ends).isoformat(timespec="minutes")


def _conflict_message(kind: ResourceKind, conflicts: list[dict[str, Any]]) -> str | None:
    if not conflicts:
        return None
    first = conflicts[0]
    label = {"truck": "Truck", "driver": "Driver", "helper": "Helper"}[kind]
    booking_id = first.get("booking_id")
    slot = first.get("scheduled_time_slot") or "—"
    date_s = first.get("scheduled_date") or "—"
    # Live in-progress trips block the resource even outside the planned window (delays).
    if first.get("live_busy") or (
        first.get("source") == "trip"
        and first.get("trip_status")
        in {
            TripStatus.DEPARTED.value,
            TripStatus.LOADING.value,
            TripStatus.IN_DELIVERY.value,
        }
    ):
        return (
            f"{label} is currently on an active trip for booking #{booking_id} "
            f"(scheduled {date_s} {slot}) and cannot be reassigned until that trip is completed."
        )
    return (
        f"{label} is already assigned to booking #{booking_id} "
        f"({date_s} {slot}) with an overlapping schedule."
    )


def _serialize_resource_row(
    *,
    kind: ResourceKind,
    resource_id: int,
    name: str,
    global_status: ResourceStatus,
    assignable: bool,
    conflict_reason: str | None,
    next_available_at: str | None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": resource_id,
        "name": name,
        "status": global_status,
        "status_label": resource_status_label(global_status),
        "assignable": assignable,
        "conflict_reason": conflict_reason,
        "next_available_at": next_available_at,
    }
    if extra:
        row.update(extra)
    return row


def evaluate_truck_for_booking(
    db: Session,
    truck: Truck,
    booking: Booking,
    *,
    cfg: Settings | None = None,
    trip_rows: list[tuple[Trip, Booking]] | None = None,
    assignment_rows: list[tuple[TruckAssignment, Booking]] | None = None,
    exclude_booking_id: int | None = None,
) -> dict[str, Any]:
    cfg = cfg or app_settings
    trip_rows = trip_rows if trip_rows is not None else _active_trips(db)
    assignment_rows = assignment_rows if assignment_rows is not None else _active_assignments(db)
    global_status = _global_resource_status(
        db,
        kind="truck",
        resource_id=truck.id,
        trip_rows=trip_rows,
        assignment_rows=assignment_rows,
        truck=truck,
    )
    conflicts = _conflicts_for_resource(
        db, kind="truck", resource_id=truck.id, booking=booking, cfg=cfg, exclude_booking_id=exclude_booking_id
    )
    conflict_reason = _conflict_message("truck", conflicts)
    if _truck_operationally_unavailable(truck):
        conflict_reason = "Truck is under maintenance and cannot be assigned."
    has_active = _resource_has_active_commitment(
        kind="truck",
        resource_id=truck.id,
        trip_rows=trip_rows,
        assignment_rows=assignment_rows,
        exclude_booking_id=exclude_booking_id,
    )
    if has_active and not conflict_reason:
        conflict_reason = _busy_conflict_reason("truck", global_status)
    assignable = (
        not conflicts
        and not has_active
        and not _truck_operationally_unavailable(truck)
        and _norm(truck.status) == "available"
    )
    return _serialize_resource_row(
        kind="truck",
        resource_id=truck.id,
        name=truck.code,
        global_status=global_status if not _truck_operationally_unavailable(truck) else "unavailable",
        assignable=assignable,
        conflict_reason=conflict_reason,
        next_available_at=_next_available_at(conflicts),
        extra={"code": truck.code, "capacity_tons": float(truck.capacity_tons or 0)},
    )


def evaluate_driver_for_booking(
    db: Session,
    user: User,
    booking: Booking,
    *,
    cfg: Settings | None = None,
    trip_rows: list[tuple[Trip, Booking]] | None = None,
    assignment_rows: list[tuple[TruckAssignment, Booking]] | None = None,
    exclude_booking_id: int | None = None,
) -> dict[str, Any]:
    cfg = cfg or app_settings
    trip_rows = trip_rows if trip_rows is not None else _active_trips(db)
    assignment_rows = assignment_rows if assignment_rows is not None else _active_assignments(db)
    global_status = _global_resource_status(
        db,
        kind="driver",
        resource_id=user.id,
        trip_rows=trip_rows,
        assignment_rows=assignment_rows,
        user=user,
    )
    conflicts = _conflicts_for_resource(
        db, kind="driver", resource_id=user.id, booking=booking, cfg=cfg, exclude_booking_id=exclude_booking_id
    )
    conflict_reason = _conflict_message("driver", conflicts)
    if _off_duty(user.availability_status):
        conflict_reason = "Driver is off duty or on break."
    has_active = _resource_has_active_commitment(
        kind="driver",
        resource_id=user.id,
        trip_rows=trip_rows,
        assignment_rows=assignment_rows,
        exclude_booking_id=exclude_booking_id,
    )
    if has_active and not conflict_reason:
        conflict_reason = _busy_conflict_reason("driver", global_status)
    assignable = not conflicts and not has_active and not _off_duty(user.availability_status)
    return _serialize_resource_row(
        kind="driver",
        resource_id=user.id,
        name=user.full_name,
        global_status=global_status if not _off_duty(user.availability_status) else "unavailable",
        assignable=assignable,
        conflict_reason=conflict_reason,
        next_available_at=_next_available_at(conflicts),
    )


def evaluate_helper_for_booking(
    db: Session,
    user: User,
    booking: Booking,
    *,
    cfg: Settings | None = None,
    trip_rows: list[tuple[Trip, Booking]] | None = None,
    assignment_rows: list[tuple[TruckAssignment, Booking]] | None = None,
    exclude_booking_id: int | None = None,
) -> dict[str, Any]:
    cfg = cfg or app_settings
    trip_rows = trip_rows if trip_rows is not None else _active_trips(db)
    assignment_rows = assignment_rows if assignment_rows is not None else _active_assignments(db)
    global_status = _global_resource_status(
        db,
        kind="helper",
        resource_id=user.id,
        trip_rows=trip_rows,
        assignment_rows=assignment_rows,
        user=user,
    )
    conflicts = _conflicts_for_resource(
        db, kind="helper", resource_id=user.id, booking=booking, cfg=cfg, exclude_booking_id=exclude_booking_id
    )
    conflict_reason = _conflict_message("helper", conflicts)
    if _off_duty(user.availability_status):
        conflict_reason = "Helper is off duty or on break."
    has_active = _resource_has_active_commitment(
        kind="helper",
        resource_id=user.id,
        trip_rows=trip_rows,
        assignment_rows=assignment_rows,
        exclude_booking_id=exclude_booking_id,
    )
    if has_active and not conflict_reason:
        conflict_reason = _busy_conflict_reason("helper", global_status)
    assignable = not conflicts and not has_active and not _off_duty(user.availability_status)
    return _serialize_resource_row(
        kind="helper",
        resource_id=user.id,
        name=user.full_name,
        global_status=global_status if not _off_duty(user.availability_status) else "unavailable",
        assignable=assignable,
        conflict_reason=conflict_reason,
        next_available_at=_next_available_at(conflicts),
    )


def build_booking_resource_availability(db: Session, booking: Booking) -> dict[str, Any]:
    """Full availability payload for dispatcher assignment UI."""
    cfg = app_settings
    trip_rows = _active_trips(db)
    assignment_rows = _active_assignments(db)

    trucks = (
        db.query(Truck)
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

    truck_roster = [
        evaluate_truck_for_booking(
            db,
            t,
            booking,
            cfg=cfg,
            trip_rows=trip_rows,
            assignment_rows=assignment_rows,
            exclude_booking_id=booking.id,
        )
        for t in trucks
    ]
    driver_roster = [
        evaluate_driver_for_booking(
            db,
            u,
            booking,
            cfg=cfg,
            trip_rows=trip_rows,
            assignment_rows=assignment_rows,
            exclude_booking_id=booking.id,
        )
        for u in drivers
    ]
    helper_roster = [
        evaluate_helper_for_booking(
            db,
            u,
            booking,
            cfg=cfg,
            trip_rows=trip_rows,
            assignment_rows=assignment_rows,
            exclude_booking_id=booking.id,
        )
        for u in helpers
    ]

    target_start, target_end = booking_interval_resolved(db, booking, cfg)

    return {
        "schedule_window_start": target_start.isoformat(timespec="minutes"),
        "schedule_window_end": target_end.isoformat(timespec="minutes"),
        "truck_roster": truck_roster,
        "driver_roster": driver_roster,
        "helper_roster": helper_roster,
        "trucks": [
            {k: v for k, v in row.items() if k in {"id", "code", "capacity_tons", "name", "status", "status_label"}}
            for row in truck_roster
            if row["assignable"]
        ],
        "drivers": [
            {k: v for k, v in row.items() if k in {"id", "name", "status", "status_label"}}
            for row in driver_roster
            if row["assignable"]
        ],
        "helpers": [
            {k: v for k, v in row.items() if k in {"id", "name", "status", "status_label"}}
            for row in helper_roster
            if row["assignable"]
        ],
    }


def validate_resource_assignment(
    db: Session,
    booking: Booking,
    *,
    truck_id: int | None = None,
    driver_id: int | None = None,
    helper_id: int | None = None,
) -> str | None:
    """Return a user-facing validation error, or None when all resources are assignable."""
    if truck_id:
        truck = db.query(Truck).filter(Truck.id == truck_id).first()
        if not truck:
            return "Selected truck was not found."
        row = evaluate_truck_for_booking(db, truck, booking, exclude_booking_id=booking.id)
        if not row["assignable"]:
            return row["conflict_reason"] or "Selected truck is not available for this schedule."

    if driver_id:
        driver = db.query(User).filter(User.id == driver_id, User.role == UserRole.DRIVER).first()
        if not driver:
            return "Selected driver was not found."
        row = evaluate_driver_for_booking(db, driver, booking, exclude_booking_id=booking.id)
        if not row["assignable"]:
            return row["conflict_reason"] or "Selected driver is not available for this schedule."

    if helper_id:
        helper = db.query(User).filter(User.id == helper_id, User.role == UserRole.HELPER).first()
        if not helper:
            return "Selected helper was not found."
        row = evaluate_helper_for_booking(db, helper, booking, exclude_booking_id=booking.id)
        if not row["assignable"]:
            return row["conflict_reason"] or "Selected helper is not available for this schedule."

    return None


def _other_active_commitment_exists(
    db: Session,
    *,
    kind: ResourceKind,
    resource_id: int,
    exclude_trip_id: int,
    exclude_booking_id: int | None = None,
) -> bool:
    for trip, _bk in _active_trips(db):
        if trip.id == exclude_trip_id:
            continue
        if _trip_on_resource(trip, kind, resource_id):
            return True
    for ta, bk in _active_assignments(db):
        # Ignore this booking's assignment row — the completing trip owns that commitment.
        if exclude_booking_id is not None and bk.id == exclude_booking_id:
            continue
        if _assignment_on_resource(ta, kind, resource_id):
            return True
    return False


def release_trip_resources(db: Session, trip: Trip) -> None:
    """Mark truck and crew available when a trip is completed or cancelled — only if no other active legs remain."""
    booking_id = trip.booking_id
    if trip.truck_id and not _other_active_commitment_exists(
        db,
        kind="truck",
        resource_id=trip.truck_id,
        exclude_trip_id=trip.id,
        exclude_booking_id=booking_id,
    ):
        truck = db.query(Truck).filter(Truck.id == trip.truck_id).first()
        if truck and _norm(truck.status) != "maintenance":
            truck.status = "available"
            truck.availability_status = "available"
    if trip.driver_id and not _other_active_commitment_exists(
        db,
        kind="driver",
        resource_id=trip.driver_id,
        exclude_trip_id=trip.id,
        exclude_booking_id=booking_id,
    ):
        driver = db.query(User).filter(User.id == trip.driver_id).first()
        if driver:
            driver.availability_status = "available"
    if trip.helper_id and not _other_active_commitment_exists(
        db,
        kind="helper",
        resource_id=trip.helper_id,
        exclude_trip_id=trip.id,
        exclude_booking_id=booking_id,
    ):
        helper = db.query(User).filter(User.id == trip.helper_id).first()
        if helper:
            helper.availability_status = "available"


def release_booking_trips(db: Session, booking_id: int) -> None:
    """Cancel active trips for a booking and release assigned resources."""
    trips = (
        db.query(Trip)
        .filter(Trip.booking_id == booking_id, ~Trip.status.in_(_TERMINAL_TRIP))
        .all()
    )
    for trip in trips:
        trip.status = TripStatus.CANCELLED
        release_trip_resources(db, trip)
    db.query(TruckAssignment).filter(
        TruckAssignment.booking_id == booking_id,
        TruckAssignment.assignment_status.in_(_NON_TERMINAL_ASSIGNMENT),
    ).update({"assignment_status": TruckAssignmentStatus.CANCELLED})


def mark_resources_assigned(db: Session, *, truck: Truck, driver: User, helper: User | None) -> None:
    truck.availability_status = "assigned"
    driver.availability_status = "assigned"
    if helper is not None:
        helper.availability_status = "assigned"
