from pydantic import BaseModel, field_validator


class DispatchRouteSelectRequest(BaseModel):
    route_option_id: int

    @field_validator("route_option_id")
    @classmethod
    def validate_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("route_option_id must be positive")
        return v
