"""Booking Completion QR — customer credential verified by helper at delivery completion."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from secrets import compare_digest, token_urlsafe
from urllib.parse import unquote

from sqlalchemy.orm import Session

from app.models.entities import Booking, BookingStatus, Payment, Trip, TripStatus, User

logger = logging.getLogger(__name__)

# Single generated format. Legacy FLEETOPS-* forms are accepted on verify only.
_PIPE_RE = re.compile(r"^booking\s*=\s*(\d+)\s*\|\s*code\s*=\s*(.+)$", re.IGNORECASE)
_COLON_RE = re.compile(r"^FLEETOPS-BOOKING:(\d+):(.+)$", re.IGNORECASE)
_LEGACY_DASH_RE = re.compile(r"^FLEETOPS-BOOKING-(\d+)-(.+)$", re.IGNORECASE)

_TERMINAL_INACTIVE = {
    BookingStatus.CANCELLED.value,
    BookingStatus.REJECTED.value,
    BookingStatus.EXPIRED.value,
    BookingStatus.PAYMENT_REJECTED.value,
}


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
    """Canonical payload encoded into the customer Booking Completion QR."""
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


def _normalize_method(method: str) -> str:
    raw = (method or "scan").strip().lower() or "scan"
    if raw in {"camera", "scan", "qr", "qr_scan"}:
        return "qr_scan"
    if raw in {"manual", "paste", "code"}:
        return "manual"
    return "qr_scan"


def _assert_credential_matches(booking: Booking, scanned: str) -> None:
    expected = booking_qr_payload(booking)
    expected_legacy = booking_qr_legacy_payloads(booking)
    expected_token = (getattr(booking, "booking_qr_token", None) or "").strip()

    lowered = scanned.lower()
    if lowered.startswith("fleetops-delivery"):
        raise ValueError(
            "Scanned the Delivery QR. Use the customer's Booking Completion QR to finish the booking."
        )
    if lowered.startswith("fleetops-trip-"):
        raise ValueError(
            "Scanned a trip receiving QR. Use the customer's Booking Completion QR to finish the booking."
        )

    if not expected or not expected_token:
        raise ValueError(
            "Booking Completion QR is not ready yet. Ask the customer to refresh after payment verification."
        )

    candidates = [expected, *expected_legacy]
    if any(_safe_compare(scanned, c) for c in candidates if c):
        return
    if _safe_compare(scanned, expected_token):
        return

    parsed = resolve_scanned_token(scanned=scanned, booking=booking)
    if not parsed:
        raise ValueError("Invalid Booking Completion QR code.")

    qr_booking_id, qr_token = parsed
    if int(qr_booking_id) != int(booking.id):
        raise ValueError("QR code does not match this booking.")
    if not qr_token or not _safe_compare(qr_token, expected_token):
        raise ValueError("QR verification code does not match this booking.")


def verify_booking_qr(
    db: Session,
    *,
    booking: Booking,
    payload: str,
    scanner: User,
    method: str = "scan",
    helper_trip_id: int | None = None,
) -> dict:
    """Validate Booking Completion QR and mark the booking completed when eligible."""
    from app.services.delivery_receiving_verification import assert_delivery_receiving_complete
    from app.services.toll_computation import finalize_trip_toll_on_completion
    from app.services.trip_status_sync import sync_trip_and_booking_status

    scanned = normalize_booking_qr_scan(payload)
    current_booking_id = int(booking.id)
    booking_status = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    payment_status = _payment_status_for_booking(db, current_booking_id)
    method_norm = _normalize_method(method)
    parsed = resolve_scanned_token(scanned=scanned, booking=booking)
    qr_booking_id = int(parsed[0]) if parsed else None

    logger.info(
        "booking_qr_verify Current helper booking=%s | QR booking=%s | "
        "Decoded payload=%s | Expected payload=%s | booking_status=%s | payment_status=%s",
        current_booking_id,
        qr_booking_id,
        scanned,
        booking_qr_payload(booking),
        booking_status,
        payment_status,
    )

    status = (booking_status or "").strip().lower()
    if status in _TERMINAL_INACTIVE:
        raise ValueError(f"Booking is {status}; QR verification is not allowed.")

    if status == BookingStatus.COMPLETED.value and getattr(booking, "booking_qr_verified_at", None):
        verified_at = booking.booking_qr_verified_at
        assert verified_at is not None
        return {
            "ok": True,
            "already_verified": True,
            "booking_id": current_booking_id,
            "verified_at": verified_at.isoformat(),
            "verification_method": getattr(booking, "booking_qr_verified_method", None) or method_norm,
            "completed": True,
            "message": "Booking Completion QR was already verified. This booking is completed.",
        }

    _assert_credential_matches(booking, scanned)

    trips = (
        db.query(Trip)
        .filter(Trip.booking_id == booking.id, Trip.status != TripStatus.CANCELLED)
        .order_by(Trip.id.asc())
        .with_for_update()
        .all()
    )
    if not trips:
        raise ValueError("No active delivery trips exist for this booking.")

    if helper_trip_id is not None:
        locked = next((t for t in trips if t.id == helper_trip_id), None)
        if not locked or locked.helper_id != scanner.id:
            raise ValueError("Trip not found for this helper.")

    not_arrived = [
        t.id
        for t in trips
        if t.status != TripStatus.COMPLETED
        and (t.helper_progress_status or "").strip().lower() != "dropped_off"
    ]
    if not_arrived:
        raise ValueError(
            "Every truck on this booking must reach Arrived at Destination before Booking Completion QR verification."
        )

    for delivery_trip in trips:
        if delivery_trip.status != TripStatus.COMPLETED:
            assert_delivery_receiving_complete(delivery_trip)

    already = getattr(booking, "booking_qr_verified_at", None) is not None
    if not already:
        booking.booking_qr_verified_at = datetime.utcnow()
        booking.booking_qr_verified_by_id = scanner.id
        booking.booking_qr_verified_method = method_norm[:16]

    completed_at = booking.booking_qr_verified_at or datetime.utcnow()
    # Keep legacy completion gates satisfied without requiring a second customer QR.
    if getattr(booking, "delivery_verification_used_at", None) is None:
        booking.delivery_verification_used_at = completed_at
        booking.delivery_verification_used_by_helper_id = scanner.id
        booking.delivery_verification_method = "qr" if method_norm == "qr_scan" else "code"

    completed_trip_ids: list[int] = []
    for delivery_trip in trips:
        if delivery_trip.status == TripStatus.COMPLETED:
            continue
        delivery_trip.arrival_delivery_time = delivery_trip.arrival_delivery_time or completed_at
        sync_trip_and_booking_status(
            db,
            delivery_trip.id,
            "completed",
            helper_id=scanner.id,
            location_name="Booking completion verified by customer",
            remarks=f"Final verification method: {method_norm}",
            delivery_verified=True,
        )
        finalize_trip_toll_on_completion(db, delivery_trip, booking)
        completed_trip_ids.append(int(delivery_trip.id))

    booking.actual_cost = round(
        sum(
            float(delivery_trip.fuel_cost or 0)
            + float(
                delivery_trip.toll_actual_total
                if delivery_trip.toll_actual_total is not None
                else delivery_trip.toll_cost or 0
            )
            + float(delivery_trip.labor_cost or 0)
            + float(delivery_trip.maintenance_cost or 0)
            for delivery_trip in trips
        ),
        2,
    )
    db.flush()

    verified_at = booking.booking_qr_verified_at
    assert verified_at is not None
    logger.info(
        "booking_qr_verify Verification Result: completed booking_id=%s trips=%s method=%s",
        current_booking_id,
        completed_trip_ids,
        method_norm,
    )
    return {
        "ok": True,
        "already_verified": already,
        "booking_id": current_booking_id,
        "trip_ids": completed_trip_ids,
        "verified_at": verified_at.isoformat(),
        "verification_method": getattr(booking, "booking_qr_verified_method", None) or method_norm,
        "completed": True,
        "message": "Booking Completion QR verified. The booking is now completed.",
    }
