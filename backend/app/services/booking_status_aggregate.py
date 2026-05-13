"""Aggregate booking workflow status from all trips (multi-truck bookings)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Booking, BookingStatus, Trip, TripStatus, TruckSlotHold, TruckSlotHoldStatus

# Helper milestones (highest progress wins for in-flight aggregate).
_STEP_RANK: dict[str, int] = {
    "for_pickup": 1,
    "picked_up": 2,
    "en_route": 3,
    "dropped_off": 4,
    "completed": 5,
}


def normalized_trip_step(trip: Trip) -> str:
    """Single-trip lifecycle key: prefer helper milestone, else infer from Trip.status."""
    h = (trip.helper_progress_status or "").strip().lower()
    if h in _STEP_RANK or h == "cancelled":
        return h
    ts = trip.status.value if hasattr(trip.status, "value") else str(trip.status)
    if ts == TripStatus.COMPLETED.value:
        return "completed"
    if ts == TripStatus.CANCELLED.value:
        return "cancelled"
    if ts == TripStatus.LOADING.value:
        return "picked_up"
    if ts == TripStatus.IN_DELIVERY.value:
        return "en_route"
    if ts in (TripStatus.ACCEPTED.value, TripStatus.DEPARTED.value):
        return "for_pickup"
    if ts == TripStatus.ASSIGNED.value:
        return "assigned"
    if ts == TripStatus.PENDING.value:
        return "assigned"
    return "for_pickup"


def aggregate_booking_status_enum_from_trips(trips: list[Trip]) -> BookingStatus:
    """
    DB booking.status from ALL trips.
    Booking is COMPLETED only when every non-cancelled trip is completed.
    """
    if not trips:
        return BookingStatus.ASSIGNED

    steps = [normalized_trip_step(t) for t in trips]

    if all(s == "cancelled" for s in steps):
        return BookingStatus.CANCELLED

    non_cancelled = [s for s in steps if s != "cancelled"]
    if not non_cancelled:
        return BookingStatus.CANCELLED

    if all(s == "completed" for s in non_cancelled):
        return BookingStatus.COMPLETED

    incomplete = [s for s in non_cancelled if s != "completed"]
    any_completed = any(s == "completed" for s in non_cancelled)

    max_r = 0
    for s in incomplete:
        if s == "assigned":
            max_r = max(max_r, 0)
        else:
            max_r = max(max_r, _STEP_RANK.get(s, 1))

    if any_completed and incomplete and max_r <= 1:
        return BookingStatus.LOADING

    if max_r >= 4:
        return BookingStatus.OUT_FOR_DELIVERY
    if max_r == 3:
        return BookingStatus.OUT_FOR_DELIVERY
    if max_r == 2:
        return BookingStatus.LOADING
    if max_r == 1:
        return BookingStatus.ACCEPTED
    return BookingStatus.ASSIGNED


def aggregate_customer_display_status_from_steps(steps: list[str]) -> str:
    """
    Customer-facing snake_case status (aligns with CUSTOMER_ACTIVE_DISPLAY_STATUSES / labels).
    """
    if not steps:
        return "assigned"

    if all(s == "cancelled" for s in steps):
        return "cancelled"

    active = [s for s in steps if s != "cancelled"]
    if not active:
        return "cancelled"

    if all(s == "completed" for s in active):
        return "completed"

    incomplete = [s for s in active if s != "completed"]
    any_completed = any(s == "completed" for s in active)

    max_r = 0
    for s in incomplete:
        if s == "assigned":
            max_r = max(max_r, 0)
        else:
            max_r = max(max_r, _STEP_RANK.get(s, 1))

    # At least one truck finished but others still running — never show as plain "assigned".
    if any_completed and incomplete and max_r <= 1:
        return "picked_up"

    if max_r >= 4:
        return "dropped_off"
    if max_r == 3:
        return "out_for_delivery"
    if max_r == 2:
        return "picked_up"
    if max_r == 1:
        return "for_pickup"
    return "assigned"


def aggregate_customer_display_from_trips(trips: list[Trip]) -> str:
    """Customer display string from ORM trips (dispatch board, repairs)."""
    return aggregate_customer_display_status_from_steps([normalized_trip_step(t) for t in trips])


def aggregate_customer_display_from_assignment_rows(rows: list[dict]) -> str:
    """Build customer display status from tracking-details assignment dicts."""
    steps: list[str] = []
    for row in rows:
        h = (row.get("helper_progress_status") or "").strip().lower()
        ts = (row.get("trip_status") or "").strip().lower()
        if h in _STEP_RANK or h == "cancelled":
            steps.append(h)
        elif ts == "completed":
            steps.append("completed")
        elif ts == "cancelled":
            steps.append("cancelled")
        elif ts == "loading":
            steps.append("picked_up")
        elif ts == "in_delivery":
            steps.append("en_route")
        elif ts in ("accepted", "departed"):
            steps.append("for_pickup")
        elif ts == "assigned":
            steps.append("assigned")
        else:
            steps.append("assigned")
    return aggregate_customer_display_status_from_steps(steps)


def recalculate_booking_overall_status(db: Session, booking_id: int) -> BookingStatus:
    """Load all trips for booking_id and return aggregate BookingStatus (does not commit)."""
    trips = db.query(Trip).filter(Trip.booking_id == booking_id).order_by(Trip.id.asc()).all()
    return aggregate_booking_status_enum_from_trips(trips)


def apply_aggregate_booking_status(db: Session, booking: Booking) -> bool:
    """Set booking.status from all trips. Returns True if the value changed."""
    trips = db.query(Trip).filter(Trip.booking_id == booking.id).all()
    if not trips:
        return False

    cur_enum = booking.status if isinstance(booking.status, BookingStatus) else BookingStatus(booking.status)
    # Only skip aggregate while the booking is still in payment / approval intake (no live trips yet).
    if cur_enum in {
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.PAYMENT_VERIFICATION,
        BookingStatus.PAYMENT_REJECTED,
        BookingStatus.REJECTED,
        BookingStatus.EXPIRED,
        BookingStatus.CANCELLED,
    }:
        return False

    want = aggregate_booking_status_enum_from_trips(trips)
    cur = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    if cur == want.value:
        return False
    booking.status = want
    # Terminal booking: release capacity holds so slots are not tied to completed/cancelled legs.
    if want in (BookingStatus.COMPLETED, BookingStatus.CANCELLED):
        db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
            {"hold_status": TruckSlotHoldStatus.RELEASED}
        )
    return True
