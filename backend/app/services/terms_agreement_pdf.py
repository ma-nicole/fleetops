"""FleetOpt standard logistics terms text and signed PDF generation."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fpdf import FPDF

from app.core.paths import uploads_subdir

FLEETOPT_TERMS_VERSION = "fleetopt-logistics-v1"

TERMS_SECTIONS: list[tuple[str, list[str]]] = [
    (
        "1. Agreement Overview",
        [
            "This FleetOpt Logistics Service Agreement governs transportation, handling, and related logistics services arranged through the FleetOpt platform.",
            "By electronically signing and accepting these terms during booking, you confirm that you are authorized to bind the shipper or consignee and that your booking information is accurate.",
        ],
    ),
    (
        "2. Scope of Services",
        [
            "FleetOpt coordinates fleet resources, drivers, helpers, and dispatch operations for pickup, transit, and delivery of cargo as described in your booking request.",
            "Services may include route planning, scheduling, proof-of-delivery capture, payment processing, and operational status updates.",
        ],
    ),
    (
        "3. Customer Responsibilities",
        [
            "You must provide accurate pickup and delivery locations, cargo weight, description, and scheduling requirements.",
            "You are responsible for lawful packaging, labeling, and documentation of cargo, including any required permits or hazardous materials declarations.",
        ],
    ),
    (
        "4. Cargo Declaration",
        [
            "You agree to upload a complete and truthful Cargo Declaration Sheet for each booking.",
            "Undeclared or misdeclared cargo may result in service cancellation or refusal of carriage where permitted by law.",
        ],
    ),
    (
        "5. Pricing and Payment",
        [
            "Quoted totals are based on route distance, vehicle class, toll estimates, labor, and operational factors available at booking time.",
            "Payment must be completed according to the payment method selected in the FleetOpt portal.",
        ],
    ),
    (
        "6. Electronic Records",
        [
            "You consent to electronic execution of this Agreement. Your electronic signature, acceptance checkbox, and audit metadata constitute a binding record.",
            "FleetOpt may retain booking records, operational proofs, and signed agreement artifacts for compliance and service quality.",
        ],
    ),
]


def generate_signed_terms_pdf(
    *,
    booking_id: int,
    customer_name: str,
    user_account_id: int,
    signed_at: datetime,
    ip_address: str | None,
    signature_png_path: Path,
    output_path: Path,
) -> None:
    """Write a signed terms PDF including agreement text, audit metadata, and signature image."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    text_w = pdf.epw
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(text_w, 10, "FleetOpt Logistics Service Agreement", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(text_w, 7, f"Version: {FLEETOPT_TERMS_VERSION}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(text_w, 7, f"Booking #{booking_id}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    for title, paragraphs in TERMS_SECTIONS:
        pdf.set_font("Helvetica", "B", 11)
        pdf.multi_cell(text_w, 6, title)
        pdf.set_font("Helvetica", "", 9)
        for para in paragraphs:
            pdf.multi_cell(text_w, 5, para)
            pdf.ln(1)
        pdf.ln(2)

    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(text_w, 8, "Electronic Signature & Acceptance Record", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(text_w, 6, f"Customer name: {customer_name}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(text_w, 6, f"User account ID: {user_account_id}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(text_w, 6, f"Signed at (UTC): {signed_at.isoformat(timespec='seconds')}", new_x="LMARGIN", new_y="NEXT")
    if ip_address:
        pdf.cell(text_w, 6, f"IP address: {ip_address}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    if signature_png_path.is_file():
        try:
            pdf.image(str(signature_png_path), x=15, w=70)
            pdf.ln(2)
        except Exception as exc:
            # Corrupt/unsupported signature images should not abort booking PDF generation.
            pdf.set_font("Helvetica", "I", 9)
            pdf.multi_cell(
                text_w,
                5,
                f"[Electronic signature on file: {signature_png_path.name}; image embed skipped: {exc}]",
            )
            pdf.ln(2)

    pdf.multi_cell(
        text_w,
        5,
        'The customer confirmed "I Agree" to these terms and provided the electronic signature shown above through the FleetOpt booking portal.',
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))


def signed_terms_pdf_relative_path(booking_id: int) -> str:
    return f"booking_documents/b{booking_id}_signed_terms.pdf"

def signed_terms_pdf_abs_path(booking_id: int) -> Path:
    return uploads_subdir("booking_documents") / f"b{booking_id}_signed_terms.pdf"
