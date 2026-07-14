"""Booking QR code for helper verification before trip start."""

from __future__ import annotations

from datetime import datetime
from secrets import token_urlsafe

from sqlalchemy.orm import Session

from app.models.entities import Booking, BookingStatus, User

PAYLOAD_PREFIX = "FLEETOPS-BOOKING-"


def ensure_booking_qr_token(booking: Booking) -> str:
    token = (getattr(booking, "booking_qr_token", None) or "").strip()
    if not token:
        token = token_urlsafe(16)
        booking.booking_qr_token = token
    return token


def booking_qr_payload(booking: Booking) -> str | None:
    token = (getattr(booking, "booking_qr_token", None) or "").strip()
    if not token:
        return None
    return f"{PAYLOAD_PREFIX}{booking.id}-{token}"


def parse_booking_qr_payload(raw: str) -> tuple[int, str] | None:
    text = (raw or "").strip()
    if not text.startswith(PAYLOAD_PREFIX):
        return None
    rest = text[len(PAYLOAD_PREFIX) :]
    if "-" not in rest:
        return None
    id_part, token = rest.split("-", 1)
    try:
        booking_id = int(id_part)
    except ValueError:
        return None
    token = token.strip()
    if booking_id <= 0 or not token:
        return None
    return booking_id, token


def booking_qr_public_fields(booking: Booking) -> dict:
    payload = booking_qr_payload(booking)
    verified = getattr(booking, "booking_qr_verified_at", None)
    return {
        "booking_qr_payload": payload,
        "booking_qr_ready": bool(payload),
        "booking_qr_verified": verified is not None,
        "booking_qr_verified_at": verified.isoformat() if verified else None,
    }


def verify_booking_qr(
    db: Session,
    *,
    booking: Booking,
    payload: str,
    scanner: User,
) -> dict:
    """Validate helper scan of customer booking QR before trip start."""
    parsed = parse_booking_qr_payload(payload)
    if not parsed:
        raise ValueError("Invalid booking QR code.")
    booking_id, token = parsed
    if booking_id != booking.id:
        raise ValueError("QR code does not match this booking.")
    expected = (getattr(booking, "booking_qr_token", None) or "").strip()
    if not expected or token != expected:
        raise ValueError("QR code is not valid for this booking.")

    status = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    if status in {
        BookingStatus.CANCELLED.value,
        BookingStatus.REJECTED.value,
        BookingStatus.EXPIRED.value,
        BookingStatus.PAYMENT_REJECTED.value,
        BookingStatus.PENDING_PAYMENT.value,
        BookingStatus.PAYMENT_VERIFICATION.value,
    }:
        raise ValueError(f"Booking status '{status}' cannot be verified for trip start.")

    if getattr(booking, "booking_qr_verified_at", None) is not None:
        return {
            "ok": True,
            "already_verified": True,
            "booking_id": booking.id,
            "verified_at": booking.booking_qr_verified_at.isoformat(),
            "message": "Booking QR was already verified.",
        }

    booking.booking_qr_verified_at = datetime.utcnow()
    booking.booking_qr_verified_by_id = scanner.id
    db.flush()
    return {
        "ok": True,
        "already_verified": False,
        "booking_id": booking.id,
        "verified_at": booking.booking_qr_verified_at.isoformat(),
        "message": "Booking QR verified. You may start the trip.",
    }
