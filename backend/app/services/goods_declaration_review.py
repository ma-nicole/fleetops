"""Admin review workflow for uploaded cargo / goods declaration documents."""

from __future__ import annotations

from datetime import datetime

from app.models.entities import Booking, GoodsDeclarationReviewStatus, User

GOODS_DECLARATION_REVIEW_STATUSES = frozenset(s.value for s in GoodsDeclarationReviewStatus)

REVIEW_ACTIONABLE_STATUSES = frozenset(
    {
        GoodsDeclarationReviewStatus.PENDING.value,
        GoodsDeclarationReviewStatus.RESUBMITTED.value,
    }
)

FINAL_REVIEW_STATUSES = frozenset(
    {
        GoodsDeclarationReviewStatus.APPROVED.value,
        GoodsDeclarationReviewStatus.REJECTED.value,
    }
)


def booking_has_goods_declaration(booking: Booking) -> bool:
    return bool(booking.cargo_declaration_storage_path or booking.cargo_declaration_original_filename)


def effective_goods_declaration_review_status(booking: Booking) -> str | None:
    if not booking_has_goods_declaration(booking):
        return None
    if booking.goods_declaration_review_status:
        return booking.goods_declaration_review_status
    return GoodsDeclarationReviewStatus.PENDING.value


def review_actions_allowed(status: str | None) -> bool:
    normalized = (status or GoodsDeclarationReviewStatus.PENDING.value).strip().lower()
    return normalized in REVIEW_ACTIONABLE_STATUSES


def mark_goods_declaration_pending(booking: Booking) -> None:
    if not booking_has_goods_declaration(booking):
        return
    booking.goods_declaration_review_status = GoodsDeclarationReviewStatus.PENDING.value
    booking.goods_declaration_review_remarks = None
    booking.goods_declaration_reviewed_at = None
    booking.goods_declaration_reviewed_by_id = None
    booking.goods_declaration_validated = False


def mark_goods_declaration_resubmitted(booking: Booking) -> None:
    """Customer uploaded revised documents after a revision request."""
    if not booking_has_goods_declaration(booking):
        return
    current = effective_goods_declaration_review_status(booking)
    if current != GoodsDeclarationReviewStatus.REVISION_REQUESTED.value:
        return
    booking.goods_declaration_review_status = GoodsDeclarationReviewStatus.RESUBMITTED.value
    booking.goods_declaration_validated = False


def apply_goods_declaration_review(
    booking: Booking,
    *,
    status: str,
    reviewer: User,
    remarks: str | None = None,
) -> None:
    if not booking_has_goods_declaration(booking):
        raise ValueError("No goods declaration document on this booking.")

    current = effective_goods_declaration_review_status(booking)
    if not review_actions_allowed(current):
        if current == GoodsDeclarationReviewStatus.REVISION_REQUESTED.value:
            raise ValueError(
                "Review is locked until the customer resubmits revised documents."
            )
        raise ValueError(
            f"Review is closed ({goods_declaration_review_label(current)}). "
            "No further actions are allowed."
        )

    normalized = (status or "").strip().lower()
    if normalized not in GOODS_DECLARATION_REVIEW_STATUSES - {GoodsDeclarationReviewStatus.PENDING.value}:
        raise ValueError("Invalid review status.")

    booking.goods_declaration_review_status = normalized
    booking.goods_declaration_review_remarks = (remarks or "").strip() or None
    booking.goods_declaration_reviewed_at = datetime.utcnow()
    booking.goods_declaration_reviewed_by_id = reviewer.id
    booking.goods_declaration_validated = normalized == GoodsDeclarationReviewStatus.APPROVED.value


def goods_declaration_review_label(status: str | None) -> str:
    if not status:
        return "Not submitted"
    labels = {
        GoodsDeclarationReviewStatus.PENDING.value: "Pending review",
        GoodsDeclarationReviewStatus.APPROVED.value: "Approved",
        GoodsDeclarationReviewStatus.REJECTED.value: "Rejected",
        GoodsDeclarationReviewStatus.REVISION_REQUESTED.value: "Revision requested",
        GoodsDeclarationReviewStatus.RESUBMITTED.value: "Resubmitted",
    }
    return labels.get(status, status.replace("_", " "))


def goods_declaration_review_customer_fields(booking: Booking) -> dict[str, str | None]:
    """Effective review status + label for API payloads (customer and admin)."""
    status = effective_goods_declaration_review_status(booking)
    return {
        "goods_declaration_review_status": status,
        "goods_declaration_review_status_label": (
            goods_declaration_review_label(status) if status else None
        ),
    }
