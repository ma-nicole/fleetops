"""Helper-only operational updates: ordered statuses, live locations, and proof photos."""

from __future__ import annotations

import logging
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.core.paths import uploads_subdir
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
    User,
    UserRole,
)
from app.services.crew_assigned_bookings import list_crew_assigned_bookings
from app.services.delivery_verification import verify_and_complete_delivery
from app.services.evidence_capture import (
    evaluate_trip_evidence,
    evidence_fields_dict,
    parse_evidence_form,
    record_evidence_capture,
)
from app.services.pre_delivery_verification import is_delivery_progression_step, pre_delivery_block_detail
from app.services.trip_status_sync import sync_trip_and_booking_status
from app.services.booking_qr import verify_booking_qr
from pydantic import BaseModel, Field

router = APIRouter(prefix="/helper", tags=["helper"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = uploads_subdir("helper_proofs")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".img"}
STATUS_FLOW = ["for_pickup", "picked_up", "en_route", "dropped_off", "completed"]
STATUS_INDEX = {s: i for i, s in enumerate(STATUS_FLOW)}


class BookingQrVerifyBody(BaseModel):
    payload: str = Field(min_length=8, max_length=512)
    method: str = Field(default="scan", max_length=16)


class DeliveryVerificationBody(BaseModel):
    method: str = Field(pattern="^(qr|code)$")
    credential: str = Field(min_length=4, max_length=512)


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


@router.post("/trips/{trip_id}/status")
async def helper_update_status(
    trip_id: int,
    status: str = Form(...),
    location_name: str = Form(default=""),
    remarks: str = Form(default=""),
    photo: UploadFile | None = File(default=None),
    evidence_capture_source: str = Form(default=""),
    evidence_device_captured_at: str = Form(default=""),
    evidence_latitude: str = Form(default=""),
    evidence_longitude: str = Form(default=""),
    evidence_gps_accuracy_m: str = Form(default=""),
    evidence_uploader_name: str = Form(default=""),
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
        logger.warning(
            "helper status out of sequence trip_id=%s helper_id=%s current=%s requested=%s expected=%s",
            trip_id,
            user.id,
            current,
            step,
            next_step,
        )
        raise HTTPException(
            status_code=400,
            detail=f"Only next status is allowed: {next_step}",
        )

    if step in {"picked_up", "dropped_off"} and photo is None:
        raise HTTPException(status_code=400, detail=f"{step} requires proof photo.")

    if step == "for_pickup" and trip.booking and getattr(trip.booking, "booking_qr_verified_at", None) is None:
        # Generate token if payment already verified but QR never materialized.
        from app.services.booking_qr import ensure_booking_qr_token, booking_qr_public_fields

        if trip.booking.status in {
            BookingStatus.PAYMENT_VERIFIED,
            BookingStatus.READY_FOR_ASSIGNMENT,
            BookingStatus.APPROVED,
            BookingStatus.ASSIGNED,
            BookingStatus.ACCEPTED,
        }:
            ensure_booking_qr_token(trip.booking)
            db.commit()
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Scan the customer Booking QR before starting the trip.",
                "code": "booking_qr_required",
                "booking_id": trip.booking_id,
                **booking_qr_public_fields(trip.booking),
            },
        )

    enroute_count = (
        db.query(TripLocationUpdate)
        .filter(TripLocationUpdate.trip_id == trip.id, TripLocationUpdate.helper_id == user.id)
        .count()
    )
    if step == "completed" and (trip.helper_progress_status or "").strip().lower() != "dropped_off":
        raise HTTPException(status_code=400, detail="Trip must be dropped_off before completed.")

    if step == "completed":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "delivery_verification_required",
                "message": "Use Verify Delivery with the customer's Delivery QR Code or Verification Code.",
            },
        )

    if is_delivery_progression_step(step) and trip.booking:
        block = pre_delivery_block_detail(db, trip.booking)
        if block:
            raise HTTPException(status_code=400, detail=block["message"])

    photo_path = _save_photo(trip.id, photo)
    evidence_form = parse_evidence_form(
        capture_source=evidence_capture_source,
        evidence_device_captured_at=evidence_device_captured_at,
        evidence_latitude=evidence_latitude,
        evidence_longitude=evidence_longitude,
        evidence_gps_accuracy_m=evidence_gps_accuracy_m,
        evidence_uploader_name=evidence_uploader_name,
    )
    evidence_eval = evaluate_trip_evidence(db, trip.booking, evidence_form, milestone_context=step) if photo_path else None
    if photo_path and evidence_eval:
        record_evidence_capture(
            db,
            upload_path=photo_path,
            context_type="helper_milestone",
            trip=trip,
            booking=trip.booking,
            user=user,
            ev=evidence_eval,
            milestone_context=step,
        )
    trip.helper_last_proof_path = photo_path or trip.helper_last_proof_path
    synced_trip, _ = sync_trip_and_booking_status(
        db,
        trip.id,
        step,
        helper_id=user.id,
        location_name=(location_name or "").strip(),
        remarks=(remarks or "").strip(),
        photo_url=photo_path,
        latitude=evidence_eval.latitude if evidence_eval else None,
        longitude=evidence_eval.longitude if evidence_eval else None,
        evidence_capture_source=evidence_eval.capture_source if evidence_eval else None,
        evidence_verification_label=evidence_eval.verification_label if evidence_eval else None,
        evidence_review_required=evidence_eval.review_required if evidence_eval else False,
        evidence_device_captured_at=evidence_eval.device_captured_at if evidence_eval else None,
    )

    db.commit()
    db.refresh(synced_trip)
    return {
        "trip_id": synced_trip.id,
        "status": step,
        "trip_status": synced_trip.status.value if hasattr(synced_trip.status, "value") else str(synced_trip.status),
        "location_updates_submitted": enroute_count if step != "en_route" else enroute_count + 1,
        "required_location_updates": 0,
        "photo_path": photo_path,
        **(evidence_fields_dict(evidence_eval) if evidence_eval else {}),
    }


@router.post("/trips/{trip_id}/verify-delivery")
def helper_verify_delivery(
    trip_id: int,
    body: DeliveryVerificationBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.HELPER)),
):
    result = verify_and_complete_delivery(
        db,
        trip_id=trip_id,
        helper_id=user.id,
        method=body.method,
        credential=body.credential,
    )
    db.commit()
    return result


@router.post("/trips/{trip_id}/location")
async def helper_location_update(
    trip_id: int,
    location_name: str = Form(...),
    remarks: str = Form(default=""),
    photo: UploadFile | None = File(default=None),
    evidence_capture_source: str = Form(default=""),
    evidence_device_captured_at: str = Form(default=""),
    evidence_latitude: str = Form(default=""),
    evidence_longitude: str = Form(default=""),
    evidence_gps_accuracy_m: str = Form(default=""),
    evidence_uploader_name: str = Form(default=""),
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
        logger.warning(
            "helper location rejected trip_id=%s helper_id=%s progress=%s",
            trip_id,
            user.id,
            trip.helper_progress_status,
        )
        raise HTTPException(status_code=400, detail="Location updates are allowed only while status is en_route.")
    if not location_name.strip():
        raise HTTPException(status_code=400, detail="location_name is required")
    if photo is None:
        raise HTTPException(status_code=400, detail="Location updates require proof photo.")

    photo_path = _save_photo(trip.id, photo)
    if not photo_path:
        raise HTTPException(status_code=400, detail="Location updates require proof photo.")
    evidence_form = parse_evidence_form(
        capture_source=evidence_capture_source,
        evidence_device_captured_at=evidence_device_captured_at,
        evidence_latitude=evidence_latitude,
        evidence_longitude=evidence_longitude,
        evidence_gps_accuracy_m=evidence_gps_accuracy_m,
        evidence_uploader_name=evidence_uploader_name,
    )
    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    evidence_eval = evaluate_trip_evidence(db, booking, evidence_form, milestone_context="en_route")
    record_evidence_capture(
        db,
        upload_path=photo_path,
        context_type="helper_location",
        trip=trip,
        booking=booking,
        user=user,
        ev=evidence_eval,
        milestone_context="en_route",
    )
    loc = location_name.strip()
    trip.latest_location = loc
    bk = db.query(Booking).filter(Booking.id == trip.booking_id).with_for_update().first()
    if bk:
        bk.latest_location = loc
    progress_status = (trip.helper_progress_status or "en_route").strip().lower()
    loc_row = TripLocationUpdate(
        booking_id=trip.booking_id,
        trip_id=trip.id,
        helper_id=user.id,
        location_name=loc,
        latitude=evidence_eval.latitude if evidence_eval else None,
        longitude=evidence_eval.longitude if evidence_eval else None,
        remarks=(remarks or "").strip() or None,
        photo_url=photo_path,
        evidence_capture_source=evidence_eval.capture_source if evidence_eval else None,
        evidence_verification_label=evidence_eval.verification_label if evidence_eval else None,
        evidence_review_required=evidence_eval.review_required if evidence_eval else False,
        evidence_device_captured_at=evidence_eval.device_captured_at if evidence_eval else None,
    )
    db.add(loc_row)
    db.commit()
    count = db.query(TripLocationUpdate).filter(TripLocationUpdate.trip_id == trip.id).count()
    return {
        "trip_id": trip.id,
        "booking_id": trip.booking_id,
        "helper_id": user.id,
        "driver_id": trip.driver_id,
        "delivery_status": progress_status,
        "location_updates_submitted": count,
        "required_location_updates": 0,
        "photo_path": photo_path,
        **(evidence_fields_dict(evidence_eval) if evidence_eval else {}),
    }


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


@router.post("/bookings/{booking_id}/verify-qr")
def helper_verify_booking_qr(
    booking_id: int,
    body: BookingQrVerifyBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.HELPER)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    # Helper must be assigned to at least one trip on this booking.
    assigned = (
        db.query(Trip.id)
        .filter(Trip.booking_id == booking_id, Trip.helper_id == user.id)
        .first()
    )
    if not assigned:
        raise HTTPException(status_code=403, detail="Not assigned to this booking.")
    try:
        result = verify_booking_qr(
            db,
            booking=booking,
            payload=body.payload,
            scanner=user,
            method=body.method,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.commit()
    return result
