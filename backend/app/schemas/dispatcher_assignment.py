from pydantic import BaseModel, field_validator


class DispatcherBookingAssignRequest(BaseModel):
    dispatcher_id: int | None = None

    @field_validator("dispatcher_id")
    @classmethod
    def validate_dispatcher_id(cls, v: int | None) -> int | None:
        if v is None:
            return None
        if v <= 0:
            raise ValueError("dispatcher_id must be a positive integer")
        return v
