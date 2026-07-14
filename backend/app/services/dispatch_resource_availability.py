"""Dispatcher resource availability — live commitments, status labels, and release on trip close.

Single source of truth for Job Assignment cards, dropdowns, and assignment validation.
A truck/driver/helper is selectable only when Available (no active booking commitment).
"""

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

# Terminal trip statuses — resources released (Completed / Cancelled).
_TERMINAL_TRIP: frozenset[TripStatus] = frozenset({TripStatus.COMPLETED, TripStatus.CANCELLED})
_TERMINAL_TRIP_VALUES: frozenset[str] = frozenset(s.value for s in _TERMINAL_TRIP)

# Pre-execution — badge "Assigned" (still busy / not selectable).
_ASSIGNED_TRIP_STATUSES: frozenset[TripStatus] = frozenset(
    {TripStatus.PENDING, TripStatus.ASSIGNED}
)
_ASSIGNED_TRIP_VALUES: frozenset[str] = frozenset(s.value for s in _ASSIGNED_TRIP_STATUSES)

# In-progress lifecycle — badge "On Trip" (Accepted → delivery / proof pending).
_ON_TRIP_STATUSES: frozenset[TripStatus] = frozenset(
    {
        TripStatus.ACCEPTED,
        TripStatus.DEPARTED,
        TripStatus.LOADING,
        TripStatus.IN_DELIVERY,
    }
)
_ON_TRIP_VALUES: frozenset[str] = frozenset(s.value for s in _ON_TRIP_STATUSES)

# Assignment rows that still occupy the resource until Completed / Cancelled.
_BUSY_ASSIGNMENT: frozenset[TruckAssignmentStatus] = frozenset(
    {
        TruckAssignmentStatus.ASSIGNED,
        TruckAssignmentStatus.FOR_PICKUP,
        TruckAssignmentStatus.PICKED_UP,
        TruckAssignmentStatus.EN_ROUTE,
        TruckAssignmentStatus.IN_PROGRESS,
        TruckAssignmentStatus.DROPPED_OFF,
    }
)
_BUSY_ASSIGNMENT_VALUES: frozenset[str] = frozenset(s.value for s in _BUSY_ASSIGNMENT)
_ON_TRIP_ASSIGNMENT: frozenset[TruckAssignmentStatus] = frozenset(
    {
        TruckAssignmentStatus.FOR_PICKUP,
        TruckAssignmentStatus.PICKED_UP,
        TruckAssignmentStatus.EN_ROUTE,
        TruckAssignmentStatus.IN_PROGRESS,
        TruckAssignmentStatus.DROPPED_OFF,
    }
)
_ON_TRIP_ASSIGNMENT_VALUES: frozenset[str] = frozenset(s.value for s in _ON_TRIP_ASSIGNMENT)
_TERMINAL_ASSIGNMENT_VALUES: frozenset[str] = frozenset(
    {
        TruckAssignmentStatus.COMPLETED.value,
        TruckAssignmentStatus.CANCELLED.value,
    }
)

# Back-compat alias for tests / imports that still expect this name.
_NON_TERMINAL_ASSIGNMENT = _BUSY_ASSIGNMENT

_OFF_DUTY_CREW_STATUSES = frozenset({"off_duty", "off-duty", "on_break", "break", "unavailable"})

# Booking no longer occupies resources (Completed / Cancelled / Rejected / related).
_TERMINAL_BOOKING: frozenset[BookingStatus] = frozenset(
    {
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
        BookingStatus.EXPIRED,
        BookingStatus.PAYMENT_REJECTED,
    }
)
_TERMINAL_BOOKING_VALUES: frozenset[str] = frozenset(s.value for s in _TERMINAL_BOOKING)

_STATUS_LABELS: dict[ResourceStatus, str] = {
    "available": "Available",
    "assigned": "Assigned",
    "on_trip": "On Trip",
    "unavailable": "Unavailable",
}


def resource_status_label(status: ResourceStatus) -> str:
    return _STATUS_LABELS.get(status, status.replace("_", " ").title())


def _norm(value: str | None) -> str:
    return (value or "").strip().lower().replace("-", "_")


def _status_token(value: object | None) -> str:
    """Normalize Enum / string DB values for comparisons (defense against dialect quirks)."""
    if value is None:
        return ""
    if hasattr(value, "value"):
        return _norm(str(getattr(value, "value")))
    raw = _norm(str(value))
    # Tolerate "TripStatus.COMPLETED" / "BookingStatus.completed" style dumps.
    if "." in raw:
        raw = raw.rsplit(".", 1)[-1]
    return raw


def _off_duty(status: str | None) -> bool:
    return _norm(status) in _OFF_DUTY_CREW_STATUSES


def _truck_operationally_unavailable(truck: Truck) -> bool:
    return _norm(truck.status) in {"maintenance", "in_maintenance"}


def _is_terminal_trip_status(status: object | None) -> bool:
    return _status_token(status) in _TERMINAL_TRIP_VALUES


def _is_terminal_booking_status(status: object | None) -> bool:
    return _status_token(status) in _TERMINAL_BOOKING_VALUES


def _is_busy_assignment_status(status: object | None) -> bool:
    return _status_token(status) in _BUSY_ASSIGNMENT_VALUES


def _trip_status_value(trip: Trip) -> str:
    return _status_token(trip.status)


def _assignment_status_value(ta: TruckAssignment) -> str:
    return _status_token(ta.assignment_status)


def _trip_is_on_trip(status: object | None) -> bool:
    return _status_token(status) in _ON_TRIP_VALUES


def _trip_is_assigned_badge(status: object | None) -> bool:
    return _status_token(status) in _ASSIGNED_TRIP_VALUES


def _assignment_is_on_trip(status: object | None) -> bool:
    return _status_token(status) in _ON_TRIP_ASSIGNMENT_VALUES


def _ids_equal(left: int | None, right: int | None) -> bool:
    if left is None or right is None:
        return False
    try:
        return int(left) == int(right)
    except (TypeError, ValueError):
        return False


def _active_trips(db: Session) -> list[tuple[Trip, Booking]]:
    """Trips on non-terminal bookings only — Python post-filter ignores completed bookings/trips."""
    rows = (
        db.query(Trip, Booking)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(
            ~Trip.status.in_([s.value for s in _TERMINAL_TRIP]),
            ~Booking.status.in_([s.value for s in _TERMINAL_BOOKING]),
        )
        .all()
    )
    return [
        (trip, booking)
        for trip, booking in rows
        if not _is_terminal_trip_status(trip.status) and not _is_terminal_booking_status(booking.status)
    ]


def _active_assignments(db: Session) -> list[tuple[TruckAssignment, Booking]]:
    rows = (
        db.query(TruckAssignment, Booking)
        .join(Booking, Booking.id == TruckAssignment.booking_id)
        .filter(
            TruckAssignment.assignment_status.in_([s.value for s in _BUSY_ASSIGNMENT]),
            ~Booking.status.in_([s.value for s in _TERMINAL_BOOKING]),
        )
        .all()
    )
    return [
        (ta, booking)
        for ta, booking in rows
        if _is_busy_assignment_status(ta.assignment_status)
        and not _is_terminal_booking_status(booking.status)
    ]


def busy_resource_ids(db: Session) -> tuple[set[int], set[int], set[int]]:
    """Truck / driver / helper IDs with any active booking commitment (shared source of truth)."""
    trucks: set[int] = set()
    drivers: set[int] = set()
    helpers: set[int] = set()
    for trip, _ in _active_trips(db):
        if trip.truck_id:
            trucks.add(trip.truck_id)
        if trip.driver_id:
            drivers.add(trip.driver_id)
        if trip.helper_id:
            helpers.add(trip.helper_id)
    for ta, _ in _active_assignments(db):
        if ta.truck_id:
            trucks.add(ta.truck_id)
        if ta.driver_id:
            drivers.add(ta.driver_id)
        if ta.helper_id:
            helpers.add(ta.helper_id)
    return trucks, drivers, helpers


def _trip_on_resource(trip: Trip, kind: ResourceKind, resource_id: int) -> bool:
    if kind == "truck":
        return _ids_equal(trip.truck_id, resource_id)
    if kind == "driver":
        return _ids_equal(trip.driver_id, resource_id)
    return _ids_equal(trip.helper_id, resource_id)


def _assignment_on_resource(ta: TruckAssignment, kind: ResourceKind, resource_id: int) -> bool:
    if kind == "truck":
        return _ids_equal(ta.truck_id, resource_id)
    if kind == "driver":
        return _ids_equal(ta.driver_id, resource_id)
    return _ids_equal(ta.helper_id, resource_id)


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

    saw_assigned = False
    for trip, _ in trip_rows:
        if not _trip_on_resource(trip, kind, resource_id):
            continue
        if _trip_is_on_trip(trip.status):
            return "on_trip"
        if _trip_is_assigned_badge(trip.status):
            saw_assigned = True
        else:
            # Any other non-terminal trip status still occupies the resource.
            saw_assigned = True

    for ta, _ in assignment_rows:
        if not _assignment_on_resource(ta, kind, resource_id):
            continue
        if _assignment_is_on_trip(ta.assignment_status):
            return "on_trip"
        saw_assigned = True

    # Do not trust stale availability_status alone — status comes from live commitments only.
    if saw_assigned:
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
    """Any other active booking commitment blocks assignment (prevents double-booking).

    Calendar overlap is still recorded for messaging / next_available_at when windows overlap;
    live busy commitments conflict even when the target slot is on a different day.
    """
    target_start, target_end = booking_interval_resolved(db, booking, cfg)
    conflicts: list[dict[str, Any]] = []

    for trip, bk in _active_trips(db):
        if exclude_booking_id is not None and bk.id == exclude_booking_id:
            continue
        if not _trip_on_resource(trip, kind, resource_id):
            continue
        start, end = trip_interval(db, trip, cfg)
        overlaps = intervals_overlap(target_start, target_end, start, end)
        live_busy = True
        conflicts.append(
            {
                "booking_id": bk.id,
                "trip_id": trip.id,
                "scheduled_date": str(bk.scheduled_date),
                "scheduled_time_slot": bk.scheduled_time_slot,
                "window_start": start.isoformat(),
                "window_end": end.isoformat(),
                "trip_status": _trip_status_value(trip),
                "source": "trip",
                "live_busy": live_busy,
                "calendar_overlap": overlaps,
            }
        )

    for ta, bk in _active_assignments(db):
        if exclude_booking_id is not None and bk.id == exclude_booking_id:
            continue
        if not _assignment_on_resource(ta, kind, resource_id):
            continue
        start, end = booking_interval_resolved(db, bk, cfg)
        overlaps = intervals_overlap(target_start, target_end, start, end)
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
                "live_busy": True,
                "calendar_overlap": overlaps,
            }
        )

    return conflicts


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
    if first.get("live_busy") and not first.get("calendar_overlap"):
        return (
            f"{label} is already committed to active booking #{booking_id} "
            f"({date_s} {slot}) and cannot be assigned until that booking is completed or cancelled."
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


def _busy_blocks_assignment(status: ResourceStatus) -> bool:
    """Assigned and On Trip both mean the resource belongs to another active booking."""
    return status in {"assigned", "on_trip"}


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
    effective_status: ResourceStatus = (
        "unavailable" if _truck_operationally_unavailable(truck) else global_status
    )
    conflict_reason = _conflict_message("truck", conflicts)
    if _truck_operationally_unavailable(truck):
        conflict_reason = "Truck is under maintenance and cannot be assigned."
    elif effective_status == "on_trip":
        conflict_reason = conflict_reason or "Truck is currently on an active trip and cannot be assigned."
    elif effective_status == "assigned":
        conflict_reason = conflict_reason or "Truck is already assigned to another active booking."
    assignable = (
        not conflicts
        and not _truck_operationally_unavailable(truck)
        and _norm(truck.status) == "available"
        and not _busy_blocks_assignment(effective_status)
    )
    return _serialize_resource_row(
        kind="truck",
        resource_id=truck.id,
        name=truck.code,
        global_status=effective_status,
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
    effective_status: ResourceStatus = "unavailable" if _off_duty(user.availability_status) else global_status
    conflict_reason = _conflict_message("driver", conflicts)
    if _off_duty(user.availability_status):
        conflict_reason = "Driver is off duty or on break."
    elif effective_status == "on_trip":
        conflict_reason = conflict_reason or "Driver is currently on an active trip and cannot be assigned."
    elif effective_status == "assigned":
        conflict_reason = conflict_reason or "Driver is already assigned to another active booking."
    assignable = (
        not conflicts
        and not _off_duty(user.availability_status)
        and not _busy_blocks_assignment(effective_status)
    )
    return _serialize_resource_row(
        kind="driver",
        resource_id=user.id,
        name=user.full_name,
        global_status=effective_status,
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
    effective_status: ResourceStatus = "unavailable" if _off_duty(user.availability_status) else global_status
    conflict_reason = _conflict_message("helper", conflicts)
    if _off_duty(user.availability_status):
        conflict_reason = "Helper is off duty or on break."
    elif effective_status == "on_trip":
        conflict_reason = conflict_reason or "Helper is currently on an active trip and cannot be assigned."
    elif effective_status == "assigned":
        conflict_reason = conflict_reason or "Helper is already assigned to another active booking."
    assignable = (
        not conflicts
        and not _off_duty(user.availability_status)
        and not _busy_blocks_assignment(effective_status)
    )
    return _serialize_resource_row(
        kind="helper",
        resource_id=user.id,
        name=user.full_name,
        global_status=effective_status,
        assignable=assignable,
        conflict_reason=conflict_reason,
        next_available_at=_next_available_at(conflicts),
    )


def _resource_has_active_commitment(
    *,
    kind: ResourceKind,
    resource_id: int,
    trip_rows: list[tuple[Trip, Booking]],
    assignment_rows: list[tuple[TruckAssignment, Booking]],
) -> bool:
    for trip, _ in trip_rows:
        if _trip_on_resource(trip, kind, resource_id):
            return True
    for ta, _ in assignment_rows:
        if _assignment_on_resource(ta, kind, resource_id):
            return True
    return False


def heal_orphaned_trips_on_terminal_bookings(db: Session) -> int:
    """Close leftover non-terminal trips/assignments when the booking is already terminal.

    Root cause of mass 'On Trip' badges: trips left open after booking Completed/Cancelled/Rejected.
    """
    healed = 0
    candidates = (
        db.query(Trip, Booking)
        .join(Booking, Booking.id == Trip.booking_id)
        .all()
    )
    for trip, booking in candidates:
        booking_terminal = _is_terminal_booking_status(booking.status)
        helper_done = _status_token(getattr(trip, "helper_progress_status", None)) == "completed"
        trip_open = not _is_terminal_trip_status(trip.status)
        if not trip_open:
            continue
        if not (booking_terminal or helper_done):
            continue

        if booking_terminal and _status_token(booking.status) in {
            BookingStatus.CANCELLED.value,
            BookingStatus.REJECTED.value,
            BookingStatus.EXPIRED.value,
            BookingStatus.PAYMENT_REJECTED.value,
        }:
            trip.status = TripStatus.CANCELLED
            assign_status = TruckAssignmentStatus.CANCELLED
        else:
            trip.status = TripStatus.COMPLETED
            if trip.completed_at is None:
                trip.completed_at = datetime.utcnow()
            assign_status = TruckAssignmentStatus.COMPLETED

        db.query(TruckAssignment).filter(
            TruckAssignment.booking_id == trip.booking_id,
            ~TruckAssignment.assignment_status.in_(list(_TERMINAL_ASSIGNMENT_VALUES)),
        ).update({"assignment_status": assign_status}, synchronize_session=False)
        release_trip_resources(db, trip)
        healed += 1

    # Busy assignment rows on terminal bookings with no open trip still reserve crew/trucks.
    dangling = (
        db.query(TruckAssignment, Booking)
        .join(Booking, Booking.id == TruckAssignment.booking_id)
        .filter(~TruckAssignment.assignment_status.in_(list(_TERMINAL_ASSIGNMENT_VALUES)))
        .all()
    )
    for ta, booking in dangling:
        if not _is_terminal_booking_status(booking.status):
            continue
        ta.assignment_status = (
            TruckAssignmentStatus.CANCELLED
            if _status_token(booking.status)
            in {
                BookingStatus.CANCELLED.value,
                BookingStatus.REJECTED.value,
                BookingStatus.EXPIRED.value,
                BookingStatus.PAYMENT_REJECTED.value,
            }
            else TruckAssignmentStatus.COMPLETED
        )
        healed += 1

    return healed


def heal_stale_resource_availability(
    db: Session,
    *,
    trucks: list[Truck],
    drivers: list[User],
    helpers: list[User],
    trip_rows: list[tuple[Trip, Booking]] | None = None,
    assignment_rows: list[tuple[TruckAssignment, Booking]] | None = None,
) -> int:
    """Reset stuck assigned flags when no live trip/assignment remains. Returns rows healed."""
    trip_rows = trip_rows if trip_rows is not None else _active_trips(db)
    assignment_rows = assignment_rows if assignment_rows is not None else _active_assignments(db)
    healed = 0

    for truck in trucks:
        if _truck_operationally_unavailable(truck):
            continue
        busy = _resource_has_active_commitment(
            kind="truck",
            resource_id=truck.id,
            trip_rows=trip_rows,
            assignment_rows=assignment_rows,
        )
        if busy:
            continue
        if _norm(truck.availability_status) != "available" or _norm(truck.status) != "available":
            truck.availability_status = "available"
            if _norm(truck.status) != "maintenance":
                truck.status = "available"
            healed += 1

    for user in drivers:
        if _off_duty(user.availability_status):
            continue
        busy = _resource_has_active_commitment(
            kind="driver",
            resource_id=user.id,
            trip_rows=trip_rows,
            assignment_rows=assignment_rows,
        )
        if busy:
            continue
        if _norm(user.availability_status) != "available":
            user.availability_status = "available"
            healed += 1

    for user in helpers:
        if _off_duty(user.availability_status):
            continue
        busy = _resource_has_active_commitment(
            kind="helper",
            resource_id=user.id,
            trip_rows=trip_rows,
            assignment_rows=assignment_rows,
        )
        if busy:
            continue
        if _norm(user.availability_status) != "available":
            user.availability_status = "available"
            healed += 1

    return healed


def build_booking_resource_availability(db: Session, booking: Booking) -> dict[str, Any]:
    """Full availability payload for dispatcher assignment UI (cards + dropdowns share this)."""
    cfg = app_settings

    # Persist orphan/terminal heal so completed bookings stop reserving the fleet.
    healed = heal_orphaned_trips_on_terminal_bookings(db)
    if healed:
        db.flush()

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

    healed += heal_stale_resource_availability(
        db,
        trucks=trucks,
        drivers=drivers,
        helpers=helpers,
        trip_rows=trip_rows,
        assignment_rows=assignment_rows,
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
        # Filtered assignable lists — same evaluate_* rules as roster badges / dropdowns.
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
        "_healed_rows": healed,
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
        ~TruckAssignment.assignment_status.in_(
            {TruckAssignmentStatus.COMPLETED, TruckAssignmentStatus.CANCELLED}
        ),
    ).update({"assignment_status": TruckAssignmentStatus.CANCELLED}, synchronize_session=False)


def mark_resources_assigned(db: Session, *, truck: Truck, driver: User, helper: User | None) -> None:
    truck.availability_status = "assigned"
    driver.availability_status = "assigned"
    if helper is not None:
        helper.availability_status = "assigned"
