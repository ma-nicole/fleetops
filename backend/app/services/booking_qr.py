"""Booking Completion QR — customer credential verified by helper at delivery completion.

Canonical flow (do not redesign):
  Payment verified → customer Booking Completion QR (`booking={id}|code={token}`)
  → helper scans (or pastes code) → booking completed

Also accepts Delivery Verification credentials as a secondary compatibility path when present.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from secrets import compare_digest, token_urlsafe
from urllib.parse import unquote

from sqlalchemy.orm import Session

from app.models.entities import Booking, BookingStatus, Payment, Trip, TripStatus, User

logger = logging.getLogger(__name__)

# Canonical Booking Completion formats
_PIPE_RE = re.compile(r"^booking\s*=\s*(\d+)\s*\|\s*code\s*=\s*(.+)$", re.IGNORECASE)
_COLON_RE = re.compile(r"^FLEETOPS-BOOKING:(\d+):(.+)$", re.IGNORECASE)
_LEGACY_DASH_RE = re.compile(r"^FLEETOPS-BOOKING-(\d+)-(.+)$", re.IGNORECASE)
# Secondary compatibility
_DELIVERY_RE = re.compile(r"^FLEETOPS-DELIVERY:(\d+):(\d+):(.+)$", re.IGNORECASE)

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
    # Temporary diagnostic logging — always emit on generate path.
    booking_status = (
        booking.status.value if hasattr(getattr(booking, "status", None), "value") else getattr(booking, "status", None)
    )
    logger.info(
        "booking_qr_generate GENERATED_QR_PAYLOAD=%s | BOOKING_ID=%s | VERIFICATION_CODE=%s | "
        "created=%s | payment_status=%s | booking_status=%s",
        payload,
        int(booking.id),
        token,
        created,
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


def parse_delivery_qr_payload(raw: str) -> tuple[int, int, str] | None:
    text = normalize_booking_qr_scan(raw)
    match = _DELIVERY_RE.match(text)
    if not match:
        return None
    try:
        booking_id = int(match.group(1))
        customer_id = int(match.group(2))
    except ValueError:
        return None
    token = (match.group(3) or "").strip()
    if booking_id <= 0 or customer_id <= 0 or not token:
        return None
    return booking_id, customer_id, token


def resolve_scanned_token(*, scanned: str, booking: Booking) -> tuple[int, str] | None:
    """Parse Booking Completion payload, or accept bare verification code for this booking."""
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


def _matches_delivery_credentials(booking: Booking, scanned: str) -> tuple[bool, str]:
    """Secondary compatibility with Delivery Verification QR / short code."""
    from app.services.delivery_verification import normalize_verification_code

    delivery = parse_delivery_qr_payload(scanned)
    if delivery:
        qr_booking_id, qr_customer_id, qr_token = delivery
        if int(qr_booking_id) != int(booking.id):
            return False, "delivery_qr_wrong_booking"
        expected_customer = int(getattr(booking, "customer_id", 0) or 0)
        if expected_customer and int(qr_customer_id) != expected_customer:
            return False, "delivery_qr_wrong_customer"
        expected_token = (getattr(booking, "delivery_verification_token", None) or "").strip()
        if not expected_token or not _safe_compare(qr_token, expected_token):
            return False, "delivery_qr_token_mismatch"
        return True, "delivery_qr"

    expected_code = normalize_verification_code(getattr(booking, "delivery_verification_code", None) or "")
    supplied_code = normalize_verification_code(scanned)
    if expected_code and supplied_code and _safe_compare(supplied_code, expected_code):
        return True, "delivery_code"

    return False, "no_delivery_match"


def _assert_credential_matches(booking: Booking, scanned: str) -> str:
    """
    Validate Booking Completion QR / manual code first.
    Returns match kind for logging. Does not bypass verification.
    """
    expected = booking_qr_payload(booking)
    expected_legacy = booking_qr_legacy_payloads(booking)
    expected_token = (getattr(booking, "booking_qr_token", None) or "").strip()
    current_id = int(booking.id)

    lowered = scanned.lower()
    if lowered.startswith("fleetops-trip-"):
        logger.warning(
            "booking_qr_assert FAIL_POINT=wrong_qr_type scanned=%s current_booking=%s",
            scanned,
            current_id,
        )
        raise ValueError(
            "Scanned a trip receiving QR. Use the customer's Booking Completion QR to finish the booking."
        )

    if not expected or not expected_token:
        logger.warning(
            "booking_qr_assert FAIL_POINT=qr_not_ready current_booking=%s has_token=%s",
            current_id,
            bool(expected_token),
        )
        raise ValueError(
            "Booking Completion QR is not ready yet. Ask the customer to refresh after payment verification."
        )

    # 1) Exact Booking Completion payload / legacy forms
    candidates = [c for c in [expected, *expected_legacy] if c]
    for cand in candidates:
        if _safe_compare(scanned, cand):
            logger.info(
                "booking_qr_assert MATCH=booking_qr_payload current_booking=%s expected=%s scanned=%s",
                current_id,
                expected,
                scanned,
            )
            return "booking_qr_payload"

    # 2) Bare verification code (token)
    if _safe_compare(scanned, expected_token):
        logger.info(
            "booking_qr_assert MATCH=booking_qr_bare_token current_booking=%s",
            current_id,
        )
        return "booking_qr_bare_token"

    # 3) Parsed Booking Completion payload (tolerates minor encode differences)
    parsed = resolve_scanned_token(scanned=scanned, booking=booking)
    if parsed:
        qr_booking_id, qr_token = parsed
        if int(qr_booking_id) != current_id:
            logger.warning(
                "booking_qr_assert FAIL_POINT=booking_id_mismatch scanned_booking=%s current_booking=%s "
                "scanned=%s expected=%s",
                qr_booking_id,
                current_id,
                scanned,
                expected,
            )
            raise ValueError(
                f"QR code is for Booking #{qr_booking_id}, but this assignment is Booking #{current_id}."
            )
        if qr_token and _safe_compare(qr_token, expected_token):
            logger.info(
                "booking_qr_assert MATCH=booking_qr_parsed current_booking=%s scanned=%s",
                current_id,
                scanned,
            )
            return "booking_qr_parsed"
        logger.warning(
            "booking_qr_assert FAIL_POINT=token_mismatch current_booking=%s scanned_token_len=%s "
            "expected_token_len=%s scanned=%s expected=%s",
            current_id,
            len(qr_token or ""),
            len(expected_token),
            scanned,
            expected,
        )
        raise ValueError("QR verification code does not match this booking.")

    # 4) Secondary: Delivery Verification (compat only)
    delivery_ok, delivery_kind = _matches_delivery_credentials(booking, scanned)
    if delivery_ok:
        logger.info(
            "booking_qr_assert MATCH=%s current_booking=%s scanned=%s (compat path)",
            delivery_kind,
            current_id,
            scanned,
        )
        return delivery_kind
    if delivery_kind == "delivery_qr_wrong_booking":
        delivery = parse_delivery_qr_payload(scanned)
        logger.warning(
            "booking_qr_assert FAIL_POINT=booking_id_mismatch scanned_booking=%s current_booking=%s scanned=%s",
            delivery[0] if delivery else None,
            current_id,
            scanned,
        )
        raise ValueError(
            f"QR code is for Booking #{delivery[0] if delivery else '?'}, but this assignment is Booking #{current_id}."
        )
    if delivery_kind in {"delivery_qr_wrong_customer", "delivery_qr_token_mismatch"}:
        logger.warning(
            "booking_qr_assert FAIL_POINT=%s current_booking=%s scanned=%s",
            delivery_kind,
            current_id,
            scanned,
        )
        raise ValueError("QR verification code does not match this booking.")

    logger.warning(
        "booking_qr_assert FAIL_POINT=payload_format_mismatch current_booking=%s scanned=%s "
        "expected_booking_qr=%s scanned_len=%s expected_len=%s",
        current_id,
        scanned,
        expected,
        len(scanned),
        len(expected or ""),
    )
    raise ValueError(
        "Invalid Booking Completion QR code. Scan the customer's Booking Completion QR, "
        "or paste the exact code shown on their booking card."
    )


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

    raw_payload = payload or ""
    scanned = normalize_booking_qr_scan(raw_payload)
    current_booking_id = int(booking.id)
    booking_status = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    payment_status = _payment_status_for_booking(db, current_booking_id)
    method_norm = _normalize_method(method)

    pipe_parsed = parse_booking_qr_payload(scanned)
    delivery_parsed = parse_delivery_qr_payload(scanned)
    qr_booking_id = (
        int(pipe_parsed[0])
        if pipe_parsed
        else (int(delivery_parsed[0]) if delivery_parsed else None)
    )
    verification_code = (getattr(booking, "booking_qr_token", None) or "").strip() or None
    expected_payload = booking_qr_payload(booking)

    # Temporary diagnostic block — requested audit fields.
    logger.info(
        "booking_qr_verify ENDPOINT=POST /helper/bookings/{id}/verify-qr | "
        "GENERATED_QR_PAYLOAD=%s | QR_DECODED_PAYLOAD=%s | RAW_PAYLOAD=%s | "
        "BOOKING_ID_FROM_QR=%s | VERIFICATION_CODE=%s | CURRENT_BOOKING=%s | "
        "EXPECTED_BOOKING=%s | method=%s | booking_status=%s | payment_status=%s",
        expected_payload,
        scanned,
        raw_payload[:512],
        qr_booking_id,
        verification_code,
        current_booking_id,
        current_booking_id,
        method_norm,
        booking_status,
        payment_status,
    )

    status = (booking_status or "").strip().lower()
    if status in _TERMINAL_INACTIVE:
        logger.warning(
            "booking_qr_verify VERIFICATION_RESULT=rejected FAIL_POINT=inactive_status "
            "current_booking=%s status=%s",
            current_booking_id,
            status,
        )
        raise ValueError(f"Booking is {status}; QR verification is not allowed.")

    if status == BookingStatus.COMPLETED.value and getattr(booking, "booking_qr_verified_at", None):
        verified_at = booking.booking_qr_verified_at
        assert verified_at is not None
        logger.info(
            "booking_qr_verify VERIFICATION_RESULT=already_verified current_booking=%s",
            current_booking_id,
        )
        return {
            "ok": True,
            "already_verified": True,
            "booking_id": current_booking_id,
            "verified_at": verified_at.isoformat(),
            "verification_method": getattr(booking, "booking_qr_verified_method", None) or method_norm,
            "completed": True,
            "message": "Booking Completion QR was already verified. This booking is completed.",
        }

    try:
        match_kind = _assert_credential_matches(booking, scanned)
    except ValueError as exc:
        logger.warning(
            "booking_qr_verify VERIFICATION_RESULT=rejected FAIL_POINT=credential | reason=%s | "
            "decoded=%s | current_booking=%s | qr_booking=%s | expected=%s",
            str(exc),
            scanned,
            current_booking_id,
            qr_booking_id,
            expected_payload,
        )
        raise

    trips = (
        db.query(Trip)
        .filter(Trip.booking_id == booking.id, Trip.status != TripStatus.CANCELLED)
        .order_by(Trip.id.asc())
        .with_for_update()
        .all()
    )
    if not trips:
        logger.warning(
            "booking_qr_verify VERIFICATION_RESULT=rejected FAIL_POINT=no_trips current_booking=%s",
            current_booking_id,
        )
        raise ValueError("No active delivery trips exist for this booking.")

    if helper_trip_id is not None:
        locked = next((t for t in trips if t.id == helper_trip_id), None)
        if not locked or locked.helper_id != scanner.id:
            logger.warning(
                "booking_qr_verify VERIFICATION_RESULT=rejected FAIL_POINT=helper_trip_mismatch "
                "current_booking=%s helper_trip_id=%s scanner=%s",
                current_booking_id,
                helper_trip_id,
                scanner.id,
            )
            raise ValueError("Trip not found for this helper.")

    not_arrived = [
        t.id
        for t in trips
        if t.status != TripStatus.COMPLETED
        and (t.helper_progress_status or "").strip().lower() != "dropped_off"
    ]
    if not_arrived:
        logger.warning(
            "booking_qr_verify VERIFICATION_RESULT=rejected FAIL_POINT=not_arrived "
            "current_booking=%s trip_ids=%s",
            current_booking_id,
            not_arrived,
        )
        raise ValueError(
            "Every truck on this booking must reach Arrived at Destination before Booking Completion QR verification."
        )

    for delivery_trip in trips:
        if delivery_trip.status != TripStatus.COMPLETED:
            try:
                assert_delivery_receiving_complete(delivery_trip)
            except Exception as exc:
                logger.warning(
                    "booking_qr_verify VERIFICATION_RESULT=rejected FAIL_POINT=receiving_incomplete "
                    "current_booking=%s trip_id=%s reason=%s",
                    current_booking_id,
                    delivery_trip.id,
                    exc,
                )
                raise

    already = getattr(booking, "booking_qr_verified_at", None) is not None
    if not already:
        booking.booking_qr_verified_at = datetime.utcnow()
        booking.booking_qr_verified_by_id = scanner.id
        booking.booking_qr_verified_method = method_norm[:16]

    completed_at = booking.booking_qr_verified_at or datetime.utcnow()
    # Satisfy legacy delivery_verification gates without a second customer credential.
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
            remarks=f"Final verification method: {method_norm} ({match_kind})",
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
        "booking_qr_verify VERIFICATION_RESULT=completed current_booking=%s trips=%s "
        "method=%s match=%s booking_status_now=%s",
        current_booking_id,
        completed_trip_ids,
        method_norm,
        match_kind,
        booking.status.value if hasattr(booking.status, "value") else booking.status,
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
        "match_kind": match_kind,
    }
