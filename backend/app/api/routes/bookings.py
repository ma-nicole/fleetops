from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    User,
    UserRole,
)
from app.schemas.booking import BookingCreate, BookingRead, BookingScheduleAvailabilityRead
from app.services.email_templates import EmailTemplate
from app.services.notifications import send_email_notification
from app.core.config import settings
from app.constants.booking_time_slots import BOOKING_TIME_SLOTS
from app.constants.fleet_capacity import cargo_exceeds_fleet
from app.services.booking_freight_knobs import resolve_booking_freight_knobs
from app.services.booking_capacity import get_available_truck_count
from app.services.route_estimate import estimate_road_distance_km, customer_freight_pricing
from app.constants.fleet_capacity import trucks_required_for_cargo
from app.models.entities import TruckSlotHold, TruckSlotHoldStatus
from app.services.booking_road_distance import booking_pickup_dropoff_distance_km
from app.services.booking_tracking_payload import build_assignments_for_booking
from app.services.booking_status_aggregate import aggregate_customer_display_from_assignment_rows


router = APIRouter(prefix="/bookings", tags=["bookings"])


def _sync_bookings_approved_from_verified_payments(db: Session, customer_id: int | None) -> None:
    """Set booking to approved when payment is already verified (fixes rows missed by ORM / legacy DB).

    Uses raw SQL so we never load Booking ORM rows while status text is still a legacy ENUM name
    (e.g. PENDING_APPROVAL) — that would raise LookupError before startup normalization runs.
    """
    extra = ""
    params: dict = {}
    if customer_id is not None:
        extra = " AND b.customer_id = :cid"
        params["cid"] = customer_id
    # Accept both normalized and legacy pending labels in WHERE
    stmt = text(
        """
        UPDATE bookings b
        INNER JOIN (
            SELECT booking_id, MAX(id) AS mid
            FROM payments
            WHERE status = 'verified'
            GROUP BY booking_id
        ) v ON v.booking_id = b.id
        INNER JOIN payments p ON p.id = v.mid
        SET
            b.status = 'payment_verified',
            b.approved_at = COALESCE(b.approved_at, p.reviewed_at, p.paid_at),
            b.approved_by_id = COALESCE(b.approved_by_id, p.reviewed_by_id)
        WHERE b.status IN ('pending_approval', 'PENDING_APPROVAL', 'payment_verification')
        """
        + extra
    )
    r = db.execute(stmt, params)
    rc = getattr(r, "rowcount", None)
    if rc is not None and rc > 0:
        db.commit()


@router.post("", response_model=BookingRead)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Create a new booking with routed road distance and cargo-based customer quote."""
    est = estimate_road_distance_km(
        payload.pickup_location,
        payload.dropoff_location,
        settings,
    )
    km = est.distance_km
    knobs = resolve_booking_freight_knobs(db, settings)
    pricing = customer_freight_pricing(km, payload.cargo_weight_tons, knobs)

    if cargo_exceeds_fleet(payload.cargo_weight_tons):
        raise HTTPException(
            status_code=400,
            detail="Cargo exceeds simultaneous fleet capacity (four trucks × 42 t). Split into multiple bookings.",
        )

    required_trucks = trucks_required_for_cargo(payload.cargo_weight_tons)
    availability = get_available_truck_count(
        db,
        payload.scheduled_date,
        payload.scheduled_time_slot,
        required_trucks=required_trucks,
        lock_rows=False,
    )
    if not availability.can_book:
        raise HTTPException(
            status_code=409,
            detail="Not enough trucks available for this schedule. Please choose another date/time.",
        )

    try:
        recheck = get_available_truck_count(
            db,
            payload.scheduled_date,
            payload.scheduled_time_slot,
            required_trucks=required_trucks,
            lock_rows=True,
        )
        if not recheck.can_book:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Not enough trucks available for this schedule. Please choose another date/time.",
            )

        booking = Booking(
            customer_id=user.id,
            pickup_location=payload.pickup_location,
            dropoff_location=payload.dropoff_location,
            service_type=payload.service_type,
            scheduled_date=payload.scheduled_date,
            scheduled_time_slot=payload.scheduled_time_slot,
            cargo_weight_tons=payload.cargo_weight_tons,
            required_truck_count=required_trucks,
            cargo_description=payload.cargo_description,
            estimated_cost=pricing["quoted_total"],
            status=BookingStatus.PAYMENT_VERIFICATION,
        )
        db.add(booking)
        db.flush()

        hold = TruckSlotHold(
            booking_id=booking.id,
            schedule_date=payload.scheduled_date,
            time_slot=payload.scheduled_time_slot,
            required_truck_count=required_trucks,
            hold_status=TruckSlotHoldStatus.ON_HOLD,
        )
        db.add(hold)
        db.commit()
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(booking)

    # Send confirmation email with template
    subject, html_body = EmailTemplate.booking_confirmation(
        booking_id=booking.id,
        quoted_amount_php=float(booking.estimated_cost or 0),
        scheduled_date=str(booking.scheduled_date),
    )
    send_email_notification(to_email=user.email, subject=subject, html_body=html_body)

    return booking


@router.get("/schedule-availability", response_model=BookingScheduleAvailabilityRead)
def booking_schedule_availability(
    scheduled_date: date,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
    cargo_weight_tons: float = Query(default=1.0, ge=0.1, le=168.0),
    pickup_location: str = Query(default=""),
    dropoff_location: str = Query(default=""),
):
    """Open slots account for weight and reserved truck-count for that exact date/time slot."""
    required_trucks = trucks_required_for_cargo(cargo_weight_tons)
    if len(pickup_location.strip()) < 3 or len(dropoff_location.strip()) < 3:
        slots: dict[str, bool] = {}
        available_by_slot: dict[str, int] = {}
        for slot in BOOKING_TIME_SLOTS:
            cap = get_available_truck_count(
                db,
                scheduled_date,
                slot,
                required_trucks=required_trucks,
                lock_rows=False,
            )
            slots[slot] = cap.can_book
            available_by_slot[slot] = cap.available_trucks
        return BookingScheduleAvailabilityRead(
            scheduled_date=scheduled_date,
            slots=slots,
            required_trucks=required_trucks,
            available_trucks_by_slot=available_by_slot,
        )

    slots: dict[str, bool] = {}
    available_by_slot: dict[str, int] = {}
    for slot in BOOKING_TIME_SLOTS:
        cap = get_available_truck_count(
            db,
            scheduled_date,
            slot,
            required_trucks=required_trucks,
            lock_rows=False,
        )
        slots[slot] = cap.can_book
        available_by_slot[slot] = cap.available_trucks
    return BookingScheduleAvailabilityRead(
        scheduled_date=scheduled_date,
        slots=slots,
        required_trucks=required_trucks,
        available_trucks_by_slot=available_by_slot,
    )


@router.get("", response_model=list[BookingRead])
def list_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cid = user.id if user.role == UserRole.CUSTOMER else None
    _sync_bookings_approved_from_verified_payments(db, cid)
    query = db.query(Booking)
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Booking.customer_id == user.id)
    return query.order_by(Booking.created_at.desc()).all()


@router.get("/{booking_id}", response_model=BookingRead)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cid = user.id if user.role == UserRole.CUSTOMER else None
    _sync_bookings_approved_from_verified_payments(db, cid)
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return booking


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

    if user.role == UserRole.CUSTOMER:
        if booking.status not in (BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_VERIFICATION):
            raise HTTPException(
                status_code=400,
                detail="Cancellation is only allowed before payment is verified.",
            )

    booking.status = BookingStatus.CANCELLED
    db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
        {"hold_status": TruckSlotHoldStatus.CANCELLED}
    )
    db.commit()
    return {"status": "cancelled"}


@router.get("/{booking_id}/tracking-details")
def booking_tracking_details(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    assignment_rows = build_assignments_for_booking(db, booking)
    road_km = booking_pickup_dropoff_distance_km(booking)

    booking_effective_status = (
        aggregate_customer_display_from_assignment_rows(assignment_rows)
        if assignment_rows
        else (booking.status.value if hasattr(booking.status, "value") else str(booking.status))
    )

    return {
        "booking": {
            "id": booking.id,
            "status": booking_effective_status,
            "pickup_location": booking.pickup_location,
            "dropoff_location": booking.dropoff_location,
            "cargo_weight_tons": float(booking.cargo_weight_tons),
            "scheduled_date": booking.scheduled_date.isoformat(),
            "scheduled_time_slot": booking.scheduled_time_slot,
            "required_truck_count": int(booking.required_truck_count or 1),
            "road_distance_km": float(road_km) if road_km is not None else None,
        },
        "assignments": assignment_rows,
    }
