from datetime import datetime

from pydantic import BaseModel, field_validator


class RouteCreate(BaseModel):
    origin: str
    destination: str
    distance_km: float
    eta_hours: float = 0
    road_class: str = "highway"
    base_toll: float = 0

    @field_validator("origin", "destination")
    @classmethod
    def validate_loc(cls, v: str) -> str:
        if not v or len(v.strip()) < 2:
            raise ValueError("Location too short")
        return v.strip()

    @field_validator("distance_km")
    @classmethod
    def validate_distance(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Distance must be positive")
        return float(v)

    @field_validator("road_class")
    @classmethod
    def validate_road_class(cls, v: str) -> str:
        v = (v or "highway").lower().strip()
        if v not in {"highway", "urban", "rough"}:
            raise ValueError("road_class must be highway | urban | rough")
        return v


class RouteRead(BaseModel):
    id: int
    origin: str
    destination: str
    distance_km: float
    eta_hours: float
    road_class: str
    base_toll: float
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RouteOptionRead(BaseModel):
    id: int
    booking_id: int
    rank: int
    path_json: str
    distance_km: float
    fuel_cost: float
    toll_cost: float
    time_penalty: float
    maintenance_penalty: float
    total_cost: float
    is_selected: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TruckBanRuleCreate(BaseModel):
    name: str
    road_segment: str
    weekdays_csv: str = "Mon,Tue,Wed,Thu,Fri"
    start_hour: int = 6
    end_hour: int = 9
    description: str | None = None
    is_active: bool = True

    @field_validator("start_hour", "end_hour")
    @classmethod
    def validate_hour(cls, v: int) -> int:
        if v < 0 or v > 23:
            raise ValueError("Hour must be 0..23")
        return int(v)


class TruckBanRuleRead(TruckBanRuleCreate):
    id: int

    class Config:
        from_attributes = True
