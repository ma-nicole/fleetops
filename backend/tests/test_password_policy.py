import pytest

from app.core.password_policy import validate_password_strength


def test_valid_password_passes():
    validate_password_strength("SecureP@ss1")


@pytest.mark.parametrize(
    "password,message",
    [
        ("", "Password is required."),
        ("short1!", "Password must be at least 8 characters."),
        ("nouppercase1!", "Password must include at least one uppercase letter."),
        ("NOLOWERCASE1!", "Password must include at least one lowercase letter."),
        ("NoNumbers!!", "Password must include at least one number."),
        ("NoSpecial1", "Password must include at least one special character."),
        ("password", "Password must include at least one uppercase letter."),
        ("Password123!", "This password is too common."),
        ("Admin123!", "This password is too common."),
    ],
)
def test_invalid_passwords(password: str, message: str):
    with pytest.raises(ValueError, match=message):
        validate_password_strength(password)
