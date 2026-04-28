from pydantic import BaseModel, field_validator

from app.models.entities import ServiceType


class PricingConfigPayload(BaseModel):
    service_type: ServiceType
    base_rate: float
    labor_rate: float
    helper_rate: float

    @field_validator("base_rate", "labor_rate", "helper_rate")
    @classmethod
    def validate_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Rates must be positive")
        return round(v, 2)


class DriverProfilePayload(BaseModel):
    user_id: int
    compliance_status: str
    rating: float
    deduction_amount: float

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float) -> float:
        if not (1.0 <= v <= 5.0):
            raise ValueError("Rating must be between 1.0 and 5.0")
        return round(v, 1)

    @field_validator("compliance_status")
    @classmethod
    def validate_compliance(cls, v: str) -> str:
        valid_statuses = ["compliant", "warning", "non_compliant"]
        if v not in valid_statuses:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        return v


class DriverRatingRequest(BaseModel):
    driver_id: int
    trip_id: int
    rating: float
    comment: str | None = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float) -> float:
        if not (1.0 <= v <= 5.0):
            raise ValueError("Rating must be between 1.0 and 5.0")
        return round(v, 1)
