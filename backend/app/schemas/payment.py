from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator

from app.constants.payment_limits import GCASH_MAX_TRANSACTION_PHP
from app.constants.payment_methods import ALLOWED_PAYMENT_METHODS, PROOF_OPTIONAL_METHODS
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
        allowed = ALLOWED_PAYMENT_METHODS
        v = (v or "").lower().strip()
        if v not in allowed:
            raise ValueError(f"Method must be one of {sorted(allowed)}")
        return v

    @model_validator(mode="after")
    def validate_gcash_limit(self) -> "PaymentCreate":
        if self.method == "gcash" and self.amount > GCASH_MAX_TRANSACTION_PHP:
            raise ValueError(
                f"GCash payments are limited to ₱{GCASH_MAX_TRANSACTION_PHP:,.0f} per transaction. "
                "Use bank transfer or another payment method."
            )
        return self


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
    proof_original_filename: str | None = None
    proof_uploaded_at: datetime | None = None
    proof_file_url: str | None = None
    reviewed_at: datetime | None = None
    reviewed_by_id: int | None = None
    xendit_qr_id: str | None = None
    xendit_payment_id: str | None = None
    xendit_invoice_id: str | None = None
    xendit_external_id: str | None = None
    xendit_status: str | None = None
    xendit_qr_string: str | None = None
    xendit_expires_at: datetime | None = None
    xendit_paid_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class XenditConfigRead(BaseModel):
    enabled: bool
    public_key: str | None = None


class XenditPaymentSessionRead(BaseModel):
    payment: PaymentRead
    qr_string: str | None = None
    xendit_status: str | None = None


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
