import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import Booking, BookingStatus, Trip, User, UserRole
from app.services.email_templates import EmailTemplate
from app.services.notifications import send_email_notification
from app.services.routing import optimize_route
from app.services.scheduler import find_available_driver, find_available_truck


router = APIRouter(prefix="/dispatch", tags=["dispatch"])


@router.post("/{booking_id}/assign")
def assign_trip(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Assign truck and driver to a booking and send notification email"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    truck = find_available_truck(db, booking.scheduled_date)
    driver = find_available_driver(db, booking.scheduled_date)
    if not truck or not driver:
        raise HTTPException(status_code=400, detail="No available truck/driver")

    route = optimize_route("Warehouse", "City-1", weight="cost")
    trip = Trip(
        booking_id=booking.id,
        truck_id=truck.id,
        driver_id=driver.id,
        route_path=json.dumps(route["path"]),
        distance_km=route["score"] if route["weight"] == "distance" else 120,
        toll_cost=45,
        fuel_cost=120,
        labor_cost=80,
        duration_hours=6,
    )
    booking.status = BookingStatus.ASSIGNED

    db.add(trip)
    db.commit()
    db.refresh(trip)

    # Send trip assignment email to customer
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer:
        subject, html_body = EmailTemplate.trip_assigned(
            trip_id=trip.id,
            driver_name=driver.full_name,
            truck_code=truck.code,
            pickup=booking.pickup_location,
            dropoff=booking.dropoff_location,
        )
        send_email_notification(to_email=customer.email, subject=subject, html_body=html_body)

    return {
        "trip_id": trip.id,
        "booking_id": booking.id,
        "truck_id": truck.id,
        "driver_id": driver.id,
        "route": route,
    }


@router.post("/trip/{trip_id}/status")
def update_trip_status(
    trip_id: int,
    status: BookingStatus,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.DRIVER, UserRole.ADMIN)),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = status
    db.commit()
    return {"booking_id": booking.id, "status": booking.status}
