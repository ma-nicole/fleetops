"""Customer-only booking lists, shipment tracking, and guarded cancellation."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.bookings import _sync_bookings_approved_from_verified_payments
from app.core.security import require_roles
from app.db import get_db
from app.models.entities import Booking, BookingStatus, TruckSlotHold, TruckSlotHoldStatus, User, UserRole
from app.schemas.booking import BookingRead
from app.services.booking_tracking_payload import build_assignments_for_booking
from app.services.customer_booking_portal import (
    CUSTOMER_ACTIVE_DISPLAY_STATUSES,
    CUSTOMER_HISTORY_DISPLAY_STATUSES,
    customer_can_cancel,
    display_status_label,
    ensure_booking_status_matches_trips,
    history_primary_trip_id,
    repair_stale_payment_rejection,
    resolve_customer_display_status,
)

router = APIRouter(prefix="/customer", tags=["customer"])


def _customer_booking_rows(db: Session, customer_id: int) -> list[Booking]:
    return (
        db.query(Booking)
        .filter(Booking.customer_id == customer_id)
        .order_by(Booking.created_at.desc())
        .all()
    )


def _repair_and_sync_all(db: Session, customer_id: int) -> None:
    for b in _customer_booking_rows(db, customer_id):
        repair_stale_payment_rejection(db, b)
        ensure_booking_status_matches_trips(db, b)
    db.commit()
    db.expire_all()


def _serialize_booking(db: Session, booking: Booking) -> dict:
    assignments = build_assignments_for_booking(db, booking)
    display = resolve_customer_display_status(booking, assignments)
    label = display_status_label(display)
    core = BookingRead.model_validate(booking).model_dump(mode="json")
    return {
        **core,
        "assignments": assignments,
        "display_status": display,
        "display_status_label": label,
        "can_cancel": customer_can_cancel(booking, display),
    }


@router.get("/current-bookings")
def customer_current_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    _sync_bookings_approved_from_verified_payments(db, user.id)
    _repair_and_sync_all(db, user.id)
    out: list[dict] = []
    for b in _customer_booking_rows(db, user.id):
        payload = _serialize_booking(db, b)
        if payload["display_status"] in CUSTOMER_ACTIVE_DISPLAY_STATUSES:
            out.append(payload)
    return out


@router.get("/booking-history")
def customer_booking_history(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    _sync_bookings_approved_from_verified_payments(db, user.id)
    _repair_and_sync_all(db, user.id)
    out: list[dict] = []
    for b in _customer_booking_rows(db, user.id):
        payload = _serialize_booking(db, b)
        if payload["display_status"] in CUSTOMER_HISTORY_DISPLAY_STATUSES:
            tid = history_primary_trip_id(payload["assignments"])
            out.append(
                {
                    **payload,
                    "primary_trip_id": tid,
                    "closed_at": b.updated_at.isoformat() if b.updated_at else None,
                }
            )
    out.sort(key=lambda x: x.get("closed_at") or "", reverse=True)
    return out


@router.get("/shipment-tracking")
def customer_shipment_tracking(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    return {"shipments": customer_current_bookings(db=db, user=user)}


@router.patch("/bookings/{booking_id}/cancel")
def customer_cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or booking.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in (BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_VERIFICATION):
        raise HTTPException(
            status_code=400,
            detail="Cancellation is only allowed before payment is verified.",
        )
    booking.status = BookingStatus.CANCELLED
    db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
        {"hold_status": TruckSlotHoldStatus.RELEASED}
    )
    db.commit()
    return {"status": "cancelled"}
