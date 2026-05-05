from pydantic import BaseModel, EmailStr, field_validator

from app.models.entities import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: str | None = None
    role: UserRole = UserRole.CUSTOMER
    phone: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v or len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        if not v or len(v.strip()) < 3:
            raise ValueError("Full name must be at least 3 characters")
        return v.strip()

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        if not t:
            return None
        if len(t) < 2:
            raise ValueError("Company name must be at least 2 characters")
        return t

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        p = v.strip()
        if len(p) < 7:
            raise ValueError("Phone number seems too short")
        return p


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    company_name: str | None = None
    role: UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Echoed from DB so clients need not parse JWT (avoids fragile browser base64 decoding).
    role: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("token")
    @classmethod
    def validate_token(cls, v: str) -> str:
        t = v.strip()
        if len(t) < 20:
            raise ValueError("Invalid reset token")
        return t

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if not v or len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ResetPasswordResponse(BaseModel):
    message: str
