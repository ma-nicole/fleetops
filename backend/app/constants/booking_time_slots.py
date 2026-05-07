"""Fixed daily pickup windows shared across FleetOpt customers (capacity = 1 active booking each)."""

from app.models.entities import BookingStatus

BOOKING_TIME_SLOTS: tuple[str, ...] = ("08:00", "11:30", "14:00", "17:30")

BOOKING_SLOT_TERMINAL_STATUSES: frozenset[BookingStatus] = frozenset(
    {
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
    }
)


def normalize_time_slot(value: str | None) -> str:
    t = (value or "").strip()
    return t


def is_allowed_time_slot(value: str | None) -> bool:
    return normalize_time_slot(value) in BOOKING_TIME_SLOTS
