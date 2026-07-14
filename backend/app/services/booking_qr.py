"""Booking QR code for helper verification before trip start."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from secrets import compare_digest, token_urlsafe
from urllib.parse import unquote

from sqlalchemy.orm import Session

from app.models.entities import Booking, BookingStatus, Payment, User

logger = logging.getLogger(__name__)

# Canonical form uses colons so token_urlsafe hyphens cannot shift the booking id.
# Legacy dash form remains accepted for already-issued customer QR images.
PAYLOAD_PREFIX = "FLEETOPS-BOOKING"
_LEGACY_DASH_RE = re.compile(r"^FLEETOPS-BOOKING-(\d+)-(.+)$")
_COLON_RE = re.compile(r"^FLEETOPS-BOOKING:(\d+):(.+)$")


def ensure_booking_qr_token(booking: Booking) -> str:
    token = (getattr(booking, "booking_qr_token", None) or "").strip()
    if not token:
        # token_urlsafe may include '-' and '_'; never includes ':' .
        token = token_urlsafe(16)
        booking.booking_qr_token = token
    return token


def booking_qr_payload(booking: Booking) -> str | None:
    token = (getattr(booking, "booking_qr_token", None) or "").strip()
    if not token:
        return None
    return f"{PAYLOAD_PREFIX}:{int(booking.id)}:{token}"


def booking_qr_legacy_payload(booking: Booking) -> str | None:
    """Dash-separated format used by the first Booking QR rollout."""
    token = (getattr(booking, "booking_qr_token", None) or "").strip()
    if not token:
        return None
    return f"{PAYLOAD_PREFIX}-{int(booking.id)}-{token}"


def normalize_booking_qr_scan(raw: str) -> str:
    """Strip wrappers / encoding so scan text matches the generated payload."""
    text = (raw or "").strip()
    if not text:
        return ""
    # Cameras / share sheets sometimes wrap or percent-encode the payload.
    text = unquote(text).strip().strip("\ufeff").strip()
    if "FLEETOPS-BOOKING" in text:
        idx = text.find("FLEETOPS-BOOKING")
        text = text[idx:].strip()
    # Drop trailing junk occasionally appended by scanner apps.
    for stop in ("\n", "\r", " ", "\t"):
        if stop in text:
            # Keep payload continuous until first whitespace.
            text = text.split(stop, 1)[0]
    return text.strip()


def parse_booking_qr_payload(raw: str) -> tuple[int, str] | None:
    text = normalize_booking_qr_scan(raw)
    if not text:
        return None

    for pattern in (_COLON_RE, _LEGACY_DASH_RE):
        match = pattern.match(text)
        if not match:
            continue
        try:
            booking_id = int(match.group(1))
        except ValueError:
            return None
        token = (match.group(2) or "").strip()
        if booking_id <= 0 or not token:
            return None
        return booking_id, token
    return None


def booking_qr_public_fields(booking: Booking) -> dict:
    payload = booking_qr_payload(booking)
    verified = getattr(booking, "booking_qr_verified_at", None)
    return {
        "booking_qr_payload": payload,
        "booking_qr_ready": bool(payload),
        "booking_qr_verified": verified is not None,
        "booking_qr_verified_at": verified.isoformat() if verified else None,
        "booking_qr_verified_method": getattr(booking, "booking_qr_verified_method", None),
    }


def _payment_status_for_booking(db: Session, booking_id: int) -> str | None:
    row = (
        db.query(Payment.status)
        .filter(Payment.booking_id == booking_id)
        .order_by(Payment.id.desc())
        .first()
    )
    if not row:
        return None
    status = row[0]
    return status.value if hasattr(status, "value") else str(status)


def _mark_verified(booking: Booking, scanner: User, *, method: str, already: bool) -> dict:
    if already:
        verified_at = booking.booking_qr_verified_at
        assert verified_at is not None
        return {
            "ok": True,
            "already_verified": True,
            "booking_id": int(booking.id),
            "verified_at": verified_at.isoformat(),
            "verification_method": getattr(booking, "booking_qr_verified_method", None) or method,
            "message": "Booking QR was already verified.",
        }

    booking.booking_qr_verified_at = datetime.utcnow()
    booking.booking_qr_verified_by_id = scanner.id
    if hasattr(booking, "booking_qr_verified_method"):
        booking.booking_qr_verified_method = (method or "scan")[:16]
    return {
        "ok": True,
        "already_verified": False,
        "booking_id": int(booking.id),
        "verified_at": booking.booking_qr_verified_at.isoformat(),
        "verification_method": getattr(booking, "booking_qr_verified_method", None) or method,
        "message": "Booking QR verified. You may start the trip.",
    }


def verify_booking_qr(
    db: Session,
    *,
    booking: Booking,
    payload: str,
    scanner: User,
    method: str = "scan",
) -> dict:
    """Validate helper scan of customer booking QR before trip start."""
    scanned = normalize_booking_qr_scan(payload)
    expected = booking_qr_payload(booking)
    expected_legacy = booking_qr_legacy_payload(booking)
    current_booking_id = int(booking.id)
    booking_status = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    payment_status = _payment_status_for_booking(db, current_booking_id)
    method_norm = (method or "scan").strip().lower() or "scan"
    if method_norm not in {"scan", "camera", "manual", "paste"}:
        method_norm = "scan"

    parsed = parse_booking_qr_payload(scanned)
    qr_booking_id = int(parsed[0]) if parsed else None
    qr_token = parsed[1] if parsed else None

    logger.debug(
        "booking_qr_verify Generated QR: %s | Decoded QR: %s | Current Booking: %s | "
        "Expected Booking: %s | QR booking_id: %s | verification code/token present: %s | "
        "booking status: %s | payment status: %s",
        expected,
        scanned,
        current_booking_id,
        current_booking_id,
        qr_booking_id,
        bool(qr_token),
        booking_status,
        payment_status,
    )

    if scanned.startswith("FLEETOPS-DELIVERY"):
        raise ValueError(
            "Scanned the Delivery QR. Use the Booking helper QR (issued after payment) to start the trip."
        )
    if scanned.startswith("FLEETOPS-TRIP-"):
        raise ValueError(
            "Scanned a trip receiving QR. Use the customer Booking helper QR to start the trip."
        )

    status = (booking_status or "").strip().lower()
    if status in {
        BookingStatus.CANCELLED.value,
        BookingStatus.REJECTED.value,
        BookingStatus.EXPIRED.value,
    }:
        raise ValueError(f"Booking is {status}; QR verification is not allowed.")

    if getattr(booking, "booking_qr_verified_at", None) is not None:
        result = _mark_verified(booking, scanner, method=method_norm, already=True)
        logger.debug("booking_qr_verify Verification Result: already_verified booking_id=%s", current_booking_id)
        return result

    if not expected:
        raise ValueError("Booking QR is not ready yet. Ask the customer to refresh after payment verification.")

    # Source of truth: full generated payload (canonical or legacy).
    expected_matches = (
        compare_digest(scanned, expected)
        or (expected_legacy is not None and compare_digest(scanned, expected_legacy))
    )
    if expected_matches:
        result = _mark_verified(booking, scanner, method=method_norm, already=False)
        logger.debug("booking_qr_verify Verification Result: ok (exact payload match) booking_id=%s", current_booking_id)
        return result

    if not parsed:
        raise ValueError("Invalid booking QR code.")

    if qr_booking_id != current_booking_id:
        logger.warning(
            "booking_qr_verify Verification Result: mismatch | Generated QR: %s | Decoded QR: %s | "
            "Current Booking: %s | Expected Booking: %s",
            expected,
            scanned,
            current_booking_id,
            qr_booking_id,
        )
        raise ValueError("QR code does not match this booking.")

    expected_token = (getattr(booking, "booking_qr_token", None) or "").strip()
    if not expected_token or not qr_token or not compare_digest(qr_token, expected_token):
        raise ValueError("QR code is not valid for this booking.")

    result = _mark_verified(booking, scanner, method=method_norm, already=False)
    logger.debug("booking_qr_verify Verification Result: ok (id+token match) booking_id=%s", current_booking_id)
    return result
