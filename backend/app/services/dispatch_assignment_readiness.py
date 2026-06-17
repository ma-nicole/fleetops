"""Dispatch assignment gates — one booking_id for payment, declaration, cargo, and trips."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Booking, Payment, PaymentStatus, Trip, TripStatus
from app.services.cargo_type_validation_queue import goods_declaration_is_approved

DISPATCH_NOT_READY_MESSAGE = "Selected booking is not fully verified for dispatch."

_TERMINAL_TRIP = frozenset({TripStatus.COMPLETED, TripStatus.CANCELLED})


class BookingNotReadyForDispatchError(ValueError):
    """Raised when trip creation must not proceed for this booking_id."""

    def __init__(self, booking_id: int, blockers: list[str]) -> None:
        self.booking_id = booking_id
        self.blockers = blockers
        super().__init__(dispatch_not_ready_detail(booking_id, blockers))


def dispatch_not_ready_detail(booking_id: int, blockers: list[str] | None = None) -> str:
    """User-facing detail for HTTP 400 when dispatch prerequisites fail."""
    if blockers:
        return f"{DISPATCH_NOT_READY_MESSAGE} (Booking #{booking_id}: {'; '.join(blockers)})"
    return f"{DISPATCH_NOT_READY_MESSAGE} (Booking #{booking_id})"


def _payment_verified(db: Session, booking: Booking) -> bool:
    row = (
        db.query(Payment)
        .filter(Payment.booking_id == booking.id, Payment.status == PaymentStatus.VERIFIED)
        .order_by(Payment.id.desc())
        .first()
    )
    return row is not None


def active_trip_ids_for_booking(db: Session, booking_id: int) -> list[int]:
    rows = (
        db.query(Trip.id)
        .filter(Trip.booking_id == booking_id, ~Trip.status.in_(_TERMINAL_TRIP))
        .order_by(Trip.id.asc())
        .all()
    )
    return [int(r[0]) for r in rows]


def dispatch_assignment_blockers(db: Session, booking: Booking) -> list[str]:
    """Human-readable reasons assignment must not proceed for this booking_id."""
    blockers: list[str] = []
    if not _payment_verified(db, booking):
        blockers.append("Payment is not verified")
    if not goods_declaration_is_approved(booking):
        blockers.append("Goods declaration is not approved")
    if not bool(booking.cargo_type_validated):
        blockers.append("Cargo type is not validated")
    return blockers


def dispatch_assignment_readiness(db: Session, booking: Booking) -> dict:
    blockers = dispatch_assignment_blockers(db, booking)
    trip_ids = active_trip_ids_for_booking(db, booking.id)
    return {
        "booking_id": booking.id,
        "ready": not blockers,
        "blockers": blockers,
        "payment_verified": _payment_verified(db, booking),
        "goods_declaration_approved": goods_declaration_is_approved(booking),
        "cargo_type_validated": bool(booking.cargo_type_validated),
        "active_trip_ids": trip_ids,
        "has_active_trips": bool(trip_ids),
        "dispatch_integrity_warning": bool(trip_ids) and bool(blockers),
    }


def assert_booking_ready_for_dispatch_assignment(db: Session, booking: Booking) -> None:
    blockers = dispatch_assignment_blockers(db, booking)
    if blockers:
        raise BookingNotReadyForDispatchError(booking.id, blockers)
