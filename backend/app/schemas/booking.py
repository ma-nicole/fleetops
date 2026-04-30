from datetime import date, datetime

from pydantic import BaseModel, field_validator

from app.models.entities import BookingStatus, ServiceType


class BookingCreate(BaseModel):
    pickup_location: str
    dropoff_location: str
    service_type: ServiceType
    scheduled_date: date
    cargo_weight_tons: float
    cargo_description: str | None = None

    @field_validator("cargo_weight_tons")
    @classmethod
    def validate_weight(cls, v: float) -> float:
        if v <= 0 or v > 50:
            raise ValueError("Cargo weight must be between 0.1 and 50 tons")
        return v

    @field_validator("pickup_location", "dropoff_location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        if not v or len(v) < 3:
            raise ValueError("Location must be at least 3 characters")
        return v.strip()


class BookingRead(BaseModel):
    id: int
    customer_id: int
    pickup_location: str
    dropoff_location: str
    service_type: ServiceType
    scheduled_date: date
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
