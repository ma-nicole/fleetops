"""Serialize Payment rows with display metadata for API responses."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Booking, Payment
from app.schemas.payment import PaymentRead
from app.services.payment_display import payment_display_metadata


def payment_read_response(db: Session, payment: Payment) -> PaymentRead:
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    base = PaymentRead.model_validate(payment)
    return base.model_copy(update=payment_display_metadata(payment, booking))
