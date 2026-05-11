from datetime import date, datetime

from pydantic import BaseModel, field_validator

from app.constants.booking_time_slots import BOOKING_TIME_SLOTS
from app.models.entities import BookingStatus, ServiceType


class BookingCreate(BaseModel):
    pickup_location: str
    dropoff_location: str
    service_type: ServiceType
    scheduled_date: date
    scheduled_time_slot: str
    cargo_weight_tons: float
    cargo_description: str | None = None

    @field_validator("cargo_weight_tons")
    @classmethod
    def validate_weight(cls, v: float) -> float:
        # Four trucks × 42 t = 168 t max per synchronized convoy.
        if v <= 0 or v > 168:
            raise ValueError("Cargo weight must be between 0.1 and 168 metric tons (fleet limit)")
        return v

    @field_validator("pickup_location", "dropoff_location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        if not v or len(v) < 3:
            raise ValueError("Location must be at least 3 characters")
        return v.strip()

    @field_validator("scheduled_time_slot")
    @classmethod
    def validate_time_slot(cls, v: str) -> str:
        t = (v or "").strip()
        if t not in BOOKING_TIME_SLOTS:
            raise ValueError(f"Time slot must be one of: {', '.join(BOOKING_TIME_SLOTS)}")
        return t


class BookingScheduleAvailabilityRead(BaseModel):
    """scheduled_time_slot → True when four trucks can still serve this load (ETA overlap)."""

    scheduled_date: date
    slots: dict[str, bool]


class BookingRead(BaseModel):
    id: int
    customer_id: int
    pickup_location: str
    dropoff_location: str
    service_type: ServiceType
    scheduled_date: date
    scheduled_time_slot: str
    cargo_weight_tons: float
    cargo_description: str | None
    estimated_cost: float
    actual_cost: float | None
    status: BookingStatus
    approved_by_id: int | None
    approved_at: datetime | None
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BookingApprovalRequest(BaseModel):
    approved: bool
    rejection_reason: str | None = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
