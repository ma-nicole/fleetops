"""Customer feedback endpoints (paper Customer DFD Fig 14)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import Booking, Feedback, User, UserRole
from app.schemas.feedback import FeedbackCreate, FeedbackRead


router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackRead)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking: Booking | None = None
    if payload.booking_id is not None:
        booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your booking")
        customer_id = booking.customer_id
        booking_id: int | None = booking.id
    else:
        if user.role != UserRole.CUSTOMER:
            raise HTTPException(
                status_code=400,
                detail="General feedback without a booking is only available for customer accounts.",
            )
        customer_id = user.id
        booking_id = None

    fb = Feedback(
        booking_id=booking_id,
        customer_id=customer_id,
        category=payload.category,
        rating=payload.rating,
        message=payload.message,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)

    try:
        from app.services.notifications import notify_fleetops_customer_feedback

        notify_fleetops_customer_feedback(
            customer_email=user.email,
            customer_name=user.full_name,
            booking_id=booking_id,
            category=payload.category,
            rating=payload.rating,
            message=payload.message,
        )
    except Exception as exc:
        print(f"[feedback] Inbox notification failed: {exc}")

    return fb


@router.get("", response_model=list[FeedbackRead])
def list_feedback(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Feedback)
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Feedback.customer_id == user.id)
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
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(Feedback).filter(Feedback.booking_id == booking_id).all()
