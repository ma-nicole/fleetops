"""Pre-delivery verification — blocks delivery progression until all checks pass."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.constants.fleet_capacity import MAX_BOOKING_WEIGHT_TONS
from app.models.entities import Booking, GoodsDeclarationReviewStatus, Payment, PaymentStatus, ServiceType
from app.services.goods_declaration_review import (
    effective_goods_declaration_review_status,
    goods_declaration_review_label,
)
from app.services.cargo_type_classification import cargo_type_category_label, parse_cargo_restricted_reasons

DELIVERY_PROGRESS_STEPS = frozenset({"en_route", "dropped_off", "completed"})


def is_delivery_progression_step(step: str) -> bool:
    return (step or "").strip().lower() in DELIVERY_PROGRESS_STEPS


def _service_type_label(service_type: ServiceType | str | None) -> str:
    if service_type is None:
        return "—"
    val = service_type.value if hasattr(service_type, "value") else str(service_type)
    return "Fixed route" if val == ServiceType.FIXED.value else "Customized route"


def build_pre_delivery_checklist(db: Session, booking: Booking) -> dict:
    verified_payment = (
        db.query(Payment)
        .filter(Payment.booking_id == booking.id, Payment.status == PaymentStatus.VERIFIED)
        .order_by(Payment.id.desc())
        .first()
    )
    has_declaration_file = bool(
        booking.cargo_declaration_storage_path or booking.cargo_declaration_original_filename
    )
    has_terms_file = bool(booking.terms_agreement_storage_path or booking.terms_agreement_original_filename)
    has_terms_agreed = booking.terms_agreed_at is not None
    cargo_desc = (booking.cargo_description or "").strip()
    weight_ok = 0.1 <= float(booking.cargo_weight_tons or 0) <= MAX_BOOKING_WEIGHT_TONS
    service_ok = booking.service_type in (ServiceType.FIXED, ServiceType.CUSTOMIZED)

    decl_approved = (
        has_declaration_file
        and effective_goods_declaration_review_status(booking) == GoodsDeclarationReviewStatus.APPROVED.value
    )

    restricted_reasons = parse_cargo_restricted_reasons(booking.cargo_restricted_reasons)
    cargo_type_detail_validated = (
        f"{_service_type_label(booking.service_type)} · {cargo_desc[:80]} · "
        f"{cargo_type_category_label(booking.cargo_type_category)}."
    )
    if booking.cargo_restricted_flag and restricted_reasons:
        cargo_type_detail_validated += f" Warning: {restricted_reasons[0]}"
        if len(restricted_reasons) > 1:
            cargo_type_detail_validated += f" (+{len(restricted_reasons) - 1} more)"

    items = [
        {
            "key": "payment_verification",
            "label": "Payment verification",
            "passed": verified_payment is not None,
            "detail": (
                "Admin-verified payment on file."
                if verified_payment
                else "Verified payment required before delivery can proceed."
            ),
        },
        {
            "key": "goods_declaration",
            "label": "Declaration of goods validation",
            "passed": decl_approved,
            "detail": (
                f"Cargo declaration approved ({goods_declaration_review_label(effective_goods_declaration_review_status(booking))})."
                if decl_approved
                else (
                    f"Admin review: {goods_declaration_review_label(effective_goods_declaration_review_status(booking))}."
                    if has_declaration_file
                    else "Cargo declaration document is missing."
                )
            ),
        },
        {
            "key": "cargo_type",
            "label": "Cargo type validation",
            "passed": service_ok and len(cargo_desc) >= 3 and weight_ok and bool(booking.cargo_type_validated),
            "detail": (
                cargo_type_detail_validated
                if service_ok and len(cargo_desc) >= 3 and weight_ok and booking.cargo_type_validated
                else (
                    (
                        f"Admin/dispatcher must validate cargo type. "
                        f"{cargo_type_category_label(booking.cargo_type_category)} selected."
                        if booking.cargo_type_category
                        else "Admin/dispatcher must validate cargo type and description."
                    )
                    if service_ok and len(cargo_desc) >= 3 and weight_ok
                    else (
                        "Cargo description (min 3 characters) and valid weight (0.1–"
                        f"{int(MAX_BOOKING_WEIGHT_TONS)} t) required."
                        if not (service_ok and len(cargo_desc) >= 3 and weight_ok)
                        else "Cargo type validation pending."
                    )
                )
            ),
        },
        {
            "key": "required_documents",
            "label": "Required documents",
            "passed": has_declaration_file and has_terms_file and has_terms_agreed,
            "detail": (
                "Cargo declaration and signed terms agreement on file."
                if has_declaration_file and has_terms_file and has_terms_agreed
                else "Cargo declaration, terms agreement upload, and terms acceptance are all required."
            ),
        },
    ]

    all_passed = all(item["passed"] for item in items)
    return {
        "booking_id": booking.id,
        "all_passed": all_passed,
        "ready_for_delivery": all_passed,
        "items": items,
    }


def pre_delivery_block_detail(db: Session, booking: Booking) -> dict | None:
    checklist = build_pre_delivery_checklist(db, booking)
    if checklist["all_passed"]:
        return None
    failed = [item for item in checklist["items"] if not item["passed"]]
    labels = ", ".join(item["label"] for item in failed)
    return {
        "message": f"Pre-delivery verification incomplete ({labels}). Delivery progression is blocked.",
        "checklist": checklist,
    }
