"""Receiving document, QR verification, and digital signature — required before delivery completion."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from secrets import token_urlsafe
from typing import Any

from fastapi import HTTPException, UploadFile

from app.core.paths import uploads_subdir

UPLOAD_DIR = uploads_subdir("delivery_receiving")
DOC_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
SIG_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_BYTES = 12 * 1024 * 1024


def ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def ensure_trip_qr_token(trip) -> str:
    token = (getattr(trip, "receiving_qr_token", None) or "").strip()
    if not token:
        token = token_urlsafe(16)
        trip.receiving_qr_token = token
    return token


def qr_payload(trip_id: int, token: str) -> str:
    return f"FLEETOPS-TRIP-{trip_id}-{token}"


def normalize_scanned_payload(raw: str) -> str:
    return (raw or "").strip()


def verify_scanned_qr(trip, scanned_payload: str) -> bool:
    token = (getattr(trip, "receiving_qr_token", None) or "").strip()
    if not token:
        return False
    scanned = normalize_scanned_payload(scanned_payload)
    if not scanned:
        return False
    expected = qr_payload(trip.id, token)
    if scanned == expected:
        return True
    if scanned == token:
        return True
    suffix = f"-{token}"
    return scanned.endswith(suffix) and str(trip.id) in scanned


def build_delivery_receiving_status(trip) -> dict[str, Any]:
    token = (getattr(trip, "receiving_qr_token", None) or "").strip()
    has_doc = bool((getattr(trip, "receiving_document_path", None) or "").strip())
    qr_verified = getattr(trip, "receiving_qr_verified_at", None) is not None
    has_sig = bool((getattr(trip, "digital_signature_path", None) or "").strip())
    ready = has_doc and qr_verified and has_sig
    return {
        "trip_id": trip.id,
        "receiving_document_uploaded": has_doc,
        "receiving_document_path": None,
        "receiving_document_uploaded_at": (
            trip.receiving_document_uploaded_at.isoformat()
            if getattr(trip, "receiving_document_uploaded_at", None)
            else None
        ),
        "qr_verified": qr_verified,
        "qr_verified_at": (
            trip.receiving_qr_verified_at.isoformat()
            if getattr(trip, "receiving_qr_verified_at", None)
            else None
        ),
        "qr_payload": qr_payload(trip.id, token) if token else None,
        "digital_signature_uploaded": has_sig,
        "digital_signature_path": None,
        "digital_signature_uploaded_at": (
            trip.digital_signature_uploaded_at.isoformat()
            if getattr(trip, "digital_signature_uploaded_at", None)
            else None
        ),
        "ready_for_completion": ready,
    }


def assert_delivery_receiving_complete(trip) -> None:
    status = build_delivery_receiving_status(trip)
    if status["ready_for_completion"]:
        return
    missing: list[str] = []
    if not status["receiving_document_uploaded"]:
        missing.append("receiving document")
    if not status["qr_verified"]:
        missing.append("QR verification")
    if not status["digital_signature_uploaded"]:
        missing.append("digital signature")
    raise HTTPException(
        status_code=400,
        detail=(
            "Delivery completion requires receiving document upload, QR verification, and digital signature. "
            f"Missing: {', '.join(missing)}."
        ),
    )


def _validate_ext(filename: str, allowed: set[str]) -> str:
    ext = Path((filename or "").lower()).suffix
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Accepted: {', '.join(sorted(allowed))}",
        )
    return ext


def _save_upload(trip_id: int, prefix: str, file: UploadFile, allowed_ext: set[str]) -> str:
    if file is None:
        raise HTTPException(status_code=400, detail="File is required.")
    ext = _validate_ext(file.filename or "", allowed_ext)
    ensure_upload_dir()
    stored_name = f"t{trip_id}_{prefix}_{token_urlsafe(8)}{ext}"
    dest = UPLOAD_DIR / stored_name
    content = file.file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 12 MB).")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file upload.")
    dest.write_bytes(content)
    return f"delivery_receiving/{stored_name}"


def save_receiving_document(trip_id: int, file: UploadFile) -> str:
    return _save_upload(trip_id, "recvdoc", file, DOC_EXT)


def save_digital_signature(trip_id: int, file: UploadFile) -> str:
    return _save_upload(trip_id, "sig", file, SIG_EXT)


def mark_qr_verified(trip, scanned_payload: str) -> None:
    if not verify_scanned_qr(trip, scanned_payload):
        raise HTTPException(status_code=400, detail="QR code does not match this trip.")
    trip.receiving_qr_verified_at = datetime.utcnow()
