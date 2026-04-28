from datetime import date

from pydantic import BaseModel, field_validator

from app.models.entities import BookingStatus, ServiceType


class BookingCreate(BaseModel):
    pickup_location: str
    dropoff_location: str
    service_type: ServiceType
    scheduled_date: date
    cargo_weight_tons: float

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
    estimated_cost: float
    status: BookingStatus

    class Config:
        from_attributes = True


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
