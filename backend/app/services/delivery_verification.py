"""Customer-authorized final delivery verification and completion."""

from __future__ import annotations

from datetime import datetime
import logging
import secrets
import string
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.entities import Booking, BookingStatus, Payment, PaymentStatus, Trip, TripStatus
from app.services.delivery_receiving_verification import assert_delivery_receiving_complete
from app.services.toll_computation import finalize_trip_toll_on_completion
from app.services.trip_status_sync import sync_trip_and_booking_status


logger = logging.getLogger(__name__)
QR_PREFIX = "FLEETOPS-DELIVERY"
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
TERMINAL_INACTIVE_STATUSES = {
    BookingStatus.CANCELLED,
    BookingStatus.REJECTED,
    BookingStatus.PAYMENT_REJECTED,
    BookingStatus.EXPIRED,
}


def _status_value(value: object) -> str:
    return str(getattr(value, "value", value) or "").strip().lower()


def _payment_is_verified(db: Session, booking_id: int) -> bool:
    return (
        db.query(Payment.id)
        .filter(Payment.booking_id == booking_id, Payment.status == PaymentStatus.VERIFIED)
        .first()
        is not None
    )


def _new_code(db: Session) -> str:
    for _ in range(20):
        raw = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        code = f"{raw[:4]}-{raw[4:]}"
        exists = db.query(Booking.id).filter(Booking.delivery_verification_code == code).first()
        if not exists:
            return code
    raise RuntimeError("Unable to allocate a unique delivery verification code.")


def _new_token(db: Session) -> str:
    for _ in range(10):
        token = secrets.token_urlsafe(32)
        exists = db.query(Booking.id).filter(Booking.delivery_verification_token == token).first()
        if not exists:
            return token
    raise RuntimeError("Unable to allocate a unique delivery verification token.")


def ensure_delivery_verification_credentials(
    db: Session,
    booking: Booking,
    *,
    payment_verified: bool = False,
) -> bool:
    """Create the booking credential once payment is verified; return whether it is available."""
    if booking.status in TERMINAL_INACTIVE_STATUSES or booking.status == BookingStatus.COMPLETED:
        return False
    if not payment_verified and not _payment_is_verified(db, booking.id):
        return False

    changed = False
    if not (booking.delivery_verification_token or "").strip():
        booking.delivery_verification_token = _new_token(db)
        changed = True
    if not (booking.delivery_verification_code or "").strip():
        booking.delivery_verification_code = _new_code(db)
        changed = True
    if changed or booking.delivery_verification_created_at is None:
        booking.delivery_verification_created_at = booking.delivery_verification_created_at or datetime.utcnow()
        changed = True
    if changed:
        db.flush()
        logger.info("delivery verification credentials generated booking_id=%s", booking.id)
    return True


def delivery_qr_payload(booking: Booking) -> str | None:
    token = (booking.delivery_verification_token or "").strip()
    if not token:
        return None
    return f"{QR_PREFIX}:{booking.id}:{booking.customer_id}:{token}"


def delivery_verification_customer_fields(booking: Booking) -> dict[str, Any]:
    used = booking.delivery_verification_used_at is not None
    inactive = booking.status in TERMINAL_INACTIVE_STATUSES or booking.status == BookingStatus.COMPLETED
    has_credentials = bool(
        (booking.delivery_verification_token or "").strip()
        and (booking.delivery_verification_code or "").strip()
    )
    active = has_credentials and not used and not inactive
    return {
        "delivery_verification_ready": has_credentials,
        "delivery_verification_active": active,
        "delivery_verification_used": used,
        # Secrets are never returned after use or closure.
        "delivery_verification_qr_payload": delivery_qr_payload(booking) if active else None,
        "delivery_verification_code": booking.delivery_verification_code if active else None,
        "delivery_verification_created_at": (
            booking.delivery_verification_created_at.isoformat()
            if booking.delivery_verification_created_at
            else None
        ),
        "delivery_verification_used_at": (
            booking.delivery_verification_used_at.isoformat()
            if booking.delivery_verification_used_at
            else None
        ),
        "delivery_verification_method": booking.delivery_verification_method,
    }


def normalize_verification_code(raw: str) -> str:
    cleaned = "".join(ch for ch in (raw or "").upper() if ch in string.ascii_uppercase + string.digits)
    return f"{cleaned[:4]}-{cleaned[4:8]}" if len(cleaned) == 8 else cleaned


def _validate_credential(booking: Booking, method: str, credential: str) -> None:
    supplied = (credential or "").strip()
    if method == "qr":
        expected = delivery_qr_payload(booking) or ""
        if not expected or not secrets.compare_digest(supplied, expected):
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_delivery_qr", "message": "The Delivery QR Code is invalid for this booking or customer."},
            )
        return

    expected_code = normalize_verification_code(booking.delivery_verification_code or "")
    supplied_code = normalize_verification_code(supplied)
    if not expected_code or not secrets.compare_digest(supplied_code, expected_code):
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_delivery_code", "message": "The Verification Code is invalid for this booking."},
        )


def verify_and_complete_delivery(
    db: Session,
    *,
    trip_id: int,
    helper_id: int,
    method: str,
    credential: str,
) -> dict[str, Any]:
    """Validate a customer credential and atomically complete every trip in its booking."""
    verification_method = (method or "").strip().lower()
    if verification_method not in {"qr", "code"}:
        raise HTTPException(status_code=400, detail="Verification method must be 'qr' or 'code'.")

    # Resolve the booking first, then lock booking -> trips in a consistent order.
    # This prevents two helpers on separate convoy legs from deadlocking.
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip or trip.helper_id != helper_id:
        raise HTTPException(status_code=404, detail="Trip not found for this helper.")
    booking = db.query(Booking).filter(Booking.id == trip.booking_id).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if not booking.customer_id:
        raise HTTPException(status_code=400, detail="Booking has no valid customer owner.")
    if booking.delivery_verification_used_at is not None:
        raise HTTPException(
            status_code=409,
            detail={"code": "delivery_verification_used", "message": "This Delivery QR/Verification Code has already been used."},
        )
    if booking.status == BookingStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="This booking is already completed.")
    if booking.status in TERMINAL_INACTIVE_STATUSES:
        raise HTTPException(
            status_code=410,
            detail={
                "code": "delivery_verification_expired",
                "message": f"This Delivery QR/Verification Code is no longer active because the booking is {_status_value(booking.status).replace('_', ' ')}.",
            },
        )
    if not _payment_is_verified(db, booking.id):
        raise HTTPException(status_code=400, detail="Payment is not verified for this booking.")
    if not booking.delivery_verification_token or not booking.delivery_verification_code:
        raise HTTPException(
            status_code=409,
            detail="Delivery verification credentials are not available. Ask the customer to refresh their dashboard.",
        )

    trips = (
        db.query(Trip)
        .filter(Trip.booking_id == booking.id, Trip.status != TripStatus.CANCELLED)
        .order_by(Trip.id.asc())
        .with_for_update()
        .all()
    )
    if not trips:
        raise HTTPException(status_code=400, detail="No active delivery trips exist for this booking.")
    locked_trip = next((item for item in trips if item.id == trip_id), None)
    if not locked_trip or locked_trip.helper_id != helper_id:
        raise HTTPException(status_code=404, detail="Trip not found for this helper.")
    not_arrived = [
        t.id
        for t in trips
        if t.status != TripStatus.COMPLETED
        and (t.helper_progress_status or "").strip().lower() != "dropped_off"
    ]
    if not_arrived:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "not_arrived_at_destination",
                "message": "Every truck in this booking must be Arrived at Destination before verification.",
                "trip_ids": not_arrived,
            },
        )
    for delivery_trip in trips:
        if delivery_trip.status != TripStatus.COMPLETED:
            assert_delivery_receiving_complete(delivery_trip)

    _validate_credential(booking, verification_method, credential)

    completed_at = datetime.utcnow()
    booking.delivery_verification_used_at = completed_at
    booking.delivery_verification_used_by_helper_id = helper_id
    booking.delivery_verification_method = verification_method

    completed_trip_ids: list[int] = []
    for delivery_trip in trips:
        if delivery_trip.status == TripStatus.COMPLETED:
            continue
        delivery_trip.arrival_delivery_time = delivery_trip.arrival_delivery_time or completed_at
        sync_trip_and_booking_status(
            db,
            delivery_trip.id,
            "completed",
            helper_id=helper_id,
            location_name="Delivery verified by customer",
            remarks=f"Final verification method: {verification_method}",
            delivery_verified=True,
        )
        finalize_trip_toll_on_completion(db, delivery_trip, booking)
        completed_trip_ids.append(delivery_trip.id)

    booking.actual_cost = round(
        sum(
            float(delivery_trip.fuel_cost or 0)
            + float(delivery_trip.toll_actual_total if delivery_trip.toll_actual_total is not None else delivery_trip.toll_cost or 0)
            + float(delivery_trip.labor_cost or 0)
            + float(delivery_trip.maintenance_cost or 0)
            for delivery_trip in trips
        ),
        2,
    )

    db.flush()
    logger.info(
        "delivery verified booking_id=%s trip_ids=%s helper_id=%s method=%s",
        booking.id,
        completed_trip_ids,
        helper_id,
        verification_method,
    )
    return {
        "booking_id": booking.id,
        "trip_ids": completed_trip_ids,
        "status": "completed",
        "completed_at": completed_at.isoformat(),
        "helper_id": helper_id,
        "verification_method": verification_method,
        "message": "Delivery verified. The booking is now completed.",
    }
