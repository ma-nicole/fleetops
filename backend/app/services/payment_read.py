"""Serialize Payment rows with display metadata for API responses."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Booking, Payment, User
from app.schemas.payment import PaymentRead
from app.services.payment_display import payment_display_metadata


def payment_read_response(db: Session, payment: Payment) -> PaymentRead:
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    base = PaymentRead.model_validate(payment)
    verified_by_name: str | None = None
    if payment.reviewed_by_id:
        reviewer = db.query(User).filter(User.id == payment.reviewed_by_id).first()
        if reviewer:
            verified_by_name = reviewer.full_name or reviewer.email
    meta = payment_display_metadata(payment, booking)
    meta["verified_by_name"] = verified_by_name
    return base.model_copy(update=meta)
