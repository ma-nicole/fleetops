from datetime import datetime

from pydantic import BaseModel, field_validator


class FeedbackCreate(BaseModel):
    booking_id: int
    rating: int
    message: str | None = None
    category: str = "service"

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return int(v)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        v = (v or "service").lower().strip()
        allowed = {"service", "driver", "vehicle", "support", "general"}
        if v not in allowed:
            raise ValueError(f"Category must be one of {sorted(allowed)}")
        return v


class FeedbackRead(BaseModel):
    id: int
    booking_id: int
    customer_id: int
    category: str
    rating: int
    message: str | None
    created_at: datetime

    class Config:
        from_attributes = True
