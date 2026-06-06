"""Driver vehicle issue reports — selectable trips and attachment storage."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from secrets import token_hex

from fastapi import HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.constants.vehicle_issue_report import (
    VEHICLE_ISSUE_PRIORITY_VALUES,
    VEHICLE_ISSUE_TYPE_VALUES,
)
from app.core.paths import uploads_subdir
from app.models.entities import Booking, BookingStatus, Trip, TripStatus, Truck
from app.services.dispatch_operations_center import _display_status

UPLOAD_DIR = uploads_subdir("vehicle_issue_reports")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".img"}

_BAD_BOOKING_STATUSES: frozenset[BookingStatus] = frozenset(
    {
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
        BookingStatus.PAYMENT_REJECTED,
        BookingStatus.EXPIRED,
    }
)


def _ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_vehicle_issue_attachment(trip_id: int, file: UploadFile | None) -> str | None:
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
    return f"/uploads/vehicle_issue_reports/{stored_name}"


def list_selectable_trips_for_vehicle_issue(db: Session, driver_id: int) -> list[Trip]:
    """Active legs plus recently completed (last 14 days) for the driver — real DB rows only."""
    cutoff = datetime.utcnow() - timedelta(days=14)
    return (
        db.query(Trip)
        .options(
            joinedload(Trip.booking),
            joinedload(Trip.truck),
            joinedload(Trip.helper),
        )
        .join(Booking, Trip.booking_id == Booking.id)
        .filter(
            Trip.driver_id == driver_id,
            Trip.status != TripStatus.CANCELLED,
            Booking.status.notin_(_BAD_BOOKING_STATUSES),
            or_(
                Trip.status != TripStatus.COMPLETED,
                Trip.completed_at.is_(None),
                Trip.completed_at >= cutoff,
            ),
        )
        .order_by(Trip.id.desc())
        .limit(100)
        .all()
    )


def assert_trip_selectable_for_driver(db: Session, *, trip_id: int, driver_id: int) -> Trip:
    """Re-validate trip is in the selectable set for this driver."""
    trip = (
        db.query(Trip)
        .options(joinedload(Trip.booking), joinedload(Trip.truck), joinedload(Trip.helper))
        .filter(Trip.id == trip_id, Trip.driver_id == driver_id)
        .first()
    )
    if not trip or not trip.booking:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.status == TripStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot report issues for a cancelled trip")
    if trip.booking.status in _BAD_BOOKING_STATUSES:
        raise HTTPException(status_code=400, detail="This booking is no longer eligible for vehicle reports")
    if trip.status == TripStatus.COMPLETED and trip.completed_at is not None:
        if trip.completed_at < datetime.utcnow() - timedelta(days=14):
            raise HTTPException(status_code=400, detail="This completed trip is outside the reporting window")
    return trip


def validate_issue_payload(issue_type: str, priority: str, description: str) -> tuple[str, str, str]:
    it = (issue_type or "").strip()
    pr = (priority or "").strip().lower()
    desc = (description or "").strip()
    if it not in VEHICLE_ISSUE_TYPE_VALUES:
        raise HTTPException(status_code=400, detail="Invalid issue type")
    if pr not in VEHICLE_ISSUE_PRIORITY_VALUES:
        raise HTTPException(status_code=400, detail="Invalid priority")
    if len(desc) < 10:
        raise HTTPException(status_code=400, detail="Description must be at least 10 characters")
    return it, pr, desc


def serialize_selectable_trip(t: Trip) -> dict:
    bk = t.booking
    tk: Truck | None = t.truck
    plate = tk.code if tk else ""
    model = (tk.model_name or "").strip() if tk else ""
    route = f"{bk.pickup_location} → {bk.dropoff_location}" if bk else ""
    op_slug = _display_status(t)
    return {
        "trip_id": t.id,
        "booking_id": t.booking_id,
        "truck_plate": plate,
        "truck_model": model or None,
        "route_label": route,
        "pickup_location": bk.pickup_location if bk else "",
        "dropoff_location": bk.dropoff_location if bk else "",
        "helper_id": t.helper_id,
        "helper_name": t.helper.full_name if getattr(t, "helper", None) else None,
        "trip_status": t.status.value if hasattr(t.status, "value") else str(t.status),
        "operational_status": op_slug,
        "scheduled_date": bk.scheduled_date.isoformat() if bk else None,
    }
