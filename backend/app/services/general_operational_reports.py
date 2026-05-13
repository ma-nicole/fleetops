"""Driver general operational reports — validation and attachment storage."""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.constants.general_operational_report import (
    GENERAL_OPS_CATEGORY_VALUES,
    GENERAL_OPS_TRIP_STATUS_VALUES,
)
from app.models.entities import GeneralOperationalReport

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "general_operational_reports"
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".img"}


def _ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_general_ops_attachment(trip_id: int, file: UploadFile | None) -> str | None:
    if not file or not (file.filename or "").strip():
        return None
    name = (file.filename or "").strip().lower()
    ext = Path(name).suffix
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail="Attachment must be .jpg, .jpeg, .png, .webp, .pdf, or .img",
        )
    _ensure_upload_dir()
    stored_name = f"t{trip_id}_{token_hex(8)}{ext}"
    dest = UPLOAD_DIR / stored_name
    content = file.file.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Attachment too large (max 12 MB)")
    dest.write_bytes(content)
    return f"/uploads/general_operational_reports/{stored_name}"


def parse_report_date(raw: str) -> date:
    s = (raw or "").strip()
    if not s:
        raise HTTPException(status_code=400, detail="Report date is required")
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid report date (use YYYY-MM-DD)") from exc


def parse_optional_float(raw: str | None, label: str) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid number for {label}") from exc


def validate_general_ops_payload(
    *,
    category: str,
    trip_status: str | None,
    description: str,
) -> tuple[str, str | None, str]:
    cat = (category or "").strip()
    if cat not in GENERAL_OPS_CATEGORY_VALUES:
        raise HTTPException(status_code=400, detail="Invalid report category")
    ts = (trip_status or "").strip()
    if not ts:
        trip_status_out: str | None = None
    else:
        if ts not in GENERAL_OPS_TRIP_STATUS_VALUES:
            raise HTTPException(status_code=400, detail="Invalid trip status")
        trip_status_out = ts
    desc = (description or "").strip()
    if len(desc) < 10:
        raise HTTPException(status_code=400, detail="Main description must be at least 10 characters")
    return cat, trip_status_out, desc


def list_general_operational_reports(
    db: Session,
    *,
    booking_id: int | None = None,
    limit: int = 200,
) -> list[GeneralOperationalReport]:
    q = db.query(GeneralOperationalReport)
    if booking_id is not None:
        q = q.filter(GeneralOperationalReport.booking_id == booking_id)
    return q.order_by(GeneralOperationalReport.created_at.desc()).limit(limit).all()


def list_general_operational_reports_for_trips(db: Session, trip_ids: list[int]) -> list[GeneralOperationalReport]:
    if not trip_ids:
        return []
    return (
        db.query(GeneralOperationalReport)
        .filter(GeneralOperationalReport.trip_id.in_(trip_ids))
        .order_by(GeneralOperationalReport.created_at.asc())
        .all()
    )
