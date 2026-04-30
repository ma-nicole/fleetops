from datetime import datetime
from pydantic import BaseModel
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


class TripAcceptRequest(BaseModel):
    driver_id: int


class TripDeliveryProof(BaseModel):
    proof_url: str | None = None
    notes: str | None = None


class TripIssueReport(BaseModel):
    issue_type: str  # breakdown, traffic, accident, etc
    description: str
    severity: str = "medium"  # low, medium, high


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
