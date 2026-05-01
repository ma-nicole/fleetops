"""
Workflow orchestration routes for complete booking-to-delivery sequence
"""
from datetime import datetime, timedelta
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import (
    Booking, BookingStatus, Trip, TripStatus, User, UserRole,
    Truck, TripIssue
)
from app.schemas.booking import BookingApprovalRequest, BookingRead
from app.schemas.trip import (
    TripRead, TripStatusUpdate, TripAcceptRequest, TripDeliveryProof,
    TripIssueReport, TripIssueRead
)
from app.services.costing import estimate_trip_cost
from app.services.email_templates import EmailTemplate
from app.services.feedback_loop import record_trip_feedback
from app.services.notifications import send_email_notification
from app.services.predictive.cost_model import predict_trip_cost
from app.services.routing import optimize_route
from app.services.scheduler import find_available_driver, find_available_truck
from app.schemas.analytics import CostPredictionRequest
from app.schemas.predict import TripCostPredictRequest


router = APIRouter(prefix="/workflow", tags=["workflow"])


# ============================================================================
# A. BOOKING FLOW (USER → MANAGER)
# ============================================================================

@router.post("/booking/create", response_model=BookingRead)
def create_booking_request(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """
    User creates booking request (Status: Pending Approval)
    Input: date, origin, destination, load
    """
    from app.schemas.booking import BookingCreate
    from app.models.entities import ServiceType

    booking_data = BookingCreate(
        pickup_location=payload.get("pickup_location"),
        dropoff_location=payload.get("dropoff_location"),
        service_type=ServiceType(payload.get("service_type", "customized")),
        scheduled_date=payload.get("scheduled_date"),
        cargo_weight_tons=payload.get("cargo_weight_tons"),
        cargo_description=payload.get("cargo_description"),
    )

    # Use the paper §3.2.8 trip-cost predictor (regression-blended) for the customer-facing quote.
    prediction = predict_trip_cost(
        TripCostPredictRequest(
            distance_km=float(payload.get("distance_km") or 120),
            cargo_weight_tons=float(booking_data.cargo_weight_tons),
            avg_speed_kmh=float(payload.get("avg_speed_kmh") or 50),
            road_condition=str(payload.get("road_condition") or "highway"),
            fuel_price_per_liter=float(payload.get("fuel_price_per_liter") or 60.0),
            labor_rate_per_hour=float(payload.get("labor_rate_per_hour") or 100.0),
            toll_rate_per_km=float(payload.get("toll_rate_per_km") or 1.5),
        ),
        db=db,
    )

    booking = Booking(
        customer_id=user.id,
        pickup_location=booking_data.pickup_location,
        dropoff_location=booking_data.dropoff_location,
        service_type=booking_data.service_type,
        scheduled_date=booking_data.scheduled_date,
        cargo_weight_tons=booking_data.cargo_weight_tons,
        cargo_description=booking_data.cargo_description,
        estimated_cost=prediction.total_cost,
        status=BookingStatus.PENDING_APPROVAL,
    )

    db.add(booking)
    db.commit()
    db.refresh(booking)

    # Send confirmation email
    subject, html_body = EmailTemplate.booking_confirmation(
        booking_id=booking.id,
        estimated_cost=booking.estimated_cost,
        scheduled_date=str(booking.scheduled_date),
    )
    send_email_notification(to_email=user.email, subject=subject, html_body=html_body)

    return booking


@router.get("/booking/pending-approval", response_model=list[BookingRead])
def get_pending_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    """Manager retrieves pending booking approvals"""
    bookings = db.query(Booking).filter(
        Booking.status == BookingStatus.PENDING_APPROVAL
    ).order_by(Booking.created_at.desc()).all()
    return bookings


@router.get("/booking/assignable", response_model=list[BookingRead])
def get_assignable_bookings_for_dispatch(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Approved bookings waiting for dispatcher assignment (Job Assignment wizard)."""
    bookings = (
        db.query(Booking)
        .filter(Booking.status == BookingStatus.APPROVED)
        .order_by(Booking.created_at.desc())
        .all()
    )
    return bookings


@router.post("/booking/{booking_id}/approve", response_model=BookingRead)
def approve_booking(
    booking_id: int,
    request: BookingApprovalRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    """
    Manager approves or rejects booking
    Status: Pending Approval → Approved (or Rejected)
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=400,
            detail=f"Booking is in {booking.status} status, cannot approve/reject"
        )

    if request.approved:
        booking.status = BookingStatus.APPROVED
        booking.approved_by_id = user.id
        booking.approved_at = datetime.utcnow()
        message = f"Your booking #{booking.id} has been approved!"
    else:
        booking.status = BookingStatus.REJECTED
        booking.approved_by_id = user.id
        booking.approved_at = datetime.utcnow()
        booking.rejection_reason = request.rejection_reason
        message = f"Your booking #{booking.id} was rejected: {request.rejection_reason}"

    db.commit()
    db.refresh(booking)

    # Send notification to customer
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer:
        subject = f"Booking #{booking.id} {'Approved' if request.approved else 'Rejected'}"
        send_email_notification(to_email=customer.email, subject=subject, html_body=message)

    return booking


# ============================================================================
# B. JOB CREATION (MANAGER → DISPATCHER)
# ============================================================================

@router.post("/job/create-from-booking/{booking_id}", response_model=TripRead)
def create_job_from_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    """
    Manager creates job assignment from approved booking
    Dispatcher receives job for assignment
    Status: Approved → Assigned
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Booking must be approved to create job. Current status: {booking.status}"
        )

    # Find available truck and driver
    truck = find_available_truck(db, booking.scheduled_date)
    driver = find_available_driver(db, booking.scheduled_date)

    if not truck or not driver:
        raise HTTPException(
            status_code=400,
            detail="No available truck or driver for this date"
        )

    # Optimize route
    route = optimize_route("Warehouse", "City-1", weight="cost")

    # Create trip
    trip = Trip(
        booking_id=booking.id,
        truck_id=truck.id,
        driver_id=driver.id,
        dispatcher_id=user.id,
        route_path=json.dumps(route.get("path", [])),
        distance_km=route.get("score", 120) if route.get("weight") == "distance" else 120,
        toll_cost=45,
        fuel_cost=120,
        labor_cost=80,
        duration_hours=6,
        status=TripStatus.ASSIGNED,
        assigned_at=datetime.utcnow(),
        estimated_delivery_time=datetime.utcnow() + timedelta(hours=8),
    )

    booking.status = BookingStatus.ASSIGNED

    db.add(trip)
    db.commit()
    db.refresh(trip)

    # Send notification to driver
    driver_user = db.query(User).filter(User.id == driver.id).first()
    if driver_user:
        subject = f"New Job Assignment: {booking.pickup_location} → {booking.dropoff_location}"
        message = f"You have been assigned job #{trip.id}. Please review and accept."
        send_email_notification(to_email=driver_user.email, subject=subject, html_body=message)

    # Send notification to customer
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer:
        subject = f"Your booking #{booking.id} is assigned"
        message = f"Your shipment has been assigned to driver {driver_user.full_name}"
        send_email_notification(to_email=customer.email, subject=subject, html_body=message)

    return trip


# ============================================================================
# C. DRIVER ACCEPTANCE & EXECUTION (DRIVER → SYSTEM → USER)
# ============================================================================

@router.post("/job/{trip_id}/accept", response_model=TripRead)
def accept_job(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """
    Driver accepts job assignment
    Status: Assigned → Accepted
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to accept this job")

    if trip.status != TripStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail=f"Trip is in {trip.status} status")

    trip.status = TripStatus.ACCEPTED
    trip.accepted_at = datetime.utcnow()

    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    booking.status = BookingStatus.ACCEPTED

    db.commit()
    db.refresh(trip)

    # Notify customer
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer:
        subject = f"Your delivery is confirmed (Job #{trip_id})"
        send_email_notification(to_email=customer.email, subject=subject, html_body="Your driver has accepted the job and will depart soon.")

    return trip


@router.post("/job/{trip_id}/depart", response_model=TripRead)
def depart_to_pickup(
    trip_id: int,
    update: TripStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """
    Driver departs to pickup location
    Status: Accepted → Enroute (Departed)
    Updates: location, ETA
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    trip.status = TripStatus.DEPARTED
    trip.departure_time = datetime.utcnow()
    trip.current_latitude = update.latitude
    trip.current_longitude = update.longitude

    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    booking.status = BookingStatus.ENROUTE

    db.commit()
    db.refresh(trip)

    # Notify customer
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer:
        send_email_notification(
            to_email=customer.email,
            subject=f"Your delivery is enroute (Job #{trip_id})",
            html_body="Your driver is on the way to pickup your shipment."
        )

    return trip


@router.post("/job/{trip_id}/arrived-pickup", response_model=TripRead)
def arrived_at_pickup(
    trip_id: int,
    update: TripStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """
    Driver arrived at pickup location and starting loading
    Status: Departed → Loading
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    trip.arrival_pickup_time = datetime.utcnow()
    trip.loading_start_time = datetime.utcnow()
    trip.status = TripStatus.LOADING

    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    booking.status = BookingStatus.LOADING

    db.commit()
    db.refresh(trip)

    return trip


@router.post("/job/{trip_id}/loading-complete", response_model=TripRead)
def loading_complete(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """
    Driver finished loading, ready to depart for delivery
    Status: Loading → In Delivery (Out for Delivery)
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    trip.loading_end_time = datetime.utcnow()
    trip.departure_delivery_time = datetime.utcnow()
    trip.status = TripStatus.IN_DELIVERY

    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    booking.status = BookingStatus.OUT_FOR_DELIVERY

    db.commit()
    db.refresh(trip)

    # Notify customer
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer:
        send_email_notification(
            to_email=customer.email,
            subject=f"Your delivery is out for delivery (Job #{trip_id})",
            html_body="Your shipment is on the way to your destination."
        )

    return trip


@router.post("/job/{trip_id}/complete", response_model=TripRead)
def complete_delivery(
    trip_id: int,
    proof: TripDeliveryProof,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """
    Driver marks delivery as complete with POD (proof of delivery)
    Status: In Delivery → Completed
    Capture: signature/image, notes
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    trip.arrival_delivery_time = datetime.utcnow()
    trip.completed_at = datetime.utcnow()
    trip.status = TripStatus.COMPLETED
    trip.proof_of_delivery = proof.proof_url
    trip.pod_notes = proof.notes

    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    booking.status = BookingStatus.COMPLETED
    booking.actual_cost = (
        trip.toll_cost + trip.fuel_cost + trip.labor_cost
    )

    # Mark truck as available
    truck = db.query(Truck).filter(Truck.id == trip.truck_id).first()
    if truck:
        truck.status = "available"

    db.commit()
    db.refresh(trip)

    # Paper Fig 24 — drop predicted vs actual into the feedback store.
    record_trip_feedback(db, trip)

    # Notify customer with receipt
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer:
        send_email_notification(
            to_email=customer.email,
            subject=f"Your delivery is complete (Receipt #{trip_id})",
            html_body=f"""
            Your shipment has been delivered!
            
            Receipt:
            - Trip ID: {trip.id}
            - Distance: {trip.distance_km} km
            - Cost: ${booking.actual_cost:.2f}
            
            Thank you for using our service.
            """
        )

    return trip


# ============================================================================
# D. REAL-TIME UPDATES
# ============================================================================

@router.post("/job/{trip_id}/update-status", response_model=TripRead)
def update_trip_status(
    trip_id: int,
    update: TripStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.DISPATCHER)),
):
    """
    Update trip status and location (real-time updates for dispatcher/manager dashboard)
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if user.role == UserRole.DRIVER and trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    trip.current_latitude = update.latitude
    trip.current_longitude = update.longitude
    trip.status = update.status
    trip.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(trip)

    return trip


@router.get("/job/{trip_id}", response_model=TripRead)
def get_trip_details(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get trip details with current status and location"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Authorization check
    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if user.role == UserRole.DRIVER and trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return trip


# ============================================================================
# E. CANCELLATION FLOW
# ============================================================================

@router.post("/booking/{booking_id}/cancel")
def request_cancellation(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN)),
):
    """
    User requests cancellation
    Manager approves and system releases driver/truck
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if booking.status in [BookingStatus.COMPLETED, BookingStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or already cancelled booking")

    # Find associated trip
    trip = db.query(Trip).filter(Trip.booking_id == booking.id).first()
    if trip:
        trip.status = TripStatus.CANCELLED
        truck = db.query(Truck).filter(Truck.id == trip.truck_id).first()
        if truck:
            truck.status = "available"

    booking.status = BookingStatus.CANCELLED

    db.commit()
    db.refresh(booking)

    # Notify user
    send_email_notification(
        to_email=user.email,
        subject=f"Booking #{booking.id} has been cancelled",
        html_body="Your booking cancellation has been processed."
    )

    return {"message": "Cancellation processed", "booking_id": booking.id}


# ============================================================================
# F. EXCEPTION HANDLING FLOW
# ============================================================================

@router.post("/job/{trip_id}/report-issue", response_model=TripIssueRead)
def report_trip_issue(
    trip_id: int,
    issue: TripIssueReport,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """
    Driver reports issue (breakdown, traffic delay, etc)
    Dispatcher notifies system and updates ETA
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    trip_issue = TripIssue(
        trip_id=trip.id,
        reported_by_id=user.id,
        issue_type=issue.issue_type,
        description=issue.description,
        severity=issue.severity,
    )

    db.add(trip_issue)

    # Notify dispatcher/manager
    if trip.dispatcher_id:
        dispatcher = db.query(User).filter(User.id == trip.dispatcher_id).first()
        if dispatcher:
            send_email_notification(
                to_email=dispatcher.email,
                subject=f"Issue reported on trip {trip.id}",
                html_body=f"Driver reported: {issue.description}"
            )

    db.commit()
    db.refresh(trip_issue)

    return trip_issue


@router.get("/job/{trip_id}/issues", response_model=list[TripIssueRead])
def get_trip_issues(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all issues reported on a trip"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    issues = db.query(TripIssue).filter(TripIssue.trip_id == trip.id).all()
    return issues


@router.post("/issue/{issue_id}/resolve")
def resolve_issue(
    issue_id: int,
    resolution_notes: str = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Dispatcher/Manager resolves reported issue"""
    trip_issue = db.query(TripIssue).filter(TripIssue.id == issue_id).first()
    if not trip_issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    trip_issue.resolved = True
    trip_issue.resolution_notes = resolution_notes
    trip_issue.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(trip_issue)

    return {"message": "Issue resolved", "issue_id": issue_id}
