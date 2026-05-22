"""Cargo type classification and restricted-item screening (warnings only)."""

from __future__ import annotations

import json
from datetime import datetime

from app.constants.cargo_type_classification import (
    CARGO_TYPE_CATEGORY_LABELS,
    CATEGORY_KEYWORD_HINTS,
    GLOBAL_RESTRICTED_KEYWORDS,
    RESTRICTED_CARGO_TYPE_CATEGORIES,
)
from app.models.entities import Booking, CargoTypeCategory, User

CARGO_TYPE_CATEGORIES = frozenset(c.value for c in CargoTypeCategory)


def cargo_type_category_label(category: str | None) -> str:
    if not category:
        return "Not classified"
    return CARGO_TYPE_CATEGORY_LABELS.get(category, category.replace("_", " "))


def parse_cargo_restricted_reasons(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [part.strip() for part in raw.split("|") if part.strip()]


def serialize_cargo_restricted_reasons(reasons: list[str]) -> str | None:
    cleaned = [r.strip() for r in reasons if r.strip()]
    if not cleaned:
        return None
    return json.dumps(cleaned)


def screen_cargo_type(*, category: str | None, cargo_description: str | None) -> dict:
    """Return warning flags — never blocks validation."""
    reasons: list[str] = []
    desc = (cargo_description or "").strip().lower()

    if category:
        if category in RESTRICTED_CARGO_TYPE_CATEGORIES:
            reasons.append(
                f"Category flagged for restricted/special handling: {cargo_type_category_label(category)}."
            )
        for keyword, message in CATEGORY_KEYWORD_HINTS.get(category, ()):
            if keyword in desc:
                reasons.append(message)

    if desc:
        for keyword, message in GLOBAL_RESTRICTED_KEYWORDS:
            if keyword in desc:
                reasons.append(message)

    # De-duplicate while preserving order.
    seen: set[str] = set()
    unique: list[str] = []
    for reason in reasons:
        if reason not in seen:
            seen.add(reason)
            unique.append(reason)

    return {
        "restricted_flag": bool(unique),
        "reasons": unique,
        "category_label": cargo_type_category_label(category),
    }


def apply_cargo_type_validation(
    booking: Booking,
    *,
    validated: bool,
    category: str | None,
    reviewer: User,
    admin_notes: str | None = None,
) -> dict:
    normalized_category = (category or "").strip().lower() or None
    if normalized_category and normalized_category not in CARGO_TYPE_CATEGORIES:
        raise ValueError("Invalid cargo type category.")

    desc = (booking.cargo_description or "").strip()
    if validated and not normalized_category:
        raise ValueError("Cargo type category is required before validation.")
    if validated and len(desc) < 3:
        raise ValueError("Cargo description is required before cargo type validation.")

    if normalized_category is not None:
        booking.cargo_type_category = normalized_category
    if admin_notes is not None:
        booking.cargo_type_admin_notes = admin_notes.strip() or None

    screening = screen_cargo_type(
        category=booking.cargo_type_category,
        cargo_description=booking.cargo_description,
    )
    booking.cargo_restricted_flag = bool(screening["restricted_flag"])
    booking.cargo_restricted_reasons = serialize_cargo_restricted_reasons(screening["reasons"])

    if validated:
        booking.cargo_type_validated = True
        booking.cargo_type_validated_by_id = reviewer.id
        booking.cargo_type_validated_at = datetime.utcnow()
    else:
        booking.cargo_type_validated = False
        booking.cargo_type_validated_by_id = None
        booking.cargo_type_validated_at = None

    return screening
