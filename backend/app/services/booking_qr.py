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

# Single generated format. Legacy FLEETOPS-* forms are accepted on verify only.
_PIPE_RE = re.compile(r"^booking\s*=\s*(\d+)\s*\|\s*code\s*=\s*(.+)$", re.IGNORECASE)
_COLON_RE = re.compile(r"^FLEETOPS-BOOKING:(\d+):(.+)$", re.IGNORECASE)
_LEGACY_DASH_RE = re.compile(r"^FLEETOPS-BOOKING-(\d+)-(.+)$", re.IGNORECASE)


def _safe_compare(a: str, b: str) -> bool:
    if not a or not b or len(a) != len(b):
        return False
    return compare_digest(a, b)


def ensure_booking_qr_token(booking: Booking, *, payment_status: str | None = None) -> str:
    token = (getattr(booking, "booking_qr_token", None) or "").strip()
    created = False
    if not token:
        token = token_urlsafe(16)
        booking.booking_qr_token = token
        created = True
    payload = f"booking={int(booking.id)}|code={token}"
    if created:
        booking_status = (
            booking.status.value if hasattr(getattr(booking, "status", None), "value") else getattr(booking, "status", None)
        )
        logger.info(
            "booking_qr_generate Generated QR payload=%s | Booking ID=%s | Verification code present=%s | "
            "Payment status=%s | Booking status=%s",
            payload,
            int(booking.id),
            True,
            payment_status,
            booking_status,
        )
    return token


def booking_qr_payload(booking: Booking) -> str | None:
    """Canonical payload encoded into the customer Booking QR."""
    token = (getattr(booking, "booking_qr_token", None) or "").strip()
    if not token:
        return None
    return f"booking={int(booking.id)}|code={token}"


def booking_qr_legacy_payloads(booking: Booking) -> list[str]:
    token = (getattr(booking, "booking_qr_token", None) or "").strip()
    if not token:
        return []
    bid = int(booking.id)
    return [
        f"FLEETOPS-BOOKING:{bid}:{token}",
        f"FLEETOPS-BOOKING-{bid}-{token}",
    ]


def normalize_booking_qr_scan(raw: str) -> str:
    """Strip wrappers / encoding so scan text matches a known payload form."""
    text = (raw or "").strip()
    if not text:
        return ""
    text = unquote(text).strip().strip("\ufeff").strip()
    lower = text.lower()
    for marker in ("booking=", "fleetops-booking", "fleetops-delivery", "fleetops-trip-"):
        idx = lower.find(marker)
        if idx >= 0:
            text = text[idx:].strip()
            break
    text = re.split(r"[\s\r\n]+", text, maxsplit=1)[0].strip()
    return text


def parse_booking_qr_payload(raw: str) -> tuple[int, str] | None:
    text = normalize_booking_qr_scan(raw)
    if not text:
        return None

    for pattern in (_PIPE_RE, _COLON_RE, _LEGACY_DASH_RE):
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


def resolve_scanned_token(*, scanned: str, booking: Booking) -> tuple[int, str] | None:
    """Parse full QR payload, or accept bare verification code for the current booking."""
    parsed = parse_booking_qr_payload(scanned)
    if parsed:
        return parsed
    expected_token = (getattr(booking, "booking_qr_token", None) or "").strip()
    bare = (scanned or "").strip()
    if expected_token and bare and _safe_compare(bare, expected_token):
        return int(booking.id), expected_token
    return None


def booking_qr_public_fields(booking: Booking) -> dict:
    token = (getattr(booking, "booking_qr_token", None) or "").strip() or None
    payload = booking_qr_payload(booking)
    verified = getattr(booking, "booking_qr_verified_at", None)
    return {
        "booking_qr_payload": payload,
        "booking_qr_code": token,
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
    expected_legacy = booking_qr_legacy_payloads(booking)
    current_booking_id = int(booking.id)
    booking_status = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    payment_status = _payment_status_for_booking(db, current_booking_id)
    method_norm = (method or "scan").strip().lower() or "scan"
    if method_norm not in {"scan", "camera", "manual", "paste"}:
        method_norm = "scan"

    parsed = resolve_scanned_token(scanned=scanned, booking=booking)
    qr_booking_id = int(parsed[0]) if parsed else None
    qr_token = parsed[1] if parsed else None
    expected_token = (getattr(booking, "booking_qr_token", None) or "").strip()

    logger.info(
        "booking_qr_verify Current helper booking=%s | QR booking=%s | "
        "verification code expected=%s | Decoded payload=%s | Expected payload=%s | "
        "booking_status=%s | payment_status=%s",
        current_booking_id,
        qr_booking_id,
        bool(expected_token),
        scanned,
        expected,
        booking_status,
        payment_status,
    )

    lowered = scanned.lower()
    if lowered.startswith("fleetops-delivery"):
        raise ValueError(
            "Scanned the Delivery QR. Use the Booking helper QR (issued after payment) to start the trip."
        )
    if lowered.startswith("fleetops-trip-"):
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
        logger.info("booking_qr_verify Verification Result: already_verified booking_id=%s", current_booking_id)
        return result

    if not expected or not expected_token:
        raise ValueError("Booking QR is not ready yet. Ask the customer to refresh after payment verification.")

    # Exact match against canonical or previously issued legacy payloads.
    candidates = [expected, *expected_legacy]
    if any(_safe_compare(scanned, c) for c in candidates if c):
        result = _mark_verified(booking, scanner, method=method_norm, already=False)
        logger.info("booking_qr_verify Verification Result: ok (exact payload) booking_id=%s", current_booking_id)
        return result

    # Bare verification code for this booking (manual entry fallback).
    if _safe_compare(scanned, expected_token):
        result = _mark_verified(booking, scanner, method=method_norm, already=False)
        logger.info("booking_qr_verify Verification Result: ok (bare code) booking_id=%s", current_booking_id)
        return result

    if not parsed:
        raise ValueError("Invalid booking QR code.")

    if qr_booking_id != current_booking_id:
        logger.warning(
            "booking_qr_verify Verification Result: booking id mismatch | current=%s | qr=%s | decoded=%s",
            current_booking_id,
            qr_booking_id,
            scanned,
        )
        raise ValueError("QR code does not match this booking.")

    if not qr_token or not _safe_compare(qr_token, expected_token):
        raise ValueError("QR verification code does not match this booking.")

    result = _mark_verified(booking, scanner, method=method_norm, already=False)
    logger.info("booking_qr_verify Verification Result: ok (id+code) booking_id=%s", current_booking_id)
    return result
