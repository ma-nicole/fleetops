"""Customer-only booking lists, shipment tracking, and guarded cancellation."""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.routes.bookings import _sync_bookings_approved_from_verified_payments
from app.core.security import require_roles
from app.db import get_db
from app.models.entities import Booking, BookingStatus, TruckSlotHold, TruckSlotHoldStatus, User, UserRole
from app.schemas.booking import BookingCustomsUpdate, BookingRead
from app.services.booking_tracking_payload import build_assignments_for_booking
from app.services.goods_declaration_review import goods_declaration_review_customer_fields
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
from app.services.admin_analytics import AnalyticsFilters
from app.services.customer_role_analytics import build_customer_role_analytics

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
    review_fields = goods_declaration_review_customer_fields(booking)
    return {
        **core,
        **review_fields,
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


@router.patch("/bookings/{booking_id}/customs")
def customer_update_booking_customs(
    booking_id: int,
    payload: BookingCustomsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    """Customer-provided customs info — does not change payment or dispatch until admin validates."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or booking.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status in (BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.EXPIRED):
        raise HTTPException(status_code=400, detail="Cannot update customs info for a closed booking.")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No customs fields to update.")

    if "customs_clearance_status" in data:
        booking.customs_clearance_status = data["customs_clearance_status"]
    if "customs_tariff_notes" in data:
        booking.customs_tariff_notes = data["customs_tariff_notes"]
    if "customs_additional_charges_php" in data:
        booking.customs_additional_charges_php = data["customs_additional_charges_php"]

    booking.customs_customer_updated_at = datetime.utcnow()
    booking.customs_admin_validated = False
    booking.customs_validated_by_id = None
    booking.customs_validated_at = None
    booking.customs_admin_notes = None
    booking.customs_validated_additional_charges_php = None
    db.commit()
    db.refresh(booking)
    return BookingRead.model_validate(booking).model_dump(mode="json")


@router.get("/analytics")
def customer_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    truck_id: int | None = Query(default=None),
    route: str | None = Query(default=None),
    shipment_status: str | None = Query(default=None),
    granularity: str | None = Query(default="monthly"),
):
    from app.services.time_bucket import GRANULARITY_OPTIONS

    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")
    valid_gran = set(GRANULARITY_OPTIONS)
    gran = (granularity or "monthly").strip().lower()
    if gran not in valid_gran:
        raise HTTPException(status_code=400, detail=f"Invalid granularity. Use one of: {', '.join(sorted(valid_gran))}")

    filters = AnalyticsFilters(
        date_from=date_from,
        date_to=date_to,
        truck_id=truck_id,
        route=route.strip() if route else None,
        shipment_status=shipment_status.strip().lower() if shipment_status else None,
        granularity=gran,  # type: ignore[arg-type]
    )
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "filters_applied": {
            "date_from": filters.date_from.isoformat() if filters.date_from else None,
            "date_to": filters.date_to.isoformat() if filters.date_to else None,
            "truck_id": filters.truck_id,
            "route": filters.route,
            "shipment_status": filters.shipment_status,
            "granularity": filters.granularity,
        },
        "filter_options": {
            "granularity": filters.granularity,
            "granularity_options": list(GRANULARITY_OPTIONS),
        },
        "customer_role_analytics": build_customer_role_analytics(db, filters, customer=user),
    }
