from datetime import datetime

from pydantic import BaseModel, field_validator

from app.constants.trip_shoulder_costs import SHOULDER_COST_CATEGORIES


class TripShoulderCostCreate(BaseModel):
    category: str
    amount_php: float
    notes: str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        key = (v or "").strip().lower()
        if key not in SHOULDER_COST_CATEGORIES:
            raise ValueError("category must be toll, fuel, parking, allowance, or other")
        return key

    @field_validator("amount_php")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0 or v > 5_000_000:
            raise ValueError("amount_php must be between 0.01 and 5,000,000")
        return round(v, 2)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        if len(t) > 500:
            raise ValueError("notes must be at most 500 characters")
        return t or None


class TripShoulderCostRead(BaseModel):
    id: int
    trip_id: int
    booking_id: int
    dispatcher_id: int
    category: str
    category_label: str
    amount_php: float
    notes: str | None
    recorded_at: datetime

    class Config:
        from_attributes = True
