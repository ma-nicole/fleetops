"""GCash merchant QR asset — replace file in uploads/payment_assets/ (see GCASH_QR_FILENAMES)."""

from pathlib import Path

GCASH_QR_FILENAMES = (
    "gcash_qr.png",
    "gcash_qr.jpg",
    "gcash_qr.jpeg",
    "gcash_qr.webp",
    "gcash_qr.svg",
)

GCASH_QR_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "payment_assets"
GCASH_QR_PLACEHOLDER = Path(__file__).resolve().parents[1] / "static" / "gcash_qr_placeholder.svg"
