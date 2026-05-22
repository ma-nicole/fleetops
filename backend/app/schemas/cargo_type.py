from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.entities import CargoTypeCategory

CARGO_TYPE_CATEGORY_VALUES = frozenset(c.value for c in CargoTypeCategory)


class CargoTypeScreeningRead(BaseModel):
    restricted_flag: bool
    reasons: list[str]
    category_label: str


class BookingCargoTypeValidate(BaseModel):
    validated: bool = True
    cargo_type_category: str | None = None
    cargo_type_admin_notes: str | None = None

    @field_validator("cargo_type_category")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        if v is None:
            return None
        key = v.strip().lower()
        if key not in CARGO_TYPE_CATEGORY_VALUES:
            raise ValueError(f"Cargo type category must be one of: {', '.join(sorted(CARGO_TYPE_CATEGORY_VALUES))}")
        return key

    @field_validator("cargo_type_admin_notes")
    @classmethod
    def validate_admin_notes(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        if len(t) > 2000:
            raise ValueError("Admin notes must be at most 2000 characters")
        return t or None


class CargoTypeValidationAdminRow(BaseModel):
    booking_id: int
    customer_id: int
    status: str
    pickup_location: str
    dropoff_location: str
    cargo_description: str | None
    cargo_weight_tons: float
    cargo_type_category: str | None
    cargo_type_category_label: str
    cargo_type_validated: bool
    cargo_type_admin_notes: str | None
    cargo_restricted_flag: bool
    cargo_restricted_reasons: list[str]
    cargo_type_validated_at: datetime | None
    cargo_type_validated_by_id: int | None
