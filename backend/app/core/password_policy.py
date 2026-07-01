"""Shared password strength rules for customer-facing auth flows."""

from __future__ import annotations

import re

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 72  # bcrypt practical limit

COMMON_WEAK_PASSWORDS = frozenset(
    {
        "password",
        "password123",
        "12345678",
        "qwerty",
        "admin123",
    }
)


def _normalized_for_weak_check(password: str) -> str:
    return re.sub(r"[^a-z0-9]", "", password.lower())


def _is_common_weak_password(password: str) -> bool:
    lowered = password.lower()
    if lowered in COMMON_WEAK_PASSWORDS:
        return True
    return _normalized_for_weak_check(password) in COMMON_WEAK_PASSWORDS


def validate_password_strength(password: str) -> None:
    """Raise ValueError with a user-friendly message when the password is weak."""
    if not password:
        raise ValueError("Password is required.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError("Password must be at least 8 characters.")

    if len(password) > MAX_PASSWORD_LENGTH:
        raise ValueError("Password must be at most 72 characters.")

    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must include at least one uppercase letter.")

    if not re.search(r"[a-z]", password):
        raise ValueError("Password must include at least one lowercase letter.")

    if not re.search(r"\d", password):
        raise ValueError("Password must include at least one number.")

    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("Password must include at least one special character.")

    if _is_common_weak_password(password):
        raise ValueError("This password is too common. Please choose a stronger password.")
