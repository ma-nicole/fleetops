"""Bookings eligible for admin cargo type validation (Compliance queue)."""

from __future__ import annotations

from sqlalchemy import String, cast, exists, func, or_
from sqlalchemy.orm import Query, Session

from app.models.entities import (
    Booking,
    BookingStatus,
    GoodsDeclarationReviewStatus,
    Payment,
    PaymentStatus,
)

# Terminal — never show in cargo validation regardless of payment/declaration.
_TERMINAL_BOOKING_STATUSES = frozenset(
    {
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
        BookingStatus.COMPLETED,
        BookingStatus.EXPIRED,
        BookingStatus.PAYMENT_REJECTED,
    }
)

# Normalize legacy / mixed-case payment labels stored in MySQL.
_VERIFIED_PAYMENT_STATUS_VALUES = frozenset(
    {
        PaymentStatus.VERIFIED.value,
        "verified",
        "payment_verified",
        "approved",
        "VERIFIED",
        "PAYMENT_VERIFIED",
    }
)

_APPROVED_DECLARATION_STATUS_VALUES = frozenset(
    {
        GoodsDeclarationReviewStatus.APPROVED.value,
        "approved",
        "Approved",
        "APPROVED",
        "declaration_approved",
    }
)


def _norm_status(column):
    """Lowercase string comparison for VARCHAR/ENUM status columns."""
    return func.lower(func.trim(cast(column, String)))


def goods_declaration_is_approved(booking: Booking) -> bool:
    if bool(booking.goods_declaration_validated):
        return True
    status = (booking.goods_declaration_review_status or "").strip().lower()
    return status in {s.lower() for s in _APPROVED_DECLARATION_STATUS_VALUES}


def payment_verified_for_booking_subquery():
    """Exists: at least one admin-verified payment row (case-insensitive status match)."""
    return exists().where(
        Payment.booking_id == Booking.id,
        _norm_status(Payment.status).in_(
            {s.lower() for s in _VERIFIED_PAYMENT_STATUS_VALUES}
        ),
    )


def declaration_approved_filter():
    """Approved goods declaration — flag or normalized review status."""
    approved_lower = {s.lower() for s in _APPROVED_DECLARATION_STATUS_VALUES}
    return or_(
        Booking.goods_declaration_validated.is_(True),
        Booking.goods_declaration_validated == 1,
        _norm_status(Booking.goods_declaration_review_status).in_(tuple(approved_lower)),
    )


def booking_eligible_for_cargo_type_validation(db: Session, booking: Booking) -> bool:
    """Verified payment + approved declaration. Does not require map/route/trip/dispatch."""
    if booking.status in _TERMINAL_BOOKING_STATUSES:
        return False
    if not goods_declaration_is_approved(booking):
        return False
    pay = (
        db.query(Payment.id, Payment.status)
        .filter(Payment.booking_id == booking.id)
        .order_by(Payment.id.desc())
        .all()
    )
    for _, st in pay:
        raw = (st.value if hasattr(st, "value") else str(st or "")).strip().lower()
        if raw in {s.lower() for s in _VERIFIED_PAYMENT_STATUS_VALUES}:
            return True
    return False


def cargo_type_validation_queue_query(db: Session) -> Query:
    """
    Queue = verified payment (payments table) + approved goods declaration.
    Independent of booking.status (loading/enroute must not hide eligible rows).
    Does not require cargo_description, map geocoding, route, trip, or dispatch.
    """
    return (
        db.query(Booking)
        .filter(~Booking.status.in_(tuple(_TERMINAL_BOOKING_STATUSES)))
        .filter(payment_verified_for_booking_subquery())
        .filter(declaration_approved_filter())
        .order_by(Booking.updated_at.desc(), Booking.id.desc())
    )


def cargo_validation_status_chain(db: Session, booking: Booking) -> dict:
    """Diagnostic payload for a single booking (admin/debug)."""
    from app.services.dispatch_assignment_readiness import dispatch_assignment_readiness
    from app.services.pre_delivery_verification import build_pre_delivery_checklist

    latest_pay = (
        db.query(Payment)
        .filter(Payment.booking_id == booking.id)
        .order_by(Payment.id.desc())
        .first()
    )
    pay_st = None
    if latest_pay:
        pay_st = latest_pay.status.value if hasattr(latest_pay.status, "value") else str(latest_pay.status)

    checklist = build_pre_delivery_checklist(db, booking)
    readiness = dispatch_assignment_readiness(db, booking)

    return {
        "booking_id": booking.id,
        "booking_status": booking.status.value if hasattr(booking.status, "value") else str(booking.status),
        "payment_status": pay_st,
        "declaration_status": booking.goods_declaration_review_status,
        "document_review_status": booking.goods_declaration_review_status,
        "goods_declaration_validated": bool(booking.goods_declaration_validated),
        "cargo_validation_status": "verified" if booking.cargo_type_validated else "pending",
        "cargo_type_validated": bool(booking.cargo_type_validated),
        "pre_delivery_ready": checklist.get("ready_for_delivery"),
        "eligible_for_cargo_queue": booking_eligible_for_cargo_type_validation(db, booking),
        "dispatch_ready": readiness.get("ready"),
        "dispatch_blockers": readiness.get("blockers"),
    }
