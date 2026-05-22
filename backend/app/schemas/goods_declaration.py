from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.entities import GoodsDeclarationReviewStatus

GOODS_DECLARATION_ADMIN_ACTIONS = frozenset(
    {
        GoodsDeclarationReviewStatus.APPROVED.value,
        GoodsDeclarationReviewStatus.REJECTED.value,
        GoodsDeclarationReviewStatus.REVISION_REQUESTED.value,
    }
)


class GoodsDeclarationReviewRequest(BaseModel):
    status: str
    remarks: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        key = (v or "").strip().lower()
        if key not in GOODS_DECLARATION_ADMIN_ACTIONS:
            raise ValueError("status must be approved, rejected, or revision_requested")
        return key

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        if len(t) > 2000:
            raise ValueError("Remarks must be at most 2000 characters")
        return t or None


class GoodsDeclarationAdminRow(BaseModel):
    booking_id: int
    customer_id: int
    status: str
    pickup_location: str
    dropoff_location: str
    cargo_description: str | None
    cargo_weight_tons: float
    cargo_declaration_original_filename: str | None
    cargo_declaration_uploaded_at: datetime | None
    cargo_declaration_file_url: str | None = None
    goods_declaration_review_status: str | None
    goods_declaration_review_remarks: str | None
    goods_declaration_reviewed_at: datetime | None
    goods_declaration_reviewed_by_id: int | None

    class Config:
        from_attributes = True
