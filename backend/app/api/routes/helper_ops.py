"""Helper-only operational updates: ordered statuses, live locations, and proof photos."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.constants.fleet_capacity import trucks_required_for_cargo
from app.core.security import require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    Trip,
    TripLocationUpdate,
    TripStatus,
    TripStatusUpdate,
    Truck,
    TruckAssignment,
    TruckAssignmentStatus,
    User,
    UserRole,
)
from app.services.crew_assigned_bookings import list_crew_assigned_bookings
from app.services.delivery_receiving_verification import assert_delivery_receiving_complete
from app.services.pre_delivery_verification import is_delivery_progression_step, pre_delivery_block_detail
from app.services.trip_status_sync import sync_trip_and_booking_status

router = APIRouter(prefix="/helper", tags=["helper"])

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "helper_proofs"
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".img"}
STATUS_FLOW = ["for_pickup", "picked_up", "en_route", "dropped_off", "completed"]
STATUS_INDEX = {s: i for i, s in enumerate(STATUS_FLOW)}


def _ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _save_photo(trip_id: int, file: UploadFile | None) -> str | None:
    if not file:
        return None
    filename = file.filename or ""
    ext = Path(filename.lower()).suffix
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Photo must be .jpg, .jpeg, .png, .webp, or .img")
    _ensure_upload_dir()
    stored_name = f"t{trip_id}_{token_hex(8)}{ext}"
    dest = UPLOAD_DIR / stored_name
    content = file.file.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Photo too large (max 12 MB)")
    dest.write_bytes(content)
    return f"helper_proofs/{stored_name}"


def _sync_booking_completion(db: Session, booking_id: int) -> None:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        return
    need = int(booking.required_truck_count or trucks_required_for_cargo(booking.cargo_weight_tons))
    done = db.query(Trip).filter(Trip.booking_id == booking_id, Trip.status == TripStatus.COMPLETED).count()
    if done >= need:
        booking.status = BookingStatus.COMPLETED


def _status_to_assignment_status(status: str) -> TruckAssignmentStatus:
    mapping = {
        "for_pickup": TruckAssignmentStatus.FOR_PICKUP,
        "picked_up": TruckAssignmentStatus.PICKED_UP,
        "en_route": TruckAssignmentStatus.EN_ROUTE,
        "dropped_off": TruckAssignmentStatus.DROPPED_OFF,
        "completed": TruckAssignmentStatus.COMPLETED,
    }
    return mapping[status]


def _trip_operational_status(status: str) -> TripStatus:
    mapping = {
        "for_pickup": TripStatus.ACCEPTED,
        "picked_up": TripStatus.LOADING,
        "en_route": TripStatus.IN_DELIVERY,
        "dropped_off": TripStatus.IN_DELIVERY,
        "completed": TripStatus.COMPLETED,
    }
    return mapping[status]


@router.post("/trips/{trip_id}/status")
async def helper_update_status(
    trip_id: int,
    status: str = Form(...),
    location_name: str = Form(default=""),
    remarks: str = Form(default=""),
    photo: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.HELPER)),
):
    step = (status or "").strip().lower()
    if step not in STATUS_INDEX:
        raise HTTPException(status_code=400, detail=f"status must be one of: {', '.join(STATUS_FLOW)}")

    trip = (
        db.query(Trip)
        .options(joinedload(Trip.booking), joinedload(Trip.truck))
        .filter(Trip.id == trip_id, Trip.helper_id == user.id)
        .with_for_update()
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found for this helper")
    if trip.status in {TripStatus.CANCELLED, TripStatus.COMPLETED}:
        raise HTTPException(status_code=400, detail="Trip already closed.")

    current = (trip.helper_progress_status or "for_pickup").strip().lower()
    if current not in STATUS_INDEX:
        current = "for_pickup"
    if current == "completed":
        raise HTTPException(status_code=400, detail="Trip already completed. No more updates allowed.")
    next_step = STATUS_FLOW[min(STATUS_INDEX[current] + 1, len(STATUS_FLOW) - 1)]
    if step != next_step:
        raise HTTPException(
            status_code=400,
            detail=f"Only next status is allowed: {next_step}",
        )

    if step in {"picked_up", "dropped_off"} and photo is None:
        raise HTTPException(status_code=400, detail=f"{step} requires proof photo.")

    enroute_count = (
        db.query(TripLocationUpdate)
        .filter(TripLocationUpdate.trip_id == trip.id, TripLocationUpdate.helper_id == user.id)
        .count()
    )
    if step == "dropped_off" and enroute_count < 3:
        raise HTTPException(status_code=400, detail="Submit at least 3 en-route location updates before dropped_off.")
    if step == "completed" and (trip.helper_progress_status or "").strip().lower() != "dropped_off":
        raise HTTPException(status_code=400, detail="Trip must be dropped_off before completed.")

    if step == "completed":
        assert_delivery_receiving_complete(trip)

    if is_delivery_progression_step(step) and trip.booking:
        block = pre_delivery_block_detail(db, trip.booking)
        if block:
            raise HTTPException(status_code=400, detail=block["message"])

    photo_path = _save_photo(trip.id, photo)
    trip.helper_last_proof_path = photo_path or trip.helper_last_proof_path
    synced_trip, _ = sync_trip_and_booking_status(
        db,
        trip.id,
        step,
        helper_id=user.id,
        location_name=(location_name or "").strip(),
        remarks=(remarks or "").strip(),
        photo_url=photo_path,
    )

    if step == "completed":
        # Release truck and assignment resources immediately for future scheduling.
        if synced_trip.truck_id:
            truck = db.query(Truck).filter(Truck.id == synced_trip.truck_id).first()
            if truck and (truck.status or "").lower() != "maintenance":
                truck.status = "available"
                truck.availability_status = "available"
        if synced_trip.driver_id:
            driver = db.query(User).filter(User.id == synced_trip.driver_id, User.role == UserRole.DRIVER).first()
            if driver:
                driver.availability_status = "available"
        helper_user = db.query(User).filter(User.id == user.id).first()
        if helper_user:
            helper_user.availability_status = "available"
    db.commit()
    db.refresh(synced_trip)
    return {
        "trip_id": synced_trip.id,
        "status": step,
        "trip_status": synced_trip.status.value if hasattr(synced_trip.status, "value") else str(synced_trip.status),
        "location_updates_submitted": enroute_count if step != "en_route" else enroute_count + 1,
        "required_location_updates": 3,
        "photo_path": photo_path,
    }


@router.post("/trips/{trip_id}/location")
async def helper_location_update(
    trip_id: int,
    location_name: str = Form(...),
    remarks: str = Form(default=""),
    photo: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.HELPER)),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.helper_id == user.id)
        .with_for_update()
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found for this helper")
    if (trip.helper_progress_status or "").strip().lower() != "en_route":
        raise HTTPException(status_code=400, detail="Location updates are allowed only while status is en_route.")
    if not location_name.strip():
        raise HTTPException(status_code=400, detail="location_name is required")

    photo_path = _save_photo(trip.id, photo)
    loc = location_name.strip()
    trip.latest_location = loc
    bk = db.query(Booking).filter(Booking.id == trip.booking_id).with_for_update().first()
    if bk:
        bk.latest_location = loc
    db.add(
        TripLocationUpdate(
            booking_id=trip.booking_id,
            trip_id=trip.id,
            helper_id=user.id,
            location_name=loc,
            latitude=None,
            longitude=None,
            remarks=(remarks or "").strip() or None,
            photo_url=photo_path,
        )
    )
    db.commit()
    count = db.query(TripLocationUpdate).filter(TripLocationUpdate.trip_id == trip.id).count()
    return {"trip_id": trip.id, "location_updates_submitted": count, "required_location_updates": 3}


@router.post("/trips/{trip_id}/progress")
async def helper_update_progress_compat(
    trip_id: int,
    status: str = Form(...),
    photo: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.HELPER)),
):
    mapped = {
        "for_pick_up": "for_pickup",
        "picked_up": "picked_up",
        "on_route": "en_route",
        "dropped_off": "dropped_off",
        "complete_trip": "completed",
    }.get((status or "").strip(), (status or "").strip())
    # Backward-compatible endpoint calls new status flow.
    return await helper_update_status(
        trip_id=trip_id,
        status=mapped,
        location_name="Field update",
        remarks="",
        photo=photo,
        db=db,
        user=user,
    )


@router.get("/bookings")
def helper_list_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.HELPER)),
):
    return {"bookings": list_crew_assigned_bookings(db, user)}
