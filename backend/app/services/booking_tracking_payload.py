"""Shared trip/assignment payload for customer tracking and booking tracking-details."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Booking, Trip, TripLocationUpdate, TripStatus, TripStatusUpdate, Truck, User


def build_assignments_for_booking(db: Session, booking: Booking) -> list[dict]:
    trips = db.query(Trip).filter(Trip.booking_id == booking.id).order_by(Trip.id.asc()).all()
    assignment_rows: list[dict] = []
    for tr in trips:
        truck = db.query(Truck).filter(Truck.id == tr.truck_id).first() if tr.truck_id else None
        driver = db.query(User).filter(User.id == tr.driver_id).first() if tr.driver_id else None
        helper = db.query(User).filter(User.id == tr.helper_id).first() if tr.helper_id else None
        location_updates = (
            db.query(TripLocationUpdate)
            .filter(TripLocationUpdate.trip_id == tr.id)
            .order_by(TripLocationUpdate.created_at.asc())
            .all()
        )
        status_updates = (
            db.query(TripStatusUpdate)
            .filter(TripStatusUpdate.trip_id == tr.id)
            .order_by(TripStatusUpdate.created_at.asc())
            .all()
        )
        effective_status = tr.helper_progress_status or (
            tr.status.value if hasattr(tr.status, "value") else str(tr.status)
        )
        latest_location_name = (
            location_updates[-1].location_name if location_updates else getattr(tr, "latest_location", None)
        )
        hp_key = (tr.helper_progress_status or "").strip().lower().replace(" ", "_")
        trip_st_l = (tr.status.value if hasattr(tr.status, "value") else str(tr.status)).lower()
        drop = (booking.dropoff_location or "").strip()
        if drop and (
            hp_key in ("completed", "dropped_off") or trip_st_l == TripStatus.COMPLETED.value
        ):
            latest_location_name = drop
        assignment_rows.append(
            {
                "trip_id": tr.id,
                "trip_status": tr.status.value if hasattr(tr.status, "value") else str(tr.status),
                "helper_progress_status": effective_status,
                "truck": (
                    {
                        "id": truck.id,
                        "code": truck.code,
                        "plate_number": truck.code,
                        "model_name": truck.model_name,
                        "capacity_tons": float(truck.capacity_tons),
                    }
                    if truck
                    else None
                ),
                "driver": {"id": driver.id, "name": driver.full_name} if driver else None,
                "helper": {"id": helper.id, "name": helper.full_name} if helper else None,
                "latest_location_name": latest_location_name,
                "location_updates": [
                    {
                        "location_name": u.location_name,
                        "remarks": u.remarks,
                        "photo_url": u.photo_url,
                        "created_at": u.created_at.isoformat(),
                    }
                    for u in location_updates
                ],
                "status_timeline": [
                    {
                        "status": u.status,
                        "location_name": u.location_name,
                        "remarks": u.remarks,
                        "photo_url": u.photo_url,
                        "created_at": u.created_at.isoformat(),
                    }
                    for u in status_updates
                ],
            }
        )
    return assignment_rows
