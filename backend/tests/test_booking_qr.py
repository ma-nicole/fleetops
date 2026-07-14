"""Unit tests for booking QR generation / verification matching."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.models.entities import BookingStatus
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
        "status": BookingStatus.ASSIGNED,
        "booking_qr_token": "AbCdEfGhIjKl-MnOpQr",
        "booking_qr_verified_at": None,
        "booking_qr_verified_by_id": None,
        "booking_qr_verified_method": None,
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


def test_verify_accepts_canonical_and_legacy_for_same_booking():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    scanner = SimpleNamespace(id=9)

    b = _booking()
    out = verify_booking_qr(db, booking=b, payload=booking_qr_payload(b), scanner=scanner, method="camera")
    assert out["ok"] is True
    assert out["booking_id"] == 231
    assert b.booking_qr_verified_at is not None
    assert b.booking_qr_verified_method == "camera"

    b2 = _booking(booking_qr_verified_at=None, booking_qr_verified_method=None)
    out2 = verify_booking_qr(
        db,
        booking=b2,
        payload="FLEETOPS-BOOKING:231:AbCdEfGhIjKl-MnOpQr",
        scanner=scanner,
        method="manual",
    )
    assert out2["ok"] is True


def test_verify_rejects_other_booking_id():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    scanner = SimpleNamespace(id=9)
    b = _booking(id=231)
    other = "booking=999|code=AbCdEfGhIjKl-MnOpQr"
    with pytest.raises(ValueError, match="does not match this booking"):
        verify_booking_qr(db, booking=b, payload=other, scanner=scanner)


def test_verify_rejects_delivery_qr_clearly():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    scanner = SimpleNamespace(id=9)
    b = _booking()
    with pytest.raises(ValueError, match="Delivery QR"):
        verify_booking_qr(
            db,
            booking=b,
            payload="FLEETOPS-DELIVERY:231:12:sometoken",
            scanner=scanner,
        )


def test_verify_normalizes_string_booking_ids():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    scanner = SimpleNamespace(id=9)
    b = _booking(id="231")
    out = verify_booking_qr(
        db,
        booking=b,
        payload="booking=231|code=AbCdEfGhIjKl-MnOpQr",
        scanner=scanner,
        method="manual",
    )
    assert out["ok"] is True
    assert out["verification_method"] == "manual"


def test_verify_accepts_bare_verification_code():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    scanner = SimpleNamespace(id=9)
    b = _booking()
    out = verify_booking_qr(
        db,
        booking=b,
        payload="AbCdEfGhIjKl-MnOpQr",
        scanner=scanner,
        method="manual",
    )
    assert out["ok"] is True


def test_verify_rejects_cancelled():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    scanner = SimpleNamespace(id=9)
    b = _booking(status=BookingStatus.CANCELLED)
    with pytest.raises(ValueError, match="cancelled"):
        verify_booking_qr(db, booking=b, payload=booking_qr_payload(b), scanner=scanner)

