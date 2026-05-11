from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.entities import (
    Booking,
    Trip,
    TripStatus,
    TripStatusUpdate,
    TruckAssignment,
    TruckAssignmentStatus,
)
from app.services.booking_status_aggregate import apply_aggregate_booking_status


STEP_TO_TRIP_STATUS: dict[str, TripStatus] = {
    "for_pickup": TripStatus.ACCEPTED,
    "picked_up": TripStatus.LOADING,
    "en_route": TripStatus.IN_DELIVERY,
    "dropped_off": TripStatus.IN_DELIVERY,
    "completed": TripStatus.COMPLETED,
    "cancelled": TripStatus.CANCELLED,
}

STEP_TO_ASSIGNMENT_STATUS: dict[str, TruckAssignmentStatus] = {
    "for_pickup": TruckAssignmentStatus.FOR_PICKUP,
    "picked_up": TruckAssignmentStatus.PICKED_UP,
    "en_route": TruckAssignmentStatus.EN_ROUTE,
    "dropped_off": TruckAssignmentStatus.DROPPED_OFF,
    "completed": TruckAssignmentStatus.COMPLETED,
    "cancelled": TruckAssignmentStatus.CANCELLED,
}


def sync_trip_and_booking_status(
    db: Session,
    trip_id: int,
    new_trip_status: str,
    *,
    helper_id: int,
    location_name: str = "",
    remarks: str = "",
    photo_url: str | None = None,
) -> tuple[Trip, Booking]:
    trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
    if not trip:
        raise ValueError("Trip not found")
    booking = db.query(Booking).filter(Booking.id == trip.booking_id).with_for_update().first()
    if not booking:
        raise ValueError("Related booking not found")

    step = (new_trip_status or "").strip().lower()
    if step not in STEP_TO_TRIP_STATUS:
        raise ValueError(f"Unsupported trip status: {new_trip_status}")

    trip.helper_progress_status = step
    trip.status = STEP_TO_TRIP_STATUS[step]
    if step == "completed":
        trip.completed_at = datetime.utcnow()

    loc = (location_name or "").strip() or f"Status updated: {step.replace('_', ' ')}"
    trip.latest_location = loc
    booking.latest_location = loc

    db.query(TruckAssignment).filter(
        TruckAssignment.booking_id == trip.booking_id,
        TruckAssignment.truck_id == trip.truck_id,
        TruckAssignment.driver_id == trip.driver_id,
        TruckAssignment.helper_id == trip.helper_id,
    ).update({"assignment_status": STEP_TO_ASSIGNMENT_STATUS[step]})

    # Multi-truck: booking.status always derived from ALL trips (never COMPLETED from one trip alone).
    apply_aggregate_booking_status(db, booking)

    db.add(
        TripStatusUpdate(
            booking_id=booking.id,
            trip_id=trip.id,
            helper_id=helper_id,
            status=step,
            location_name=loc,
            latitude=None,
            longitude=None,
            remarks=(remarks or "").strip() or None,
            photo_url=photo_url,
        )
    )
    db.flush()
    return trip, booking
