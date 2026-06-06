"""Public URLs and MIME helpers for files under backend/uploads/."""
from __future__ import annotations

import mimetypes
from pathlib import Path

from app.core.paths import uploads_root

SENSITIVE_UPLOAD_PREFIXES = (
    "payment_proofs/",
    "booking_documents/",
    "delivery_receiving/",
)


def public_upload_url(storage_path: str | None) -> str | None:
    """Return `/uploads/...` when the stored file exists on disk."""
    if not storage_path or not str(storage_path).strip():
        return None
    rel = str(storage_path).strip().replace("\\", "/").lstrip("/")
    if rel.lower().startswith(SENSITIVE_UPLOAD_PREFIXES):
        return None
    full = uploads_root() / rel
    if not full.is_file():
        return None
    return f"/uploads/{rel}"


def media_type_for_filename(filename: str) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def media_type_for_path(path: Path) -> str:
    return media_type_for_filename(path.name)
