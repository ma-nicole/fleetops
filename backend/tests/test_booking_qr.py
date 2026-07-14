"""Unit tests for booking QR generation / credential matching."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.models.entities import BookingStatus, TripStatus
from app.services.booking_qr import (
    booking_qr_legacy_payloads,
    booking_qr_payload,
    ensure_booking_qr_token,
    normalize_booking_qr_scan,
    parse_booking_qr_payload,
    verify_booking_qr,
)


def _booking(**kwargs):
    defaults = {
        "id": 231,
        "customer_id": 12,
        "status": BookingStatus.ASSIGNED,
        "booking_qr_token": "AbCdEfGhIjKl-MnOpQr",
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


def _trip(**kwargs):
    defaults = {
        "id": 77,
        "helper_id": 9,
        "status": TripStatus.IN_DELIVERY,
        "helper_progress_status": "dropped_off",
        "arrival_delivery_time": None,
        "fuel_cost": 0,
        "toll_cost": 0,
        "toll_actual_total": None,
        "labor_cost": 0,
        "maintenance_cost": 0,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_canonical_payload_is_pipe_format():
    b = _booking()
    ensure_booking_qr_token(b)
    payload = booking_qr_payload(b)
    assert payload == "booking=231|code=AbCdEfGhIjKl-MnOpQr"
    assert parse_booking_qr_payload(payload) == (231, "AbCdEfGhIjKl-MnOpQr")


def test_legacy_formats_still_parse():
    b = _booking()
    legacy = booking_qr_legacy_payloads(b)
    assert legacy == [
        "FLEETOPS-BOOKING:231:AbCdEfGhIjKl-MnOpQr",
        "FLEETOPS-BOOKING-231-AbCdEfGhIjKl-MnOpQr",
    ]
    for item in legacy:
        assert parse_booking_qr_payload(item) == (231, "AbCdEfGhIjKl-MnOpQr")


def test_normalize_strips_url_encoding_and_wrappers():
    raw = "  booking%3D231%7Ccode%3Dtok%2Den%20extra"
    assert normalize_booking_qr_scan(raw) == "booking=231|code=tok-en"


def _mock_db_with_trip(trip):
    db = MagicMock()

    def query(_model, *_a, **_k):
        m = MagicMock()
        m.filter.return_value.order_by.return_value.first.return_value = None
        m.filter.return_value.order_by.return_value.with_for_update.return_value.all.return_value = [trip]
        return m

    db.query.side_effect = query
    return db


@patch("app.services.trip_status_sync.sync_trip_and_booking_status")
@patch("app.services.delivery_receiving_verification.assert_delivery_receiving_complete")
@patch("app.services.toll_computation.finalize_trip_toll_on_completion")
def test_verify_completes_booking(mock_toll, mock_recv, mock_sync):
    trip = _trip()
    db = _mock_db_with_trip(trip)
    scanner = SimpleNamespace(id=9)
    b = _booking()
    out = verify_booking_qr(
        db,
        booking=b,
        payload=booking_qr_payload(b),
        scanner=scanner,
        method="camera",
        helper_trip_id=77,
    )
    assert out["ok"] is True
    assert out["completed"] is True
    assert b.booking_qr_verified_at is not None
    assert b.booking_qr_verified_method == "qr_scan"
    mock_sync.assert_called()
    mock_recv.assert_called()


@patch("app.services.trip_status_sync.sync_trip_and_booking_status")
@patch("app.services.delivery_receiving_verification.assert_delivery_receiving_complete")
@patch("app.services.toll_computation.finalize_trip_toll_on_completion")
def test_verify_accepts_legacy_and_bare_code(mock_toll, mock_recv, mock_sync):
    scanner = SimpleNamespace(id=9)
    b = _booking()
    db = _mock_db_with_trip(_trip())
    out = verify_booking_qr(
        db,
        booking=b,
        payload="FLEETOPS-BOOKING:231:AbCdEfGhIjKl-MnOpQr",
        scanner=scanner,
        method="manual",
        helper_trip_id=77,
    )
    assert out["ok"] is True
    assert out["verification_method"] == "manual"

    b2 = _booking()
    db2 = _mock_db_with_trip(_trip())
    out2 = verify_booking_qr(
        db2,
        booking=b2,
        payload="AbCdEfGhIjKl-MnOpQr",
        scanner=scanner,
        method="manual",
        helper_trip_id=77,
    )
    assert out2["ok"] is True


def test_verify_rejects_other_booking_id():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    scanner = SimpleNamespace(id=9)
    b = _booking(id=231)
    with pytest.raises(ValueError, match="Booking #999"):
        verify_booking_qr(db, booking=b, payload="booking=999|code=AbCdEfGhIjKl-MnOpQr", scanner=scanner)


def test_verify_accepts_delivery_qr_and_short_code():
    """Root-cause regression: customer shows FLEETOPS-DELIVERY / XXXX-XXXX; helper must accept it."""
    scanner = SimpleNamespace(id=9)

    with (
        patch("app.services.trip_status_sync.sync_trip_and_booking_status"),
        patch("app.services.delivery_receiving_verification.assert_delivery_receiving_complete"),
        patch("app.services.toll_computation.finalize_trip_toll_on_completion"),
    ):
        b = _booking(
            customer_id=12,
            delivery_verification_token="delivTokenUrlSafeValue0001",
            delivery_verification_code="ABCD-EFGH",
            delivery_verification_used_at=None,
        )
        delivery_payload = f"FLEETOPS-DELIVERY:{b.id}:{b.customer_id}:{b.delivery_verification_token}"
        out = verify_booking_qr(
            db=_mock_db_with_trip(_trip()),
            booking=b,
            payload=delivery_payload,
            scanner=scanner,
            method="camera",
            helper_trip_id=77,
        )
        assert out["ok"] is True
        assert out["match_kind"] == "delivery_qr"
        assert b.delivery_verification_used_at is not None

        b2 = _booking(
            customer_id=12,
            delivery_verification_token="delivTokenUrlSafeValue0002",
            delivery_verification_code="WXYZ-2345",
            delivery_verification_used_at=None,
        )
        out2 = verify_booking_qr(
            db=_mock_db_with_trip(_trip()),
            booking=b2,
            payload="wxyz2345",
            scanner=scanner,
            method="manual",
            helper_trip_id=77,
        )
        assert out2["ok"] is True
        assert out2["match_kind"] == "delivery_code"


def test_verify_rejects_delivery_qr_clearly():
    """Trip receiving QR is rejected; Delivery Verification QR is accepted elsewhere."""
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    scanner = SimpleNamespace(id=9)
    b = _booking()
    with pytest.raises(ValueError, match="trip receiving QR"):
        verify_booking_qr(
            db,
            booking=b,
            payload="FLEETOPS-TRIP-77:sometoken",
            scanner=scanner,
        )


def test_verify_rejects_cancelled():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    scanner = SimpleNamespace(id=9)
    b = _booking(status=BookingStatus.CANCELLED)
    with pytest.raises(ValueError, match="cancelled"):
        verify_booking_qr(db, booking=b, payload=booking_qr_payload(b), scanner=scanner)


@patch("app.services.trip_status_sync.sync_trip_and_booking_status")
@patch("app.services.delivery_receiving_verification.assert_delivery_receiving_complete")
@patch("app.services.toll_computation.finalize_trip_toll_on_completion")
def test_verify_requires_dropped_off(mock_toll, mock_recv, mock_sync):
    trip = _trip(helper_progress_status="en_route")
    db = _mock_db_with_trip(trip)
    scanner = SimpleNamespace(id=9)
    with pytest.raises(ValueError, match="Arrived at Destination"):
        verify_booking_qr(
            db,
            booking=_booking(),
            payload="booking=231|code=AbCdEfGhIjKl-MnOpQr",
            scanner=scanner,
            helper_trip_id=77,
        )
    mock_sync.assert_not_called()
