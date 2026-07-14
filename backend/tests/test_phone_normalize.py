"""Tests for E.164 phone normalization (PH trunk 0)."""

from app.services.phone_normalize import normalize_e164_phone


def test_strips_trunk_zero_after_ph_country_code():
    assert normalize_e164_phone("+630921713032") == "+63921713032"
    assert normalize_e164_phone("+63 09 217 13032") == "+63921713032"


def test_local_ph_mobile_to_e164():
    assert normalize_e164_phone("09217130321") == "+639217130321"
    assert normalize_e164_phone("9217130321") == "+639217130321"


def test_already_correct_unchanged():
    assert normalize_e164_phone("+639217130321") == "+639217130321"


def test_empty():
    assert normalize_e164_phone(None) is None
    assert normalize_e164_phone("  ") is None
