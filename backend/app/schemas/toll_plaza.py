from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class TollPlazaAliasCreate(BaseModel):
    alias: str = Field(..., min_length=2, max_length=255)

    @field_validator("alias", mode="before")
    @classmethod
    def strip_alias(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class TollPlazaCreate(BaseModel):
    canonical_name: str = Field(..., min_length=2, max_length=255)
    status: str = Field(default="active")
    aliases: list[str] = Field(default_factory=list)
    latitude: float | None = None
    longitude: float | None = None
    corridor: str | None = Field(default=None, max_length=64)

    @field_validator("canonical_name", mode="before")
    @classmethod
    def strip_name(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class TollPlazaUpdate(BaseModel):
    canonical_name: str | None = Field(default=None, min_length=2, max_length=255)
    status: str | None = None
    aliases: list[str] | None = None
    latitude: float | None = None
    longitude: float | None = None
    corridor: str | None = Field(default=None, max_length=64)


class TollPlazaAliasRead(BaseModel):
    id: int
    alias: str

    class Config:
        from_attributes = True


class TollPlazaRead(BaseModel):
    id: int
    canonical_name: str
    status: str
    latitude: float | None = None
    longitude: float | None = None
    corridor: str | None = None
    aliases: list[TollPlazaAliasRead]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TollPlazaOptionRead(BaseModel):
    name: str


class AdminBookingTollOverride(BaseModel):
    toll_entry_point: str = Field(..., min_length=2, max_length=255)
    toll_exit_point: str = Field(..., min_length=2, max_length=255)
    vehicle_class: str = Field(default="Class 3", max_length=32)
    distance_km_override: float | None = Field(default=None, gt=0, le=5000)

    @field_validator("toll_entry_point", "toll_exit_point", "vehicle_class", mode="before")
    @classmethod
    def strip_fields(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("distance_km_override")
    @classmethod
    def round_distance(cls, v: float | None) -> float | None:
        if v is None:
            return None
        return round(float(v), 2)
