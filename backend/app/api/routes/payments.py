"""Payment endpoints — proof upload + admin verification (Customer DFD payment lifecycle)."""
from datetime import datetime
from pathlib import Path
from secrets import token_hex
from uuid import uuid4

from app.services.upload_urls import media_type_for_path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    Payment,
    PaymentStatus,
    Trip,
    TruckSlotHold,
    TruckSlotHoldStatus,
    Transaction,
    User,
    UserRole,
)
from app.constants.gcash_payment import (
    GCASH_QR_FILENAMES,
    GCASH_QR_PLACEHOLDER,
    GCASH_QR_UPLOAD_DIR,
)
from app.constants.payment_limits import GCASH_MAX_TRANSACTION_PHP
from app.constants.payment_methods import ALLOWED_PAYMENT_METHODS, PROOF_OPTIONAL_METHODS
from app.core.config import settings
from app.core.paths import uploads_root, uploads_subdir
from app.schemas.payment import (
    FinanceSummary,
    PaymentCreate,
    PaymentRead,
    PaymentRefundRequest,
    XenditConfigRead,
    XenditPaymentSessionRead,
)
from app.services.notifications import send_email_notification
from app.services.dispatcher_booking_assignment import assert_dispatcher_booking_access
from app.services.payment_verification import mark_payment_and_booking_verified
from app.services.xendit_client import xendit_configured
from app.services.xendit_payment import create_xendit_gcash_session, handle_xendit_webhook, sync_xendit_payment_status

router = APIRouter(prefix="/payments", tags=["payments"])

UPLOAD_DIR = uploads_subdir("payment_proofs")

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".pdf"}


def _ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _validate_upload(filename: str, _content_type: str | None) -> str:
    if not filename:
        raise HTTPException(status_code=400, detail="Payment proof file is required.")
    lower = filename.lower()
    ext = Path(lower).suffix
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail="Proof must be a JPEG, PNG, or PDF file.",
        )
    return ext


def _resolve_gcash_qr_path() -> Path:
    GCASH_QR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for name in GCASH_QR_FILENAMES:
        candidate = GCASH_QR_UPLOAD_DIR / name
        if candidate.is_file():
            return candidate
    return GCASH_QR_PLACEHOLDER


def _user_assigned_to_booking(db: Session, booking_id: int, user: User) -> bool:
    if user.role == UserRole.DRIVER:
        return (
            db.query(Trip.id)
            .filter(Trip.booking_id == booking_id, Trip.driver_id == user.id)
            .first()
            is not None
        )
    if user.role == UserRole.HELPER:
        return (
            db.query(Trip.id)
            .filter(Trip.booking_id == booking_id, Trip.helper_id == user.id)
            .first()
            is not None
        )
    return False


def _assert_payment_access(db: Session, user: User, payment: Payment) -> None:
    if user.role in {UserRole.ADMIN, UserRole.MANAGER}:
        return
    if user.role == UserRole.CUSTOMER:
        if payment.customer_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        return
    if user.role == UserRole.DISPATCHER:
        assert_dispatcher_booking_access(db, user, payment.booking_id)
        return
    if _user_assigned_to_booking(db, payment.booking_id, user):
        return
    raise HTTPException(status_code=403, detail="Not authorized")


@router.get("/gcash-qr")
def get_gcash_qr_image():
    """Official FleetOps GCash merchant QR (upload to backend/uploads/payment_assets/gcash_qr.png).

    When Xendit is enabled, customers receive a dynamic QR from POST /payments/xendit/session/{booking_id}.
    """
    path = _resolve_gcash_qr_path()
    if not path.is_file():
        raise HTTPException(status_code=404, detail="GCash QR image is not available.")
    media = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media)


@router.get("/xendit/config", response_model=XenditConfigRead)
def get_xendit_config():
    """Public config for the customer portal (no secrets)."""
    return XenditConfigRead(
        enabled=xendit_configured(),
        public_key=(settings.xendit_public_key or "").strip() or None,
    )


@router.post("/xendit/session/{booking_id}", response_model=XenditPaymentSessionRead)
def create_xendit_payment_session(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    """Create (or return) a Xendit dynamic GCash QR payment for a booking."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    payment = create_xendit_gcash_session(db, booking, user)
    return XenditPaymentSessionRead(
        payment=payment,
        qr_string=payment.xendit_qr_string,
        xendit_status=payment.xendit_status,
    )


@router.get("/xendit/session/{booking_id}", response_model=XenditPaymentSessionRead)
def get_xendit_payment_session(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your booking")

    payment = (
        db.query(Payment)
        .filter(Payment.booking_id == booking_id, Payment.xendit_external_id.isnot(None))
        .order_by(Payment.id.desc())
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="No Xendit payment session for this booking.")

    payment = sync_xendit_payment_status(db, payment)
    return XenditPaymentSessionRead(
        payment=payment,
        qr_string=payment.xendit_qr_string,
        xendit_status=payment.xendit_status,
    )


@router.post("/xendit/webhook")
async def xendit_webhook(request: Request, db: Session = Depends(get_db)):
    """Xendit QR payment callback — verifies x-callback-token when configured."""
    expected = (settings.xendit_webhook_token or "").strip()
    if expected:
        token = request.headers.get("x-callback-token", "")
        if token != expected:
            raise HTTPException(status_code=401, detail="Invalid Xendit callback token")

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    handle_xendit_webhook(db, payload if isinstance(payload, dict) else {})
    return {"received": True}


@router.post("/xendit/simulate/{booking_id}", response_model=XenditPaymentSessionRead)
def simulate_xendit_payment(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER)),
):
    """Sandbox only — simulates QR payment completion when webhooks cannot reach localhost."""
    if (settings.app_env or "").strip().lower() == "production":
        raise HTTPException(status_code=404, detail="Not found")

    from app.services.xendit_client import XenditError, simulate_qr_payment

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your booking")

    payment = (
        db.query(Payment)
        .filter(Payment.booking_id == booking_id, Payment.xendit_external_id.isnot(None))
        .order_by(Payment.id.desc())
        .first()
    )
    if not payment or not payment.xendit_external_id:
        raise HTTPException(status_code=404, detail="No Xendit payment session for this booking.")

    try:
        simulate_qr_payment(external_id=payment.xendit_external_id, amount=payment.amount)
    except XenditError:
        # Sandbox/dev fallback when QR channel is not activated or simulate API is unavailable.
        pass

    handle_xendit_webhook(
        db,
        {
            "event": "qr.payment",
            "id": f"qrpy_sim_{payment.id}",
            "amount": payment.amount,
            "status": "COMPLETED",
            "qr_code": {"external_id": payment.xendit_external_id},
            "payment_detail": {"source": "GCASH"},
        },
    )
    db.refresh(payment)
    return XenditPaymentSessionRead(
        payment=payment,
        qr_string=payment.xendit_qr_string,
        xendit_status=payment.xendit_status,
    )


@router.post("", response_model=PaymentRead)
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Legacy/internal: record a payment row without proof. Stays in for_verification until proof upload."""
    booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your booking")

    if payload.method == "gcash" and payload.amount > GCASH_MAX_TRANSACTION_PHP:
        raise HTTPException(
            status_code=400,
            detail=(
                f"GCash payments are limited to ₱{GCASH_MAX_TRANSACTION_PHP:,.0f} per transaction. "
                "Use bank transfer or another payment method for this amount."
            ),
        )

    if booking.status not in {
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.PAYMENT_VERIFICATION,
        BookingStatus.PAYMENT_VERIFIED,
        BookingStatus.READY_FOR_ASSIGNMENT,
        BookingStatus.PENDING_APPROVAL,
        BookingStatus.APPROVED,
        BookingStatus.ASSIGNED,
        BookingStatus.ACCEPTED,
        BookingStatus.ENROUTE,
        BookingStatus.LOADING,
        BookingStatus.OUT_FOR_DELIVERY,
        BookingStatus.COMPLETED,
    }:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot pay for booking in status {booking.status}",
        )

    transaction = Transaction(
        booking_id=booking.id,
        customer_id=booking.customer_id,
        type="booking",
        amount=payload.amount,
    )
    db.add(transaction)
    db.flush()

    payment = Payment(
        booking_id=booking.id,
        transaction_id=transaction.id,
        customer_id=booking.customer_id,
        method=payload.method,
        amount=payload.amount,
        status=PaymentStatus.FOR_VERIFICATION,
        reference=f"PAY-{token_hex(4).upper()}",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.post("/submit-proof", response_model=PaymentRead)
async def submit_payment_proof(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
    booking_id: int = Form(...),
    method: str = Form("gcash"),
    file: UploadFile | None = File(None),
):
    _ensure_upload_dir()
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking.status in (
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
        BookingStatus.COMPLETED,
    ):
        raise HTTPException(status_code=400, detail="Cannot submit payment for this booking.")

    method = (method or "gcash").lower().strip()
    if method not in ALLOWED_PAYMENT_METHODS:
        raise HTTPException(status_code=400, detail="Invalid payment method")

    if method == "gcash" and xendit_configured():
        raise HTTPException(
            status_code=400,
            detail="GCash payments are processed through Xendit. Scan the QR code on the payment page — proof upload is not required.",
        )

    amount = round(float(booking.estimated_cost or 0), 2)

    if method == "gcash" and amount > GCASH_MAX_TRANSACTION_PHP:
        raise HTTPException(
            status_code=400,
            detail=(
                f"GCash payments are limited to ₱{GCASH_MAX_TRANSACTION_PHP:,.0f} per transaction. "
                "Use bank transfer or another payment method for this amount."
            ),
        )

    proof_required = method not in PROOF_OPTIONAL_METHODS
    has_file = file is not None and bool(file.filename)
    if proof_required and not has_file:
        raise HTTPException(status_code=400, detail="Proof file required for this payment method.")

    proof_original_filename: str | None = None
    proof_storage_path: str | None = None
    proof_uploaded_at: datetime | None = None

    if has_file and file is not None:
        ext = _validate_upload(file.filename or "", file.content_type)
        raw = await file.read()
        if len(raw) == 0:
            raise HTTPException(status_code=400, detail="Empty file is not allowed.")
        if len(raw) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File must be 5MB or smaller.")
        uid = uuid4().hex
        stored_name = f"b{booking_id}_{uid}{ext}"
        rel_path = f"payment_proofs/{stored_name}"
        abs_path = UPLOAD_DIR / stored_name
        abs_path.write_bytes(raw)
        proof_original_filename = file.filename
        proof_storage_path = rel_path
        proof_uploaded_at = datetime.utcnow()

    existing = (
        db.query(Payment)
        .filter(Payment.booking_id == booking_id)
        .order_by(Payment.id.desc())
        .first()
    )
    if booking.status == BookingStatus.PAYMENT_REJECTED:
        if not (existing and existing.status == PaymentStatus.REJECTED):
            raise HTTPException(
                status_code=400,
                detail="Use the payment page to submit a corrected proof for your rejected payment.",
            )
    if existing:
        if existing.status == PaymentStatus.VERIFIED:
            raise HTTPException(status_code=400, detail="Payment already verified for this booking.")
        if existing.status == PaymentStatus.FOR_VERIFICATION:
            if existing.proof_storage_path:
                raise HTTPException(status_code=400, detail="Proof already submitted — wait for admin review.")
            if existing.method in PROOF_OPTIONAL_METHODS:
                raise HTTPException(
                    status_code=400,
                    detail="Payment request already submitted — wait for admin review.",
                )

    if existing and existing.status == PaymentStatus.REJECTED:
        pay = existing
        pay.method = method
        pay.amount = amount
        pay.status = PaymentStatus.FOR_VERIFICATION
        pay.reference = pay.reference or f"PAY-{token_hex(4).upper()}"
        pay.paid_at = None
        pay.refunded_at = None
        pay.proof_original_filename = proof_original_filename
        pay.proof_storage_path = proof_storage_path
        pay.proof_uploaded_at = proof_uploaded_at
        pay.reviewed_at = None
        pay.reviewed_by_id = None
        if booking.status == BookingStatus.PAYMENT_REJECTED:
            booking.status = BookingStatus.PAYMENT_VERIFICATION
        db.commit()
        db.refresh(pay)
        return pay

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
        method=method,
        amount=amount,
        status=PaymentStatus.FOR_VERIFICATION,
        reference=f"PAY-{token_hex(4).upper()}",
        proof_original_filename=proof_original_filename,
        proof_storage_path=proof_storage_path,
        proof_uploaded_at=proof_uploaded_at,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("", response_model=list[PaymentRead])
def list_payments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Payment)
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Payment.customer_id == user.id)
    elif user.role in {UserRole.DRIVER, UserRole.HELPER}:
        trip_booking_ids = {
            int(row[0])
            for row in (
                db.query(Trip.booking_id)
                .filter(
                    Trip.booking_id.isnot(None),
                    Trip.driver_id == user.id if user.role == UserRole.DRIVER else Trip.helper_id == user.id,
                )
                .all()
            )
            if row[0] is not None
        }
        if not trip_booking_ids:
            return []
        query = query.filter(Payment.booking_id.in_(trip_booking_ids))
    elif user.role == UserRole.DISPATCHER:
        rows = query.order_by(Payment.created_at.desc()).all()
        return [row for row in rows if not _deny_dispatcher_payment(db, user, row)]
    return query.order_by(Payment.created_at.desc()).all()


def _deny_dispatcher_payment(db: Session, user: User, payment: Payment) -> bool:
    try:
        assert_dispatcher_booking_access(db, user, payment.booking_id)
    except HTTPException:
        return True
    return False


@router.get("/booking/{booking_id}", response_model=list[PaymentRead])
def list_booking_payments(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if user.role == UserRole.DISPATCHER:
        assert_dispatcher_booking_access(db, user, booking_id)
    if user.role in {UserRole.DRIVER, UserRole.HELPER} and not _user_assigned_to_booking(db, booking_id, user):
        raise HTTPException(status_code=403, detail="Not authorized")
    rows = db.query(Payment).filter(Payment.booking_id == booking_id).order_by(Payment.created_at.desc()).all()
    for row in rows:
        _assert_payment_access(db, user, row)
    return rows


@router.get("/finance/summary", response_model=FinanceSummary)
def finance_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    payments = db.query(Payment).all()
    bookings = db.query(Booking).all()

    verified = sum(p.amount for p in payments if p.status == PaymentStatus.VERIFIED)
    refunded = sum(p.amount for p in payments if p.status == PaymentStatus.REFUNDED)
    rejected = sum(p.amount for p in payments if p.status == PaymentStatus.REJECTED)
    pending_verification = sum(
        p.amount for p in payments if p.status == PaymentStatus.FOR_VERIFICATION
    )

    completed_revenue = sum(b.estimated_cost for b in bookings if b.status == BookingStatus.COMPLETED)
    receivables = max(0.0, completed_revenue - verified)

    by_method: dict[str, float] = {}
    for p in payments:
        if p.status == PaymentStatus.VERIFIED:
            by_method[p.method] = round(by_method.get(p.method, 0) + p.amount, 2)

    verified_count = sum(1 for p in payments if p.status == PaymentStatus.VERIFIED)
    avg_ticket = round(verified / verified_count, 2) if verified_count else 0

    return FinanceSummary(
        total_revenue=round(float(completed_revenue), 2),
        total_paid=round(float(verified), 2),
        total_pending=round(float(pending_verification), 2),
        total_failed=round(float(rejected), 2),
        total_refunded=round(float(refunded), 2),
        receivables=round(float(receivables), 2),
        payments_count=len(payments),
        average_ticket=avg_ticket,
        by_method=by_method,
    )


@router.get("/{payment_id}/proof", response_class=FileResponse)
def download_payment_proof(
    payment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    _assert_payment_access(db, user, payment)
    if not payment.proof_storage_path:
        raise HTTPException(status_code=404, detail="No proof file on record")

    base = uploads_root()
    path = base / payment.proof_storage_path
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Proof file missing on server")

    fname = payment.proof_original_filename or path.name
    return FileResponse(
        path,
        filename=fname,
        media_type=media_type_for_path(path),
    )


@router.post("/{payment_id}/verify", response_model=PaymentRead)
def verify_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != PaymentStatus.FOR_VERIFICATION:
        raise HTTPException(status_code=400, detail="Only submissions awaiting verification can be approved")
    xendit_paid = (payment.xendit_status or "").upper() == "PAID"
    if payment.method not in PROOF_OPTIONAL_METHODS and not payment.proof_storage_path and not xendit_paid:
        raise HTTPException(status_code=400, detail="No proof uploaded for this payment")

    book = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    if book:
        expected = round(float(book.estimated_cost or 0), 2)
        if abs(round(float(payment.amount or 0), 2) - expected) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Payment amount does not match the booking's expected amount. "
                    "Please ask the customer to resubmit payment proof."
                ),
            )

    mark_payment_and_booking_verified(db, payment, book, reviewer_id=reviewer.id, notify_customer=True)
    db.commit()
    db.refresh(payment)
    return payment


@router.post("/{payment_id}/reject", response_model=PaymentRead)
def reject_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != PaymentStatus.FOR_VERIFICATION:
        raise HTTPException(status_code=400, detail="Only submissions awaiting verification can be rejected")

    payment.status = PaymentStatus.REJECTED
    payment.paid_at = None
    payment.reviewed_at = datetime.utcnow()
    payment.reviewed_by_id = reviewer.id
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    if booking:
        booking.status = BookingStatus.PAYMENT_REJECTED
        db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
            {"hold_status": TruckSlotHoldStatus.RELEASED}
        )
    db.commit()
    db.refresh(payment)

    cust = db.query(User).filter(User.id == payment.customer_id).first()
    if cust and cust.email:
        send_email_notification(
            to_email=cust.email,
            subject=f"Payment proof needs correction — booking #{payment.booking_id}",
            html_body=(
                f"<p>We could not verify payment {payment.reference}.</p>"
                "<p>Your payment was rejected. Your booking is marked payment rejected and the reserved truck slot has been released. You may submit a corrected proof from the payment flow.</p>"
            ),
        )
    return payment


@router.post("/{payment_id}/refund", response_model=PaymentRead)
def refund_payment(
    payment_id: int,
    request: PaymentRefundRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != PaymentStatus.VERIFIED:
        raise HTTPException(status_code=400, detail="Only verified payments can be refunded")

    payment.status = PaymentStatus.REFUNDED
    payment.refunded_at = datetime.utcnow()
    db.commit()
    db.refresh(payment)
    return payment
