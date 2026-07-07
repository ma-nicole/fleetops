"""Xendit online payment orchestration for booking payments."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.constants.payment_methods import XENDIT_ONLINE_METHODS
from app.core.config import settings
from app.models.entities import (
    Booking,
    BookingStatus,
    Payment,
    PaymentStatus,
    Transaction,
    TruckSlotHold,
    TruckSlotHoldStatus,
    User,
    UserRole,
    XenditWebhookEvent,
)
from app.services.payment_verification import mark_payment_and_booking_verified
from app.services.xendit_client import (
    XenditError,
    create_dynamic_qr_code,
    create_invoice,
    get_invoice,
    get_qr_code_by_external_id,
    xendit_channels_for_method,
    xendit_configured,
)

logger = logging.getLogger(__name__)

XENDIT_STATUS_PENDING = "PENDING"
XENDIT_STATUS_PAID = "PAID"
XENDIT_STATUS_EXPIRED = "EXPIRED"
XENDIT_STATUS_FAILED = "FAILED"

XENDIT_SUCCESS_STATUSES = {"COMPLETED", "PAID", "SETTLED", "SUCCEEDED", "SUCCESS"}
XENDIT_EXPIRED_STATUSES = {"EXPIRED"}
XENDIT_FAILED_STATUSES = {"FAILED", "VOIDED", "CANCELLED", "CANCELED"}
XENDIT_CANCELLED_STATUSES = {"CANCELLED", "CANCELED"}

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


def _frontend_url(path: str) -> str | None:
    base = (settings.frontend_url or "").strip().rstrip("/")
    if not base:
        return None
    return f"{base}{path}"


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


def _create_hosted_invoice(
    booking: Booking,
    user: User,
    external_id: str,
    amount: float,
    *,
    payment_method: str,
) -> dict[str, Any] | None:
    try:
        return create_invoice(
            external_id=external_id,
            amount=amount,
            description=f"FleetOps booking #{booking.id}",
            payer_email=user.email,
            invoice_duration=QR_EXPIRY_HOURS * 60 * 60,
            success_redirect_url=_frontend_url(f"/modules/customer/payment?bookingId={booking.id}&payment=paid"),
            failure_redirect_url=_frontend_url(f"/booking/payment?bookingId={booking.id}&payment=failed"),
            metadata={"booking_id": booking.id, "customer_id": booking.customer_id, "method": payment_method},
            payment_methods=xendit_channels_for_method(payment_method),
        )
    except XenditError as exc:
        logger.warning("Xendit invoice creation failed for booking %s: %s", booking.id, exc)
        return None


def _xendit_channel_not_activated(exc: XenditError) -> bool:
    code = str(getattr(exc, "error_code", "") or "").upper()
    message = str(exc).lower()
    return code == "CHANNEL_NOT_ACTIVATED" or "not been activated" in message or "not activated" in message


def create_xendit_checkout_session(db: Session, booking: Booking, user: User, method: str = "gcash") -> Payment:
    """Create a Xendit hosted checkout session for gcash, card, or bank transfer."""
    if not xendit_configured():
        raise HTTPException(status_code=503, detail="Xendit payments are not configured on this server.")

    method_key = (method or "gcash").strip().lower()
    if method_key not in XENDIT_ONLINE_METHODS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported Xendit payment method. Use one of: {', '.join(sorted(XENDIT_ONLINE_METHODS))}.",
        )

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
        if (
            active.xendit_status == XENDIT_STATUS_PENDING
            and active.method == method_key
            and (active.xendit_qr_string or active.xendit_invoice_url)
        ):
            if active.xendit_expires_at and active.xendit_expires_at > datetime.utcnow():
                return active

    external_id = build_xendit_external_id(booking.id)
    metadata = {"booking_id": booking.id, "customer_id": booking.customer_id, "method": method_key}
    invoice = _create_hosted_invoice(booking, user, external_id, amount, payment_method=method_key) or {}

    qr: dict[str, Any] = {}
    if method_key == "gcash":
        try:
            callback_url = xendit_webhook_url()
            qr = create_dynamic_qr_code(
                external_id=external_id,
                amount=amount,
                callback_url=callback_url,
                metadata=metadata,
            )
        except HTTPException:
            if not invoice:
                raise
            logger.warning("Xendit QR creation skipped for booking %s because webhook URL is not public.", booking.id)
        except XenditError as exc:
            if _xendit_channel_not_activated(exc):
                if invoice:
                    logger.warning(
                        "Xendit QR channel is not activated; booking %s will use hosted invoice only.",
                        booking.id,
                    )
                else:
                    raise HTTPException(
                        status_code=503,
                        detail=(
                            "GCash QR is not activated on your Xendit account yet. "
                            "Activate QR Ph / GCash in the Xendit Dashboard, then try again."
                        ),
                    ) from exc
            elif invoice:
                logger.warning(
                    "Xendit QR creation failed for booking %s; hosted invoice is still available: %s",
                    booking.id,
                    exc,
                )
            else:
                raise HTTPException(status_code=502, detail=f"Unable to create Xendit payment: {exc}") from exc

    if not invoice.get("id") and not qr.get("id"):
        raise HTTPException(status_code=502, detail="Unable to create Xendit payment request.")

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
        method=method_key,
        amount=amount,
        status=PaymentStatus.FOR_VERIFICATION,
        reference=f"PAY-{token_hex(4).upper()}",
        xendit_qr_id=qr.get("id"),
        xendit_payment_id=None,
        xendit_invoice_id=invoice.get("id"),
        xendit_invoice_url=invoice.get("invoice_url"),
        xendit_external_id=qr.get("external_id") or invoice.get("external_id") or external_id,
        xendit_status=XENDIT_STATUS_PENDING,
        xendit_qr_string=qr.get("qr_string"),
        xendit_expires_at=datetime.utcnow() + timedelta(hours=QR_EXPIRY_HOURS),
    )
    db.add(payment)

    if booking.status in (BookingStatus.PAYMENT_REJECTED, BookingStatus.EXPIRED, BookingStatus.PENDING_PAYMENT):
        booking.status = BookingStatus.PAYMENT_VERIFICATION

    db.commit()
    db.refresh(payment)
    return payment


def create_xendit_gcash_session(db: Session, booking: Booking, user: User) -> Payment:
    """Backward-compatible alias for GCash checkout."""
    return create_xendit_checkout_session(db, booking, user, method="gcash")


def create_cash_payment_intent(db: Session, booking: Booking, user: User) -> Payment:
    """Record a cash payment intent — verified later by admin/accounting staff."""
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

    pending_cash = (
        db.query(Payment)
        .filter(
            Payment.booking_id == booking.id,
            Payment.method == "cash",
            Payment.status == PaymentStatus.FOR_VERIFICATION,
        )
        .order_by(Payment.id.desc())
        .first()
    )
    if pending_cash:
        return pending_cash

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
        method="cash",
        amount=amount,
        status=PaymentStatus.FOR_VERIFICATION,
        reference=f"CASH-{token_hex(4).upper()}",
    )
    db.add(payment)

    if booking.status in (BookingStatus.PAYMENT_REJECTED, BookingStatus.EXPIRED, BookingStatus.PENDING_PAYMENT):
        booking.status = BookingStatus.PAYMENT_VERIFICATION

    db.commit()
    db.refresh(payment)
    return payment


def _mark_xendit_payment_expired(db: Session, payment: Payment, *, commit: bool) -> Payment:
    if payment.status == PaymentStatus.VERIFIED:
        return payment

    payment.xendit_status = XENDIT_STATUS_EXPIRED
    payment.status = PaymentStatus.REJECTED
    payment.reviewed_at = payment.reviewed_at or datetime.utcnow()

    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    if booking and booking.status in {
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.PAYMENT_VERIFICATION,
        BookingStatus.PENDING_APPROVAL,
        BookingStatus.APPROVED,
        BookingStatus.PAYMENT_REJECTED,
        BookingStatus.EXPIRED,
    }:
        booking.status = BookingStatus.EXPIRED
        db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
            {"hold_status": TruckSlotHoldStatus.EXPIRED}
        )

    if commit:
        db.commit()
        db.refresh(payment)
    return payment


def sync_xendit_payment_status(db: Session, payment: Payment) -> Payment:
    """Poll Xendit when webhook delivery is delayed; never trust the browser alone."""
    if not payment.xendit_external_id:
        return payment
    if payment.status == PaymentStatus.VERIFIED:
        return payment

    if payment.xendit_expires_at and payment.xendit_expires_at <= datetime.utcnow():
        if payment.xendit_status == XENDIT_STATUS_PENDING:
            return _mark_xendit_payment_expired(db, payment, commit=True)
        return payment

    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()

    if payment.xendit_qr_id:
        try:
            qr = get_qr_code_by_external_id(payment.xendit_external_id)
        except XenditError:
            qr = {}
        qr_status = str(qr.get("status") or "").upper()
        if qr_status == "INACTIVE" and payment.status != PaymentStatus.VERIFIED:
            return _mark_xendit_payment_expired(db, payment, commit=True)
        if qr_status in XENDIT_SUCCESS_STATUSES or _qr_payload_indicates_paid(qr):
            return _apply_xendit_success(
                db,
                payment,
                booking,
                paid_at=datetime.utcnow(),
                source="poll_qr",
            )

    if payment.xendit_invoice_id and payment.xendit_status == XENDIT_STATUS_PENDING:
        try:
            invoice = get_invoice(payment.xendit_invoice_id)
        except XenditError:
            return payment
        invoice_status = str(invoice.get("status") or "").upper()
        if invoice_status in XENDIT_SUCCESS_STATUSES:
            return _apply_xendit_success(
                db,
                payment,
                booking,
                paid_at=_paid_at_from_payload(invoice),
                source="poll_invoice",
            )
        if invoice_status in XENDIT_EXPIRED_STATUSES:
            return _mark_xendit_payment_expired(db, payment, commit=True)
        if invoice_status in XENDIT_FAILED_STATUSES:
            _apply_xendit_failure(db, payment, booking, status=invoice_status, commit=True)
            return payment

    return payment


def _qr_payload_indicates_paid(qr: dict[str, Any]) -> bool:
    payments = qr.get("payments")
    if isinstance(payments, list):
        for item in payments:
            if not isinstance(item, dict):
                continue
            status = str(item.get("status") or "").upper()
            if status in XENDIT_SUCCESS_STATUSES:
                return True
    return False


def _webhook_amount(payload: dict[str, Any]) -> float | None:
    data = _payload_data(payload)
    for key in ("amount", "paid_amount", "capture_amount", "requested_amount"):
        raw = data.get(key) if key in data else payload.get(key)
        if raw is None:
            continue
        try:
            return round(float(raw), 2)
        except (TypeError, ValueError):
            continue
    return None


def _external_id_matches_booking(external_id: str | None, booking_id: int) -> bool:
    if not external_id:
        return True
    return external_id.startswith(f"fleetops-booking-{booking_id}-")


def _amount_matches_payment(payment: Payment, booking: Booking | None, webhook_amount: float | None) -> bool:
    expected = round(float(payment.amount or 0), 2)
    if webhook_amount is not None and abs(webhook_amount - expected) > 0.01:
        logger.error(
            "Xendit webhook amount mismatch payment_id=%s booking_id=%s expected=%.2f got=%.2f",
            payment.id,
            payment.booking_id,
            expected,
            webhook_amount,
        )
        return False
    if booking:
        booking_expected = round(float(booking.estimated_cost or 0), 2)
        if abs(expected - booking_expected) > 0.01:
            logger.error(
                "Stored payment amount mismatch booking_id=%s payment=%.2f booking=%.2f",
                booking.id,
                expected,
                booking_expected,
            )
            return False
    return True


def _apply_xendit_success(
    db: Session,
    payment: Payment,
    booking: Booking | None,
    *,
    paid_at: datetime,
    source: str,
) -> Payment:
    if payment.status == PaymentStatus.VERIFIED:
        return payment
    payment.xendit_status = XENDIT_STATUS_PAID
    payment.xendit_paid_at = payment.xendit_paid_at or paid_at
    payment.paid_at = payment.paid_at or payment.xendit_paid_at
    mark_payment_and_booking_verified(db, payment, booking, reviewer_id=None, notify_customer=True)
    db.commit()
    db.refresh(payment)
    logger.info(
        "Xendit payment verified via %s payment_id=%s booking_id=%s",
        source,
        payment.id,
        payment.booking_id,
    )
    return payment


def _apply_xendit_failure(
    db: Session,
    payment: Payment,
    booking: Booking | None,
    *,
    status: str,
    commit: bool,
) -> None:
    if payment.status == PaymentStatus.VERIFIED:
        return
    payment.xendit_status = XENDIT_STATUS_FAILED if status not in XENDIT_CANCELLED_STATUSES else status
    payment.status = PaymentStatus.REJECTED
    payment.reviewed_at = payment.reviewed_at or datetime.utcnow()
    if booking and booking.status in {
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.PAYMENT_VERIFICATION,
        BookingStatus.PENDING_APPROVAL,
        BookingStatus.APPROVED,
        BookingStatus.PAYMENT_REJECTED,
    }:
        booking.status = BookingStatus.PAYMENT_REJECTED
        db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
            {"hold_status": TruckSlotHoldStatus.RELEASED}
        )
    if commit:
        db.commit()
        db.refresh(payment)


def _payload_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def _webhook_identity(payload: dict[str, Any]) -> dict[str, str | None]:
    data = _payload_data(payload)
    event_type = str(payload.get("event") or payload.get("event_type") or payload.get("type") or data.get("event") or "")
    status = str(data.get("status") or payload.get("status") or "").upper() or None
    qr_code = data.get("qr_code") if isinstance(data.get("qr_code"), dict) else payload.get("qr_code")
    qr_code = qr_code if isinstance(qr_code, dict) else {}

    external_id = (
        qr_code.get("external_id")
        or data.get("external_id")
        or payload.get("external_id")
        or data.get("reference_id")
        or payload.get("reference_id")
    )
    invoice_id = data.get("invoice_id") or payload.get("invoice_id")
    if not invoice_id and (data.get("invoice_url") or event_type.lower().startswith("invoice")):
        invoice_id = data.get("id") or payload.get("id")

    payment_id = (
        data.get("payment_id")
        or payload.get("payment_id")
        or data.get("transaction_id")
        or payload.get("transaction_id")
    )
    if not payment_id and event_type == "qr.payment":
        payment_id = data.get("id") or payload.get("id")

    raw_event_id = payload.get("event_id") or payload.get("webhook_id")
    if raw_event_id:
        event_id = str(raw_event_id)
    else:
        stable_id = payment_id or invoice_id or external_id or payload.get("id") or "unknown"
        event_id = f"{event_type or 'xendit'}:{stable_id}:{status or 'UNKNOWN'}"

    return {
        "event_id": str(event_id),
        "event_type": event_type or None,
        "status": status,
        "external_id": str(external_id) if external_id else None,
        "invoice_id": str(invoice_id) if invoice_id else None,
        "payment_id": str(payment_id) if payment_id else None,
    }


def _record_webhook_event(
    db: Session,
    payload: dict[str, Any],
    identity: dict[str, str | None],
) -> tuple[XenditWebhookEvent, bool]:
    existing = db.query(XenditWebhookEvent).filter(XenditWebhookEvent.event_id == identity["event_id"]).first()
    if existing:
        return existing, existing.processed_at is not None

    row = XenditWebhookEvent(
        event_id=identity["event_id"] or f"xendit:{token_hex(8)}",
        event_type=identity["event_type"],
        status=identity["status"],
        external_id=identity["external_id"],
        payload_json=json.dumps(payload, default=str),
    )
    db.add(row)
    db.flush()
    return row, False


def _find_payment_for_webhook(db: Session, identity: dict[str, str | None]) -> Payment | None:
    if identity["external_id"]:
        payment = (
            db.query(Payment)
            .filter(Payment.xendit_external_id == identity["external_id"])
            .order_by(Payment.id.desc())
            .first()
        )
        if payment:
            return payment

    if identity["invoice_id"]:
        payment = (
            db.query(Payment)
            .filter(Payment.xendit_invoice_id == identity["invoice_id"])
            .order_by(Payment.id.desc())
            .first()
        )
        if payment:
            return payment

    if identity["payment_id"]:
        return (
            db.query(Payment)
            .filter(Payment.xendit_payment_id == identity["payment_id"])
            .order_by(Payment.id.desc())
            .first()
        )
    return None


def _payment_method_from_payload(payload: dict[str, Any]) -> str | None:
    data = _payload_data(payload)
    payment_detail = data.get("payment_detail") if isinstance(data.get("payment_detail"), dict) else {}
    source = (
        payment_detail.get("source")
        or data.get("payment_channel")
        or payload.get("payment_channel")
        or data.get("channel_code")
        or payload.get("channel_code")
        or data.get("payment_method")
        or payload.get("payment_method")
        or data.get("payment_method_type")
        or payload.get("payment_method_type")
    )
    return str(source).lower() if source else None


def _paid_at_from_payload(payload: dict[str, Any]) -> datetime:
    data = _payload_data(payload)
    raw = data.get("paid_at") or payload.get("paid_at") or data.get("updated") or payload.get("updated")
    if not raw:
        return datetime.utcnow()
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return datetime.utcnow()
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def handle_xendit_webhook(db: Session, payload: dict) -> Payment | None:
    if not isinstance(payload, dict):
        return None

    identity = _webhook_identity(payload)
    event_log, already_processed = _record_webhook_event(db, payload, identity)
    if already_processed:
        return db.query(Payment).filter(Payment.id == event_log.payment_id).first() if event_log.payment_id else None

    payment = _find_payment_for_webhook(db, identity)
    if not payment:
        event_log.processed_at = datetime.utcnow()
        db.commit()
        return None

    event_log.payment_id = payment.id
    if identity["payment_id"]:
        payment.xendit_payment_id = identity["payment_id"]
    if identity["invoice_id"]:
        payment.xendit_invoice_id = identity["invoice_id"]

    method = _payment_method_from_payload(payload)
    if method:
        payment.method = method

    status = (identity["status"] or "").upper()
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    webhook_amount = _webhook_amount(payload)

    if not _external_id_matches_booking(identity["external_id"], payment.booking_id):
        logger.error(
            "Xendit webhook booking reference mismatch payment_id=%s external_id=%s",
            payment.id,
            identity["external_id"],
        )
        event_log.status = "BOOKING_REFERENCE_MISMATCH"
        event_log.processed_at = datetime.utcnow()
        db.commit()
        return payment

    if status in XENDIT_SUCCESS_STATUSES:
        if not _amount_matches_payment(payment, booking, webhook_amount):
            event_log.status = "AMOUNT_MISMATCH"
            event_log.processed_at = datetime.utcnow()
            db.commit()
            return payment

        paid_at = _paid_at_from_payload(payload)
        payment.xendit_status = XENDIT_STATUS_PAID
        payment.xendit_paid_at = payment.xendit_paid_at or paid_at
        payment.paid_at = payment.paid_at or payment.xendit_paid_at

        if payment.status != PaymentStatus.VERIFIED:
            mark_payment_and_booking_verified(db, payment, booking, reviewer_id=None, notify_customer=True)
            logger.info(
                "Xendit webhook verified payment_id=%s booking_id=%s event_id=%s",
                payment.id,
                payment.booking_id,
                identity["event_id"],
            )

    elif status in XENDIT_EXPIRED_STATUSES:
        _mark_xendit_payment_expired(db, payment, commit=False)
        logger.info("Xendit webhook expired payment_id=%s booking_id=%s", payment.id, payment.booking_id)

    elif status in XENDIT_FAILED_STATUSES:
        _apply_xendit_failure(db, payment, booking, status=status, commit=False)
        logger.info(
            "Xendit webhook failed payment_id=%s booking_id=%s status=%s",
            payment.id,
            payment.booking_id,
            status,
        )

    event_log.status = status or event_log.status
    event_log.processed_at = datetime.utcnow()
    db.commit()
    db.refresh(payment)
    return payment
