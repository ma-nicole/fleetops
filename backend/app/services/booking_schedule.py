"""Per-day pickup slot capacity (fleet-wide — one concurrent active booking per window)."""

from datetime import date

from sqlalchemy.orm import Session

from app.constants.booking_time_slots import (
    BOOKING_SLOT_TERMINAL_STATUSES,
    BOOKING_TIME_SLOTS,
)
from app.models.entities import Booking


def slot_available(db: Session, scheduled_date: date, time_slot: str) -> bool:
    blocking = db.query(Booking.id).filter(
        Booking.scheduled_date == scheduled_date,
        Booking.scheduled_time_slot == time_slot,
        ~Booking.status.in_(BOOKING_SLOT_TERMINAL_STATUSES),
    )
    return blocking.first() is None


def availability_for_date(db: Session, scheduled_date: date) -> dict[str, bool]:
    """Map each canonical slot → True when a new booking may take it."""
    return {slot: slot_available(db, scheduled_date, slot) for slot in BOOKING_TIME_SLOTS}
