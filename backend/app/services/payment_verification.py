"""Shared payment-verification logic for manual admin approval and Xendit webhooks."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.entities import Booking, BookingStatus, Payment, PaymentStatus, TruckSlotHold, TruckSlotHoldStatus
from app.services.notifications import send_email_notification


def mark_payment_and_booking_verified(
    db: Session,
    payment: Payment,
    booking: Booking | None,
    *,
    reviewer_id: int | None = None,
    notify_customer: bool = True,
) -> None:
    """Promote payment to verified and advance booking to payment_verified when applicable."""
    payment.status = PaymentStatus.VERIFIED
    payment.paid_at = payment.paid_at or datetime.utcnow()
    payment.reviewed_at = datetime.utcnow()
    if reviewer_id is not None:
        payment.reviewed_by_id = reviewer_id

    if booking and booking.status in {
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.PAYMENT_VERIFICATION,
        BookingStatus.PENDING_APPROVAL,
        BookingStatus.APPROVED,
        BookingStatus.PAYMENT_REJECTED,
        BookingStatus.EXPIRED,
    }:
        booking.status = BookingStatus.PAYMENT_VERIFIED
        if reviewer_id is not None:
            booking.approved_by_id = reviewer_id
        booking.approved_at = booking.approved_at or datetime.utcnow()
        db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
            {"hold_status": TruckSlotHoldStatus.READY_FOR_ASSIGNMENT}
        )
        from app.services.booking_qr import ensure_booking_qr_token

        ensure_booking_qr_token(booking)

    if notify_customer:
        from app.models.entities import User

        cust = db.query(User).filter(User.id == payment.customer_id).first()
        if cust and cust.email:
            send_email_notification(
                to_email=cust.email,
                subject=f"Payment verified for booking #{payment.booking_id}",
                html_body=(
                    f"<p>Your payment ({payment.reference}) was verified. "
                    f"Booking #{payment.booking_id} is cleared for processing.</p>"
                ),
            )
