"""Persist customer booking documents (cargo declaration, terms agreement)."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.paths import uploads_root, uploads_subdir

UPLOAD_DIR = uploads_subdir("booking_documents")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".pdf"}
MAX_BYTES = 5 * 1024 * 1024


def ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def validate_booking_document(filename: str, _content_type: str | None) -> str:
    ext = Path((filename or "").lower()).suffix
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail="Document must be a JPEG, PNG, or PDF file.",
        )
    return ext


async def save_booking_document(
    booking_id: int,
    file: UploadFile,
    *,
    prefix: str,
) -> tuple[str, str, datetime]:
    """Return (original_filename, relative_storage_path, uploaded_at)."""
    ensure_upload_dir()
    if not file.filename:
        raise HTTPException(status_code=400, detail="Document file is required.")
    ext = validate_booking_document(file.filename, file.content_type)
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Empty file is not allowed.")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Document must be 5MB or smaller.")
    stored_name = f"b{booking_id}_{prefix}_{uuid4().hex}{ext}"
    rel_path = f"booking_documents/{stored_name}"
    abs_path = UPLOAD_DIR / stored_name
    abs_path.write_bytes(raw)
    return file.filename, rel_path, datetime.utcnow()


async def save_terms_e_signature(
    booking_id: int,
    file: UploadFile,
) -> tuple[str, str, datetime]:
    """Persist PNG electronic signature; return (original_filename, relative_path, uploaded_at)."""
    ensure_upload_dir()
    if not file.filename:
        raise HTTPException(status_code=400, detail="Electronic signature is required.")
    ext = Path((file.filename or "").lower()).suffix
    if ext not in {".png"}:
        content_type = (file.content_type or "").lower()
        if content_type not in {"image/png"}:
            raise HTTPException(status_code=400, detail="Electronic signature must be a PNG image.")
        ext = ".png"
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Empty signature is not allowed.")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Signature image must be 5MB or smaller.")
    stored_name = f"b{booking_id}_e_signature_{uuid4().hex}{ext}"
    rel_path = f"booking_documents/{stored_name}"
    abs_path = UPLOAD_DIR / stored_name
    abs_path.write_bytes(raw)
    original = file.filename if file.filename.lower().endswith(".png") else f"signature{ext}"
    return original, rel_path, datetime.utcnow()


def resolve_booking_document_path(rel_path: str | None) -> Path:
    if not rel_path:
        raise HTTPException(status_code=404, detail="No document on record.")
    base = uploads_root()
    path = base / rel_path
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Document file missing on server.")
    return path
