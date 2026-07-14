"""Admin review workflow for uploaded cargo / goods declaration documents."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.entities import Booking, GoodsDeclarationReviewEvent, GoodsDeclarationReviewStatus, User

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

MAX_REVISION_ATTEMPTS = 3

PREDEFINED_REVISION_REASONS: dict[str, str] = {
    "illegible": "Document is illegible or low quality",
    "incomplete": "Missing required fields or pages",
    "wrong_cargo": "Cargo details do not match the booking",
    "expired": "Document appears expired or outdated",
    "mismatch": "Declarant / company details do not match the account",
}

PREDEFINED_REJECTION_REASONS: dict[str, str] = {
    "prohibited": "Prohibited or restricted cargo cannot be accepted",
    "invalid": "Declaration is invalid or not authentic",
    "noncompliant": "Does not meet regulatory / company requirements",
    "customer_request": "Customer requested cancellation of declaration review",
}


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


def _compose_remarks(reason_code: str | None, custom_remark: str | None, *, action: str) -> str:
    parts: list[str] = []
    code = (reason_code or "").strip().lower()
    catalog = PREDEFINED_REVISION_REASONS if action == "revision_requested" else PREDEFINED_REJECTION_REASONS
    if code and code in catalog:
        parts.append(catalog[code])
    elif code and code != "custom":
        parts.append(code.replace("_", " "))
    custom = (custom_remark or "").strip()
    if custom:
        parts.append(custom)
    return " — ".join(parts).strip()


def _append_remarks_history(booking: Booking, entry: str) -> None:
    stamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    line = f"[{stamp}] {entry}".strip()
    prev = (booking.goods_declaration_review_remarks_history or "").strip()
    booking.goods_declaration_review_remarks_history = f"{prev}\n{line}".strip() if prev else line


def apply_goods_declaration_review(
    booking: Booking,
    *,
    status: str,
    reviewer: User,
    remarks: str | None = None,
    reason_code: str | None = None,
    db: Session | None = None,
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

    revision_count = int(getattr(booking, "goods_declaration_revision_count", 0) or 0)
    if normalized == GoodsDeclarationReviewStatus.REVISION_REQUESTED.value:
        if revision_count >= MAX_REVISION_ATTEMPTS:
            raise ValueError(
                f"Maximum of {MAX_REVISION_ATTEMPTS} revision requests already used for this booking."
            )

    composed = _compose_remarks(reason_code, remarks, action=normalized)
    if normalized in {
        GoodsDeclarationReviewStatus.REJECTED.value,
        GoodsDeclarationReviewStatus.REVISION_REQUESTED.value,
    } and not composed:
        raise ValueError("A predefined reason or custom remark is required.")

    if composed:
        _append_remarks_history(booking, f"{normalized}: {composed}")

    if normalized == GoodsDeclarationReviewStatus.REVISION_REQUESTED.value:
        revision_count += 1
        booking.goods_declaration_revision_count = revision_count

    booking.goods_declaration_review_status = normalized
    booking.goods_declaration_review_remarks = composed or None
    booking.goods_declaration_reviewed_at = datetime.utcnow()
    booking.goods_declaration_reviewed_by_id = reviewer.id
    booking.goods_declaration_validated = normalized == GoodsDeclarationReviewStatus.APPROVED.value

    if db is not None:
        db.add(
            GoodsDeclarationReviewEvent(
                booking_id=booking.id,
                action=normalized,
                reason_code=(reason_code or "").strip().lower() or None,
                remarks=composed or None,
                document_storage_path=booking.cargo_declaration_storage_path,
                document_original_filename=booking.cargo_declaration_original_filename,
                actor_id=reviewer.id,
                actor_role=reviewer.role.value if hasattr(reviewer.role, "value") else str(reviewer.role),
                revision_number=revision_count if normalized == GoodsDeclarationReviewStatus.REVISION_REQUESTED.value else revision_count,
            )
        )


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


def goods_declaration_review_customer_fields(booking: Booking) -> dict[str, str | int | None]:
    """Effective review status + label for API payloads (customer and admin)."""
    status = effective_goods_declaration_review_status(booking)
    return {
        "goods_declaration_review_status": status,
        "goods_declaration_review_status_label": (
            goods_declaration_review_label(status) if status else None
        ),
        "goods_declaration_revision_count": int(getattr(booking, "goods_declaration_revision_count", 0) or 0),
        "goods_declaration_revision_limit": MAX_REVISION_ATTEMPTS,
        "goods_declaration_review_remarks_history": getattr(
            booking, "goods_declaration_review_remarks_history", None
        ),
    }


def serialize_review_events(db: Session, booking_id: int) -> list[dict]:
    rows = (
        db.query(GoodsDeclarationReviewEvent)
        .filter(GoodsDeclarationReviewEvent.booking_id == booking_id)
        .order_by(GoodsDeclarationReviewEvent.id.asc())
        .all()
    )
    return [
        {
            "id": e.id,
            "action": e.action,
            "reason_code": e.reason_code,
            "remarks": e.remarks,
            "document_storage_path": e.document_storage_path,
            "document_original_filename": e.document_original_filename,
            "actor_id": e.actor_id,
            "actor_role": e.actor_role,
            "revision_number": e.revision_number,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in rows
    ]
