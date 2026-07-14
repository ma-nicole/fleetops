"""Customer feedback endpoints (paper Customer DFD Fig 14)."""
from __future__ import annotations

import logging
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.paths import uploads_subdir
from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import Booking, Feedback, Trip, User, UserRole
from app.schemas.feedback import FeedbackCreate, FeedbackRead
from app.services.dispatcher_booking_assignment import assert_dispatcher_booking_access


router = APIRouter(prefix="/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)

_ALLOWED_SCREENSHOT_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024


def _assert_feedback_booking_access(db: Session, booking: Booking, user: User) -> None:
    if user.role in {UserRole.ADMIN, UserRole.MANAGER}:
        return
    if user.role == UserRole.CUSTOMER:
        if booking.customer_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        return
    if user.role == UserRole.DISPATCHER:
        assert_dispatcher_booking_access(db, user, booking.id)
        return
    if user.role == UserRole.DRIVER:
        assigned = (
            db.query(Trip.id)
            .filter(Trip.booking_id == booking.id, Trip.driver_id == user.id)
            .first()
            is not None
        )
        if assigned:
            return
    if user.role == UserRole.HELPER:
        assigned = (
            db.query(Trip.id)
            .filter(Trip.booking_id == booking.id, Trip.helper_id == user.id)
            .first()
            is not None
        )
        if assigned:
            return
    raise HTTPException(status_code=403, detail="Not authorized")


def _save_screenshot(file: UploadFile | None) -> str | None:
    if file is None or not (file.filename or "").strip():
        return None
    filename = file.filename or ""
    ext = Path(filename.lower()).suffix
    if ext not in _ALLOWED_SCREENSHOT_EXT:
        raise HTTPException(
            status_code=400,
            detail="Screenshot must be .jpg, .jpeg, .png, .webp, or .gif",
        )
    content = file.file.read()
    if len(content) > _MAX_SCREENSHOT_BYTES:
        raise HTTPException(status_code=400, detail="Screenshot too large (max 5 MB)")
    dest_dir = uploads_subdir("feedback_screenshots")
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored = f"fb_{token_hex(8)}{ext}"
    (dest_dir / stored).write_bytes(content)
    return f"feedback_screenshots/{stored}"


def _create_feedback(
    db: Session,
    *,
    user: User,
    booking_id: int | None,
    category: str,
    rating: int,
    message: str | None,
    attachment_path: str | None = None,
) -> Feedback:
    try:
        payload = FeedbackCreate(
            booking_id=booking_id,
            category=category,
            rating=rating,
            message=message,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    booking: Booking | None = None
    if payload.booking_id is not None:
        booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your booking")
        customer_id = booking.customer_id
        resolved_booking_id: int | None = booking.id
    else:
        if user.role != UserRole.CUSTOMER:
            raise HTTPException(
                status_code=400,
                detail="General feedback without a booking is only available for customer accounts.",
            )
        customer_id = user.id
        resolved_booking_id = None

    fb = Feedback(
        booking_id=resolved_booking_id,
        customer_id=customer_id,
        category=payload.category,
        rating=payload.rating,
        message=payload.message,
        attachment_path=attachment_path,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)

    try:
        from app.services.notifications import notify_fleetops_customer_feedback

        notify_fleetops_customer_feedback(
            customer_email=user.email,
            customer_name=user.full_name,
            booking_id=resolved_booking_id,
            category=payload.category,
            rating=payload.rating,
            message=payload.message,
        )
    except Exception:
        logger.warning("Feedback inbox notification failed.", exc_info=True)

    # In-app confirmation for customer Contact Support / feedback submissions.
    if user.role == UserRole.CUSTOMER:
        try:
            from app.services.customer_notifications import notify_customer_support_received

            notify_customer_support_received(
                db,
                customer_id=int(customer_id),
                booking_id=resolved_booking_id,
                category=payload.category,
            )
            db.commit()
        except Exception:
            logger.warning("Customer in-app support notification failed.", exc_info=True)

    return fb



@router.post("", response_model=FeedbackRead)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    return _create_feedback(
        db,
        user=user,
        booking_id=payload.booking_id,
        category=payload.category,
        rating=payload.rating,
        message=payload.message,
    )


@router.post("/with-attachment", response_model=FeedbackRead)
async def submit_feedback_with_attachment(
    rating: int = Form(...),
    category: str = Form("support"),
    message: str = Form(""),
    booking_id: str = Form(""),
    screenshot: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking_raw = (booking_id or "").strip()
    resolved: int | None
    if not booking_raw or booking_raw.lower() in {"general", "null", "none"}:
        resolved = None
    else:
        try:
            resolved = int(booking_raw)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid booking_id") from exc

    attachment_path = _save_screenshot(screenshot)
    return _create_feedback(
        db,
        user=user,
        booking_id=resolved,
        category=category,
        rating=rating,
        message=(message or "").strip() or None,
        attachment_path=attachment_path,
    )


@router.get("", response_model=list[FeedbackRead])
def list_feedback(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Feedback)
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Feedback.customer_id == user.id)
    elif user.role not in {UserRole.ADMIN, UserRole.MANAGER}:
        return []
    return query.order_by(Feedback.created_at.desc()).all()


@router.get("/booking/{booking_id}", response_model=list[FeedbackRead])
def feedback_for_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _assert_feedback_booking_access(db, booking, user)
    return db.query(Feedback).filter(Feedback.booking_id == booking_id).all()
