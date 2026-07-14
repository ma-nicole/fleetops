"""Normalize phone numbers to E.164 without trunk-prefix mistakes (e.g. +6309… → +639…)."""

from __future__ import annotations

import re

# Country codes that use a leading trunk "0" in national dialing.
_TRUNK_ZERO_COUNTRY_CODES = (
    "63",  # Philippines
    "44",  # UK
    "61",  # Australia
    "353",  # Ireland
    "33",  # France
    "49",  # Germany
    "39",  # Italy
)


def normalize_e164_phone(value: str | None) -> str | None:
    """
    Return a cleaned +E.164 phone, or None if empty.

    Fixes common PH mistake: country +63 with local 09… becoming +6309… (invalid).
    Correct form: +639…
    """
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None

    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None

    # Local PH mobile typed without country code.
    if digits.startswith("09") and len(digits) == 11:
        digits = "63" + digits[1:]
    elif digits.startswith("9") and len(digits) == 10 and not raw.startswith("+"):
        digits = "63" + digits

    # Strip one trunk 0 immediately after the country calling code.
    for cc in sorted(_TRUNK_ZERO_COUNTRY_CODES, key=len, reverse=True):
        if digits.startswith(cc) and len(digits) > len(cc) and digits[len(cc)] == "0":
            digits = cc + digits[len(cc) + 1 :]
            break

    if len(digits) < 8:
        return f"+{digits}" if digits else None
    return f"+{digits}"
