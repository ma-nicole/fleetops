from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import Booking, BookingStatus, User, UserRole
from app.schemas.booking import BookingCreate, BookingRead
from app.schemas.predict import TripCostPredictRequest
from app.services.email_templates import EmailTemplate
from app.services.notifications import send_email_notification
from app.services.predictive.cost_model import predict_trip_cost


router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("", response_model=BookingRead)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Create a new booking with cost estimation and confirmation email"""
    prediction = predict_trip_cost(
        TripCostPredictRequest(
            distance_km=120,
            cargo_weight_tons=payload.cargo_weight_tons,
        ),
        db=db,
    )

    booking = Booking(
        customer_id=user.id,
        pickup_location=payload.pickup_location,
        dropoff_location=payload.dropoff_location,
        service_type=payload.service_type,
        scheduled_date=payload.scheduled_date,
        cargo_weight_tons=payload.cargo_weight_tons,
        estimated_cost=prediction.total_cost,
        status=BookingStatus.PENDING_APPROVAL,
    )

    db.add(booking)
    db.commit()
    db.refresh(booking)

    # Send confirmation email with template
    subject, html_body = EmailTemplate.booking_confirmation(
        booking_id=booking.id,
        estimated_cost=booking.estimated_cost,
        scheduled_date=str(booking.scheduled_date),
    )
    send_email_notification(to_email=user.email, subject=subject, html_body=html_body)

    return booking


@router.get("", response_model=list[BookingRead])
def list_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Booking)
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Booking.customer_id == user.id)
    return query.order_by(Booking.created_at.desc()).all()


@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    booking.status = BookingStatus.CANCELLED
    db.commit()
    return {"status": "cancelled"}
