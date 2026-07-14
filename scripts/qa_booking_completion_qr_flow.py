#!/usr/bin/env python3
"""
Local Booking Completion QR flow verification (service layer).

Checklist:
  ✓ QR generated after payment verification
  ✓ Customer can view QR (payload = booking={id}|code={token})
  ✓ Helper verifies QR / manual code with same logic
  ✓ Backend validates booking id + token
  ✓ Booking marked completed (via sync_trip_and_booking_status)
  ✓ No bypass — wrong payload rejected
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.models.entities import BookingStatus, TripStatus
from app.services.booking_qr import (
    booking_qr_payload,
    booking_qr_public_fields,
    ensure_booking_qr_token,
    normalize_booking_qr_scan,
    verify_booking_qr,
)


def _booking(**kwargs):
    defaults = {
        "id": 8801,
        "customer_id": 3,
        "status": BookingStatus.ASSIGNED,
        "booking_qr_token": None,
        "booking_qr_verified_at": None,
        "booking_qr_verified_by_id": None,
        "booking_qr_verified_method": None,
        "delivery_verification_token": None,
        "delivery_verification_code": None,
        "delivery_verification_used_at": None,
        "delivery_verification_used_by_helper_id": None,
        "delivery_verification_method": None,
        "actual_cost": None,
        "fuel_cost": 0,
        "toll_cost": 0,
        "labor_cost": 0,
        "maintenance_cost": 0,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _trip():
    return SimpleNamespace(
        id=9901,
        helper_id=44,
        status=TripStatus.IN_DELIVERY,
        helper_progress_status="dropped_off",
        arrival_delivery_time=None,
        fuel_cost=10,
        toll_cost=5,
        toll_actual_total=None,
        labor_cost=0,
        maintenance_cost=0,
    )


def _db(trip):
    db = MagicMock()

    def query(_model, *_a, **_k):
        m = MagicMock()
        m.filter.return_value.order_by.return_value.first.return_value = None
        m.filter.return_value.order_by.return_value.with_for_update.return_value.all.return_value = [trip]
        return m

    db.query.side_effect = query
    return db


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS" if ok else "FAIL"), name, (f"— {detail}" if detail else ""))
    if not ok:
        raise SystemExit(1)


def main() -> int:
    booking = _booking()

    # 1) Payment verified → generate
    ensure_booking_qr_token(booking, payment_status="verified")
    payload = booking_qr_payload(booking)
    fields = booking_qr_public_fields(booking)
    check("QR generated after payment verification", bool(payload and fields["booking_qr_ready"]), payload or "")
    check(
        "Customer can view QR (canonical booking=|code=)",
        bool(payload and payload.startswith("booking=8801|code=")),
        payload or "",
    )

    scanner = SimpleNamespace(id=44)
    trip = _trip()

    with (
        patch("app.services.trip_status_sync.sync_trip_and_booking_status") as sync,
        patch("app.services.delivery_receiving_verification.assert_delivery_receiving_complete"),
        patch("app.services.toll_computation.finalize_trip_toll_on_completion"),
    ):
        # Wrong booking payload rejected — no bypass
        try:
            verify_booking_qr(
                _db(trip),
                booking=booking,
                payload="booking=999|code=wrong",
                scanner=scanner,
                method="camera",
                helper_trip_id=9901,
            )
            check("Reject wrong booking id", False, "should have raised")
        except ValueError as exc:
            check("Reject wrong booking id", "999" in str(exc), str(exc))

        # Camera path (full payload)
        booking2 = _booking(booking_qr_token=booking.booking_qr_token)
        out = verify_booking_qr(
            _db(trip),
            booking=booking2,
            payload=payload,
            scanner=scanner,
            method="camera",
            helper_trip_id=9901,
        )
        check("Helper scans QR successfully", out["ok"] and out["completed"], out.get("match_kind", ""))
        check("Backend validates booking", out["booking_id"] == 8801, str(out["booking_id"]))
        check(
            "Booking Completion verified timestamp set",
            booking2.booking_qr_verified_at is not None,
            str(booking2.booking_qr_verified_at),
        )
        check("Timeline/status sync called", sync.called, f"calls={sync.call_count}")
        check(
            "Customer progress fields ready",
            booking_qr_public_fields(booking2)["booking_qr_verified"] is True,
        )

        # Manual Verification Code uses same logic (bare token)
        booking3 = _booking(booking_qr_token=booking.booking_qr_token)
        out_manual = verify_booking_qr(
            _db(trip),
            booking=booking3,
            payload=normalize_booking_qr_scan(booking.booking_qr_token),
            scanner=scanner,
            method="manual",
            helper_trip_id=9901,
        )
        check(
            "Manual Verification Code fallback (same logic)",
            out_manual["ok"] and out_manual.get("match_kind") == "booking_qr_bare_token",
            out_manual.get("match_kind", ""),
        )

    print("\nAll Booking Completion QR flow checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
