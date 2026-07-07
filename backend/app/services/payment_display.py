"""Human-readable payment status labels for API and admin monitoring."""

from __future__ import annotations

from app.models.entities import Booking, BookingStatus, Payment, PaymentStatus

XENDIT_STATUS_PENDING = "PENDING"
XENDIT_STATUS_PAID = "PAID"
XENDIT_STATUS_EXPIRED = "EXPIRED"
XENDIT_STATUS_FAILED = "FAILED"


def is_xendit_payment(payment: Payment) -> bool:
    return bool((payment.xendit_external_id or "").strip())


def verification_mode(payment: Payment) -> str:
    if is_xendit_payment(payment):
        return "xendit_auto"
    if payment.method == "cash":
        return "cash_offline"
    return "manual"


def webhook_verified(payment: Payment) -> bool:
    return (
        payment.status == PaymentStatus.VERIFIED
        and payment.reviewed_by_id is None
        and is_xendit_payment(payment)
    )


def display_status(payment: Payment, booking: Booking | None = None) -> str:
    xendit = (payment.xendit_status or "").upper()

    if payment.status == PaymentStatus.VERIFIED:
        if booking and booking.status in {
            BookingStatus.PAYMENT_VERIFIED,
            BookingStatus.READY_FOR_ASSIGNMENT,
            BookingStatus.ASSIGNED,
            BookingStatus.ACCEPTED,
            BookingStatus.ENROUTE,
            BookingStatus.LOADING,
            BookingStatus.OUT_FOR_DELIVERY,
            BookingStatus.COMPLETED,
        }:
            return "Ready for Dispatch" if booking.status != BookingStatus.PAYMENT_VERIFIED else "Payment Verified"
        return "Payment Verified"

    if payment.status == PaymentStatus.REFUNDED:
        return "Refunded"

    if payment.status == PaymentStatus.REJECTED:
        if xendit == XENDIT_STATUS_EXPIRED or booking and booking.status == BookingStatus.EXPIRED:
            return "Payment Expired"
        if xendit in {"CANCELLED", "CANCELED"}:
            return "Payment Cancelled"
        if xendit == XENDIT_STATUS_FAILED:
            return "Payment Failed"
        return "Payment Rejected"

    if payment.status == PaymentStatus.FOR_VERIFICATION:
        if payment.method == "cash":
            return "Awaiting Cash Payment"
        if is_xendit_payment(payment):
            if xendit == XENDIT_STATUS_PENDING:
                return "Payment Processing"
            if xendit == XENDIT_STATUS_PAID:
                return "Payment Verified"
        if booking and booking.status == BookingStatus.PENDING_PAYMENT:
            return "Awaiting Payment"
        return "Awaiting Payment Verification"

    return str(payment.status.value).replace("_", " ").title()


def payment_display_metadata(payment: Payment, booking: Booking | None = None) -> dict[str, object]:
    return {
        "verification_mode": verification_mode(payment),
        "display_status": display_status(payment, booking),
        "webhook_verified": webhook_verified(payment),
        "webhook_status": (payment.xendit_status or "N/A").upper() if is_xendit_payment(payment) else None,
    }
