"""Helper-only execution: status milestones, photo proof, and ≥3 km location pings."""

from __future__ import annotations

import math
from datetime import datetime
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.constants.fleet_capacity import trucks_required_for_cargo
from app.core.security import require_roles
from app.db import get_db
from app.models.entities import Booking, BookingStatus, Trip, TripStatus, Truck, User, UserRole

router = APIRouter(prefix="/helper", tags=["helper"])

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "helper_proofs"

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".img"}

HELPER_PHASES_IN_ORDER = (
    "for_pick_up",
    "picked_up",
    "on_route",
    "dropped_off",
    "complete_trip",
)


def _ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(h)))


def _require_photo_ext(filename: str) -> str:
    ext = Path(filename.lower()).suffix
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Photo must be .jpg, .jpeg, .png, or .img")
    return ext


def _refresh_booking_if_fully_delivered(db: Session, booking_id: int) -> None:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        return
    need = trucks_required_for_cargo(booking.cargo_weight_tons)
    done = (
        db.query(Trip)
        .filter(Trip.booking_id == booking_id, Trip.status == TripStatus.COMPLETED)
        .count()
    )
    if done >= need:
        booking.status = BookingStatus.COMPLETED


@router.post("/trips/{trip_id}/progress")
async def helper_update_progress(
    trip_id: int,
    status: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.HELPER)),
):
    phase = (status or "").strip()
    if phase not in HELPER_PHASES_IN_ORDER:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of: {', '.join(HELPER_PHASES_IN_ORDER)}",
        )

    trip = (
        db.query(Trip)
        .options(joinedload(Trip.booking))
        .filter(Trip.id == trip_id, Trip.helper_id == user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found for this helper")

    _require_photo_ext(photo.filename or "")

    prev_lat = trip.current_latitude
    prev_lng = trip.current_longitude
    if prev_lat is not None and prev_lng is not None:
        delta_km = _haversine_km(float(prev_lat), float(prev_lng), latitude, longitude)
        if delta_km + 1e-6 < 3.0:
            raise HTTPException(
                status_code=400,
                detail="Move at least 3 km from your last reported location before the next update.",
            )

    _ensure_upload_dir()
    ext = _require_photo_ext(photo.filename or "proof.jpg")
    stored_name = f"t{trip_id}_{token_hex(8)}{ext}"
    dest = UPLOAD_DIR / stored_name
    content = await photo.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Photo too large (max 12 MB)")
    dest.write_bytes(content)
    rel_path = f"helper_proofs/{stored_name}"

    trip.helper_progress_status = phase
    trip.helper_last_proof_path = rel_path
    trip.current_latitude = latitude
    trip.current_longitude = longitude

    booking = trip.booking
    if phase == "for_pick_up":
        if trip.status == TripStatus.ASSIGNED:
            trip.status = TripStatus.ACCEPTED
        if booking:
            booking.status = BookingStatus.ACCEPTED
    elif phase == "picked_up":
        trip.status = TripStatus.LOADING
        trip.arrival_pickup_time = datetime.utcnow()
        if booking:
            booking.status = BookingStatus.LOADING
    elif phase == "on_route":
        trip.status = TripStatus.IN_DELIVERY
        if booking:
            booking.status = BookingStatus.OUT_FOR_DELIVERY
    elif phase == "dropped_off":
        trip.status = TripStatus.IN_DELIVERY
        trip.arrival_delivery_time = datetime.utcnow()
        if booking:
            booking.status = BookingStatus.OUT_FOR_DELIVERY
    elif phase == "complete_trip":
        trip.status = TripStatus.COMPLETED
        trip.completed_at = datetime.utcnow()
        if booking:
            _refresh_booking_if_fully_delivered(db, booking.id)
            db.refresh(booking)

    db.commit()
    db.refresh(trip)
    return {
        "trip_id": trip.id,
        "helper_progress_status": trip.helper_progress_status,
        "trip_status": trip.status.value,
        "proof_path": rel_path,
        "latitude": trip.current_latitude,
        "longitude": trip.current_longitude,
    }


@router.get("/bookings")
def helper_list_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.HELPER)),
):
    """Assigned trips for the signed-in helper with booking + truck context."""
    trips = (
        db.query(Trip)
        .options(joinedload(Trip.booking), joinedload(Trip.truck))
        .filter(Trip.helper_id == user.id)
        .order_by(Trip.id.desc())
        .limit(100)
        .all()
    )
    out = []
    for t in trips:
        bk = t.booking
        tk = t.truck
        out.append(
            {
                "trip_id": t.id,
                "trip_status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "helper_progress_status": getattr(t, "helper_progress_status", None),
                "distance_km": t.distance_km,
                "current_latitude": t.current_latitude,
                "current_longitude": t.current_longitude,
                "booking": (
                    {
                        "id": bk.id,
                        "pickup_location": bk.pickup_location,
                        "dropoff_location": bk.dropoff_location,
                        "scheduled_date": bk.scheduled_date.isoformat(),
                        "scheduled_time_slot": bk.scheduled_time_slot,
                        "cargo_weight_tons": bk.cargo_weight_tons,
                        "cargo_description": bk.cargo_description,
                        "estimated_cost": bk.estimated_cost,
                        "status": bk.status.value if hasattr(bk.status, "value") else str(bk.status),
                    }
                    if bk
                    else None
                ),
                "truck": (
                    {"id": tk.id, "code": tk.code, "capacity_tons": float(tk.capacity_tons or 0)}
                    if tk
                    else None
                ),
            }
        )
    return {"bookings": out}
