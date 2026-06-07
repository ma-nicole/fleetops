from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class TollMatrixCreate(BaseModel):
    entry_point: str = Field(..., min_length=2, max_length=255)
    exit_point: str = Field(..., min_length=2, max_length=255)
    vehicle_class: str = Field(default="Class 3", max_length=32)
    toll_fee: float = Field(..., ge=0)
    effective_date: date = Field(default=date(2026, 1, 20))
    status: str = Field(default="active")

    @field_validator("entry_point", "exit_point", "vehicle_class", mode="before")
    @classmethod
    def strip_text(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class TollMatrixUpdate(BaseModel):
    entry_point: str | None = Field(default=None, min_length=2, max_length=255)
    exit_point: str | None = Field(default=None, min_length=2, max_length=255)
    vehicle_class: str | None = Field(default=None, max_length=32)
    toll_fee: float | None = Field(default=None, ge=0)
    effective_date: date | None = None
    status: str | None = None


class TollMatrixRead(BaseModel):
    id: int
    entry_point: str
    exit_point: str
    vehicle_class: str
    toll_fee: float
    effective_date: date
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AdditionalTollCreate(BaseModel):
    amount: float = Field(..., gt=0)
    reason: str = Field(..., min_length=3, max_length=500)
    receipt_url: str | None = None

    @field_validator("reason", mode="before")
    @classmethod
    def strip_reason(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class AdditionalTollRead(BaseModel):
    id: int
    trip_id: int
    driver_id: int
    amount: float
    reason: str
    receipt_url: str | None
    recorded_at: datetime

    class Config:
        from_attributes = True
