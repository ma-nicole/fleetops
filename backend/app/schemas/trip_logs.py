from datetime import datetime

from pydantic import BaseModel, field_validator


class FuelLogCreate(BaseModel):
    liters: float
    cost: float
    odometer_km: float | None = None
    receipt_url: str | None = None

    @field_validator("liters", "cost")
    @classmethod
    def positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Must be positive")
        return float(v)


class FuelLogRead(BaseModel):
    id: int
    trip_id: int
    truck_id: int
    driver_id: int
    liters: float
    cost: float
    odometer_km: float | None
    receipt_url: str | None
    recorded_at: datetime

    class Config:
        from_attributes = True


class TollLogCreate(BaseModel):
    location: str
    amount: float
    receipt_url: str | None = None

    @field_validator("amount")
    @classmethod
    def positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Must be positive")
        return float(v)

    @field_validator("location")
    @classmethod
    def loc(cls, v: str) -> str:
        if not v or len(v.strip()) < 2:
            raise ValueError("Location too short")
        return v.strip()


class TollLogRead(BaseModel):
    id: int
    trip_id: int
    driver_id: int
    location: str
    amount: float
    receipt_url: str | None
    recorded_at: datetime

    class Config:
        from_attributes = True


class CompletionReportRead(BaseModel):
    id: int
    trip_id: int
    booking_id: int
    generated_by_id: int
    summary: str
    fuel_total: float
    toll_total: float
    labor_total: float
    maintenance_total: float
    total_cost: float
    status: str
    confirmed_by_id: int | None
    confirmed_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True
