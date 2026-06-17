from pydantic import BaseModel, Field, field_validator


class DispatchRouteSelectRequest(BaseModel):
    route_option_id: int

    @field_validator("route_option_id")
    @classmethod
    def validate_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("route_option_id must be positive")
        return v


class DispatchManualRouteRequest(BaseModel):
    route_name: str = Field(..., min_length=1, max_length=120)
    distance_km: float = Field(..., gt=0)
    duration_hours: float = Field(..., gt=0)
    toll_cost_php: float = Field(default=0, ge=0)
    notes: str | None = Field(default=None, max_length=2000)
