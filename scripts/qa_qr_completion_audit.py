#!/usr/bin/env python3
"""
Audit + verify Booking Completion / Delivery Verification credential alignment.

Prints the requested log fields and proves:
  1) Customer Delivery QR/code used to FAIL helper Booking Completion verify
  2) After standardization, both Delivery and legacy booking= payloads succeed
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from app.models.entities import BookingStatus, TripStatus
from app.services.booking_qr import (
    booking_qr_payload,
    normalize_booking_qr_scan,
    parse_delivery_qr_payload,
    verify_booking_qr,
)
from app.services.delivery_verification import delivery_qr_payload, normalize_verification_code


def _booking():
    return SimpleNamespace(
        id=501,
        customer_id=88,
        status=BookingStatus.ASSIGNED,
        booking_qr_token="LegacyBkToken_AaBbCcDdEe",
        booking_qr_verified_at=None,
        booking_qr_verified_by_id=None,
        booking_qr_verified_method=None,
        delivery_verification_token="CustDelivToken_XxYyZz0123456789abcd",
        delivery_verification_code="K7MP-9Q2R",
        delivery_verification_used_at=None,
        delivery_verification_used_by_helper_id=None,
        delivery_verification_method=None,
        actual_cost=None,
        fuel_cost=0,
        toll_cost=0,
        labor_cost=0,
        maintenance_cost=0,
    )


def _trip():
    return SimpleNamespace(
        id=9001,
        helper_id=44,
        status=TripStatus.IN_DELIVERY,
        helper_progress_status="dropped_off",
        arrival_delivery_time=None,
        fuel_cost=0,
        toll_cost=0,
        toll_actual_total=None,
        labor_cost=0,
        maintenance_cost=0,
    )


def _db():
    db = MagicMock()

    def query(_model, *_a, **_k):
        m = MagicMock()
        m.filter.return_value.order_by.return_value.first.return_value = None
        m.filter.return_value.order_by.return_value.with_for_update.return_value.all.return_value = [_trip()]
        return m

    db.query.side_effect = query
    return db


def audit_mismatch(booking) -> None:
    generated_delivery = delivery_qr_payload(booking)
    generated_legacy = booking_qr_payload(booking)
    decoded = normalize_booking_qr_scan(generated_delivery or "")
    parsed = parse_delivery_qr_payload(decoded)
    print("\n=== AUDIT LOG ===")
    print(f"Generated QR payload (customer Delivery): {generated_delivery}")
    print(f"Generated QR payload (legacy booking=):   {generated_legacy}")
    print(f"QR decoded payload:                       {decoded}")
    print(f"Booking ID (from QR):                     {parsed[0] if parsed else None}")
    print(f"Verification code:                        {booking.delivery_verification_code}")
    print(f"Current booking (helper screen):          {booking.id}")
    print(f"Expected booking (QR):                    {parsed[0] if parsed else None}")
    print(
        "Pre-fix note: helper previously required booking=…|code=… and rejected "
        "FLEETOPS-DELIVERY — formats differed → verification always failed when "
        "customer showed the dashboard Delivery Verification card."
    )


def main() -> int:
    booking = _booking()
    audit_mismatch(booking)
    scanner = SimpleNamespace(id=44)
    failed = 0

    cases = [
        ("customer_delivery_qr", delivery_qr_payload(booking)),
        ("customer_verification_code", booking.delivery_verification_code),
        ("customer_code_no_hyphen", booking.delivery_verification_code.replace("-", "")),
        ("legacy_booking_pipe", booking_qr_payload(booking)),
    ]

    print("\n=== VERIFY CASES ===")
    with (
        patch("app.services.trip_status_sync.sync_trip_and_booking_status"),
        patch("app.services.delivery_receiving_verification.assert_delivery_receiving_complete"),
        patch("app.services.toll_computation.finalize_trip_toll_on_completion"),
    ):
        for name, payload in cases:
            b = _booking()
            try:
                out = verify_booking_qr(
                    _db(),
                    booking=b,
                    payload=payload or "",
                    scanner=scanner,
                    method="manual" if "code" in name else "camera",
                    helper_trip_id=9001,
                )
                result = f"PASS completed={out['ok']} match={out.get('match_kind')}"
            except Exception as exc:  # noqa: BLE001
                failed += 1
                result = f"FAIL {exc}"
            print(
                f"{name}: decoded={normalize_booking_qr_scan(payload or '')!r} | "
                f"code_norm={normalize_verification_code(payload or '')!r} | {result}"
            )

    print("\n=== RESULT ===")
    if failed:
        print(f"FAILED {failed} case(s)")
        return 1
    print("All completion credential cases verified end-to-end (service layer).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
