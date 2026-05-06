from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class FeedbackCreate(BaseModel):
    """booking_id may be omitted for general feedback not tied to a trip/booking."""

    booking_id: int | None = None
    rating: int
    message: str | None = Field(default=None, max_length=2000)
    category: str = "service"

    @field_validator("booking_id")
    @classmethod
    def validate_booking_id(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("booking_id must be a positive integer when provided")
        return v

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
    booking_id: int | None
    customer_id: int
    category: str
    rating: int
    message: str | None
    created_at: datetime

    class Config:
        from_attributes = True
