"""Payment endpoints (paper §3.2.4 Customer DFD + Fig 14)."""
from datetime import datetime
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    Payment,
    PaymentStatus,
    Transaction,
    User,
    UserRole,
)
from app.schemas.payment import (
    FinanceSummary,
    PaymentCreate,
    PaymentRead,
    PaymentRefundRequest,
)
from app.services.notifications import send_email_notification


router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("", response_model=PaymentRead)
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your booking")

    if booking.status not in {
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
        status=PaymentStatus.PROCESSING,
        reference=f"PAY-{token_hex(4).upper()}",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    # Simulate gateway response: cash + card succeed; gcash/bank succeed; failure simulated rarely
    if payload.method in {"card", "gcash", "bank", "cash"}:
        payment.status = PaymentStatus.PAID
        payment.paid_at = datetime.utcnow()
        db.commit()
        db.refresh(payment)

        send_email_notification(
            to_email=user.email,
            subject=f"Payment received for booking #{booking.id}",
            html_body=f"<p>We received ₱{payload.amount:.2f} via {payload.method}. Reference: {payment.reference}</p>",
        )

    return payment


@router.get("", response_model=list[PaymentRead])
def list_payments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Payment)
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Payment.customer_id == user.id)
    return query.order_by(Payment.created_at.desc()).all()


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
    return db.query(Payment).filter(Payment.booking_id == booking_id).order_by(Payment.created_at.desc()).all()


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
    if payment.status != PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Only paid payments can be refunded")

    payment.status = PaymentStatus.REFUNDED
    payment.refunded_at = datetime.utcnow()
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/finance/summary", response_model=FinanceSummary)
def finance_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    payments = db.query(Payment).all()
    bookings = db.query(Booking).all()

    paid = sum(p.amount for p in payments if p.status == PaymentStatus.PAID)
    refunded = sum(p.amount for p in payments if p.status == PaymentStatus.REFUNDED)
    failed = sum(p.amount for p in payments if p.status == PaymentStatus.FAILED)
    pending = sum(p.amount for p in payments if p.status in {PaymentStatus.PENDING, PaymentStatus.PROCESSING})

    completed_revenue = sum(b.estimated_cost for b in bookings if b.status == BookingStatus.COMPLETED)
    receivables = max(0.0, completed_revenue - paid)

    by_method: dict[str, float] = {}
    for p in payments:
        if p.status == PaymentStatus.PAID:
            by_method[p.method] = round(by_method.get(p.method, 0) + p.amount, 2)

    paid_count = sum(1 for p in payments if p.status == PaymentStatus.PAID)
    avg_ticket = round(paid / paid_count, 2) if paid_count else 0

    return FinanceSummary(
        total_revenue=round(float(completed_revenue), 2),
        total_paid=round(float(paid), 2),
        total_pending=round(float(pending), 2),
        total_failed=round(float(failed), 2),
        total_refunded=round(float(refunded), 2),
        receivables=round(float(receivables), 2),
        payments_count=len(payments),
        average_ticket=avg_ticket,
        by_method=by_method,
    )
