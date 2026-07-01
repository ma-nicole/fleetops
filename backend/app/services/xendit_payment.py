"""Xendit GCash QR payment orchestration for booking payments."""

from __future__ import annotations

from datetime import datetime, timedelta
from secrets import token_hex

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Booking, BookingStatus, Payment, PaymentStatus, Transaction, User, UserRole
from app.services.payment_verification import mark_payment_and_booking_verified
from app.services.xendit_client import XenditError, create_dynamic_qr_code, get_qr_code_by_external_id, xendit_configured

XENDIT_STATUS_PENDING = "PENDING"
XENDIT_STATUS_PAID = "PAID"
XENDIT_STATUS_EXPIRED = "EXPIRED"
XENDIT_STATUS_FAILED = "FAILED"

QR_EXPIRY_HOURS = 24


def build_xendit_external_id(booking_id: int) -> str:
    return f"fleetops-booking-{booking_id}-{token_hex(6)}"


def xendit_webhook_url() -> str:
    base = (settings.xendit_webhook_base_url or settings.backend_public_url or "").rstrip("/")
    if not base:
        raise HTTPException(
            status_code=503,
            detail="Xendit webhook base URL is not configured. Set XENDIT_WEBHOOK_BASE_URL or BACKEND_PUBLIC_URL.",
        )
    lowered = base.lower()
    if "localhost" in lowered or "127.0.0.1" in lowered:
        raise HTTPException(
            status_code=503,
            detail=(
                "Xendit requires a public HTTPS callback URL (localhost is rejected). "
                "For local development, set XENDIT_WEBHOOK_BASE_URL to an ngrok or webhook.site HTTPS URL."
            ),
        )
    return f"{base}/api/payments/xendit/webhook"


def _assert_booking_payable(booking: Booking, user: User) -> None:
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking.status in (
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
        BookingStatus.COMPLETED,
    ):
        raise HTTPException(status_code=400, detail="Cannot pay for this booking.")


def _active_xendit_payment(db: Session, booking_id: int) -> Payment | None:
    return (
        db.query(Payment)
        .filter(
            Payment.booking_id == booking_id,
            Payment.xendit_external_id.isnot(None),
            Payment.xendit_status.in_([XENDIT_STATUS_PENDING, XENDIT_STATUS_PAID]),
        )
        .order_by(Payment.id.desc())
        .first()
    )


def create_xendit_gcash_session(db: Session, booking: Booking, user: User) -> Payment:
    if not xendit_configured():
        raise HTTPException(status_code=503, detail="Xendit payments are not configured on this server.")

    _assert_booking_payable(booking, user)
    amount = round(float(booking.estimated_cost or 0), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Booking has no payable amount.")

    existing_verified = (
        db.query(Payment)
        .filter(Payment.booking_id == booking.id, Payment.status == PaymentStatus.VERIFIED)
        .first()
    )
    if existing_verified:
        raise HTTPException(status_code=400, detail="Payment already verified for this booking.")

    active = _active_xendit_payment(db, booking.id)
    if active:
        if active.xendit_status == XENDIT_STATUS_PAID or active.status == PaymentStatus.VERIFIED:
            return active
        if active.xendit_status == XENDIT_STATUS_PENDING and active.xendit_qr_string:
            if active.xendit_expires_at and active.xendit_expires_at > datetime.utcnow():
                return active

    external_id = build_xendit_external_id(booking.id)
    callback_url = xendit_webhook_url()
    metadata = {"booking_id": booking.id, "customer_id": booking.customer_id}

    try:
        qr = create_dynamic_qr_code(
            external_id=external_id,
            amount=amount,
            callback_url=callback_url,
            metadata=metadata,
        )
    except XenditError as exc:
        code = getattr(exc, "error_code", None)
        if code == "CHANNEL_NOT_ACTIVATED":
            raise HTTPException(
                status_code=503,
                detail=(
                    "GCash QR is not activated on your Xendit account yet. "
                    "Activate QR Ph / GCash in the Xendit Dashboard, then try again."
                ),
            ) from exc
        raise HTTPException(status_code=502, detail=f"Unable to create Xendit payment: {exc}") from exc

    transaction = Transaction(
        booking_id=booking.id,
        customer_id=booking.customer_id,
        type="booking",
        amount=amount,
    )
    db.add(transaction)
    db.flush()

    payment = Payment(
        booking_id=booking.id,
        transaction_id=transaction.id,
        customer_id=booking.customer_id,
        method="gcash",
        amount=amount,
        status=PaymentStatus.FOR_VERIFICATION,
        reference=f"PAY-{token_hex(4).upper()}",
        xendit_qr_id=qr.get("id"),
        xendit_external_id=qr.get("external_id") or external_id,
        xendit_status=XENDIT_STATUS_PENDING,
        xendit_qr_string=qr.get("qr_string"),
        xendit_expires_at=datetime.utcnow() + timedelta(hours=QR_EXPIRY_HOURS),
    )
    db.add(payment)

    if booking.status == BookingStatus.PAYMENT_REJECTED:
        booking.status = BookingStatus.PAYMENT_VERIFICATION

    db.commit()
    db.refresh(payment)
    return payment


def sync_xendit_payment_status(db: Session, payment: Payment) -> Payment:
    """Poll Xendit for QR status and map expiry when the code is no longer active."""
    if not payment.xendit_external_id or payment.xendit_status != XENDIT_STATUS_PENDING:
        return payment

    if payment.xendit_expires_at and payment.xendit_expires_at <= datetime.utcnow():
        payment.xendit_status = XENDIT_STATUS_EXPIRED
        db.commit()
        db.refresh(payment)
        return payment

    try:
        qr = get_qr_code_by_external_id(payment.xendit_external_id)
    except XenditError:
        return payment

    qr_status = str(qr.get("status") or "").upper()
    if qr_status == "INACTIVE" and payment.status != PaymentStatus.VERIFIED:
        payment.xendit_status = XENDIT_STATUS_EXPIRED
        db.commit()
        db.refresh(payment)
    return payment


def handle_xendit_webhook(db: Session, payload: dict) -> Payment | None:
    event = str(payload.get("event") or "")
    if event != "qr.payment":
        return None

    status = str(payload.get("status") or "").upper()
    xendit_payment_id = payload.get("id")
    qr_code = payload.get("qr_code") or {}
    external_id = qr_code.get("external_id")

    if not external_id:
        return None

    payment = (
        db.query(Payment)
        .filter(Payment.xendit_external_id == external_id)
        .order_by(Payment.id.desc())
        .first()
    )
    if not payment:
        return None

    payment.xendit_payment_id = xendit_payment_id or payment.xendit_payment_id
    payment_detail = payload.get("payment_detail") or {}
    if payment_detail.get("source"):
        payment.method = str(payment_detail["source"]).lower()

    if status == "COMPLETED":
        payment.xendit_status = XENDIT_STATUS_PAID
        payment.xendit_paid_at = datetime.utcnow()
        booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
        mark_payment_and_booking_verified(db, payment, booking, reviewer_id=None, notify_customer=True)
        db.commit()
        db.refresh(payment)
        return payment

    payment.xendit_status = XENDIT_STATUS_FAILED
    db.commit()
    db.refresh(payment)
    return payment
