from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.entities import PaymentStatus


class PaymentCreate(BaseModel):
    booking_id: int
    method: str
    amount: float

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return round(float(v), 2)

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        allowed = {"card", "gcash", "bank", "cash"}
        v = (v or "").lower().strip()
        if v not in allowed:
            raise ValueError(f"Method must be one of {sorted(allowed)}")
        return v


class PaymentRead(BaseModel):
    id: int
    booking_id: int
    transaction_id: int | None
    customer_id: int
    method: str
    amount: float
    status: PaymentStatus
    reference: str
    paid_at: datetime | None
    refunded_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentRefundRequest(BaseModel):
    reason: str | None = None


class FinanceSummary(BaseModel):
    total_revenue: float
    total_paid: float
    total_pending: float
    total_failed: float
    total_refunded: float
    receivables: float
    payments_count: int
    average_ticket: float
    by_method: dict[str, float]
