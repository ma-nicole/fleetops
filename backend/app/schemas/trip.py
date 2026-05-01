from datetime import datetime
from pydantic import BaseModel, field_validator
from app.models.entities import TripStatus


class TripCreate(BaseModel):
    booking_id: int
    truck_id: int
    driver_id: int
    dispatcher_id: int | None = None
    route_path: str = ""
    distance_km: float = 0
    toll_cost: float = 0
    fuel_cost: float = 0
    labor_cost: float = 0
    duration_hours: float = 0

    @field_validator("booking_id", "truck_id", "driver_id", mode="before")
    @classmethod
    def validate_ids(cls, v: int) -> int:
        if v is None or int(v) <= 0:
            raise ValueError("IDs must be positive integers")
        return int(v)

    @field_validator("distance_km", "toll_cost", "fuel_cost", "labor_cost", "duration_hours")
    @classmethod
    def validate_non_negative(cls, v: float) -> float:
        if v is None:
            return 0
        if v < 0:
            raise ValueError("Numeric fields must be non-negative")
        return float(v)

    @field_validator("route_path")
    @classmethod
    def validate_route(cls, v: str) -> str:
        return (v or "").strip()


class TripRead(BaseModel):
    id: int
    booking_id: int
    truck_id: int
    driver_id: int
    dispatcher_id: int | None
    route_path: str
    distance_km: float
    toll_cost: float
    fuel_cost: float
    labor_cost: float
    duration_hours: float
    status: TripStatus
    assigned_at: datetime | None
    accepted_at: datetime | None
    departure_time: datetime | None
    arrival_pickup_time: datetime | None
    loading_start_time: datetime | None
    loading_end_time: datetime | None
    departure_delivery_time: datetime | None
    arrival_delivery_time: datetime | None
    completed_at: datetime | None
    proof_of_delivery: str | None
    pod_notes: str | None
    current_latitude: float | None
    current_longitude: float | None
    estimated_delivery_time: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TripStatusUpdate(BaseModel):
    status: TripStatus
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None

    @field_validator("latitude", "longitude")
    @classmethod
    def validate_coords(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if not (-90 <= v <= 90) and not (-180 <= v <= 180):
            # allow either latitude or longitude semantics separately in callers
            return v
        return v


class TripAcceptRequest(BaseModel):
    driver_id: int

    @field_validator("driver_id", mode="before")
    @classmethod
    def validate_driver_id(cls, v: int) -> int:
        if int(v) <= 0:
            raise ValueError("driver_id must be a positive integer")
        return int(v)


class TripDeliveryProof(BaseModel):
    proof_url: str | None = None
    notes: str | None = None

    @field_validator("proof_url")
    @classmethod
    def validate_proof_url(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) == 0:
            return None
        return v


class TripIssueReport(BaseModel):
    issue_type: str  # breakdown, traffic, accident, etc
    description: str
    severity: str = "medium"  # low, medium, high

    @field_validator("issue_type", "description")
    @classmethod
    def validate_text_fields(cls, v: str) -> str:
        if not v or len(v.strip()) < 3:
            raise ValueError("Must provide a valid text value")
        return v.strip()


class TripIssueRead(BaseModel):
    id: int
    trip_id: int
    reported_by_id: int
    issue_type: str
    description: str
    severity: str
    resolved: bool
    resolution_notes: str | None
    created_at: datetime
    resolved_at: datetime | None

    class Config:
        from_attributes = True
