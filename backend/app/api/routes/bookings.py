from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import Booking, BookingStatus, User, UserRole
from app.schemas.booking import BookingCreate, BookingRead, BookingScheduleAvailabilityRead
from app.services.email_templates import EmailTemplate
from app.services.notifications import send_email_notification
from app.core.config import settings
from app.services.booking_freight_knobs import resolve_booking_freight_knobs
from app.services.booking_schedule import availability_for_date, slot_available
from app.services.route_estimate import estimate_road_distance_km, customer_freight_pricing


router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("", response_model=BookingRead)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Create a new booking with server route distance + freight model (diesel DOE price, dep., helper, driver %)."""
    km, _, _, _ = estimate_road_distance_km(
        payload.pickup_location,
        payload.dropoff_location,
        settings,
    )
    knobs = resolve_booking_freight_knobs(db, settings)
    pricing = customer_freight_pricing(km, payload.cargo_weight_tons, knobs)

    if not slot_available(db, payload.scheduled_date, payload.scheduled_time_slot):
        raise HTTPException(
            status_code=409,
            detail="That pickup time is already reserved for this date. Pick another slot.",
        )

    booking = Booking(
        customer_id=user.id,
        pickup_location=payload.pickup_location,
        dropoff_location=payload.dropoff_location,
        service_type=payload.service_type,
        scheduled_date=payload.scheduled_date,
        scheduled_time_slot=payload.scheduled_time_slot,
        cargo_weight_tons=payload.cargo_weight_tons,
        cargo_description=payload.cargo_description,
        estimated_cost=pricing["estimated_total"],
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


@router.get("/schedule-availability", response_model=BookingScheduleAvailabilityRead)
def booking_schedule_availability(
    scheduled_date: date,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Which standard time slots still have fleet capacity on this calendar day."""
    slots = availability_for_date(db, scheduled_date)
    return BookingScheduleAvailabilityRead(scheduled_date=scheduled_date, slots=slots)


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
