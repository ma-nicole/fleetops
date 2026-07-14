"""Shared trip/assignment payload for customer tracking and booking tracking-details."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Booking, Trip, TripLocationUpdate, TripStatusUpdate, Truck, User
from app.services.latest_location_display import latest_location_display_for_trip


def _photo_public(path: str | None) -> str | None:
    """Expose helper proofs as `/uploads/...` for frontend media helpers."""
    from app.services.upload_urls import normalize_upload_path

    return normalize_upload_path(path)


def _merge_assignment_timeline(
    *,
    booking_id: int,
    trip_id: int,
    driver_id: int | None,
    driver_name: str | None,
    helper_id: int | None,
    helper_name: str | None,
    status_updates: list[TripStatusUpdate],
    location_updates: list[TripLocationUpdate],
) -> list[dict]:
    events: list[dict] = []
    for u in status_updates:
        code = (u.status or "").strip().lower()
        events.append(
            {
                "at": u.created_at.isoformat(),
                "kind": "milestone",
                "code": code,
                "title": code,
                "detail": (u.location_name or "").strip(),
                "status": code,
                "location_name": u.location_name,
                "remarks": u.remarks,
                "photo_url": _photo_public(u.photo_url),
                "created_at": u.created_at.isoformat(),
                "booking_id": booking_id,
                "trip_id": trip_id,
                "helper_id": u.helper_id or helper_id,
                "helper_name": helper_name,
                "driver_id": driver_id,
                "driver_name": driver_name,
                "delivery_status": code,
                "latitude": u.latitude,
                "longitude": u.longitude,
                "evidence_latitude": u.latitude,
                "evidence_longitude": u.longitude,
                "evidence_device_captured_at": (
                    u.evidence_device_captured_at.isoformat() if u.evidence_device_captured_at else None
                ),
                "submitted_by": helper_name,
            }
        )
    for i, u in enumerate(location_updates, start=1):
        loc = (u.location_name or "").strip()
        events.append(
            {
                "at": u.created_at.isoformat(),
                "kind": "location",
                "code": f"location_update_{i}",
                "title": f"Update #{i} — {loc}" if loc else f"Update #{i}",
                "detail": loc,
                "status": "en_route",
                "location_name": u.location_name,
                "remarks": u.remarks,
                "photo_url": _photo_public(u.photo_url),
                "created_at": u.created_at.isoformat(),
                "booking_id": booking_id,
                "trip_id": trip_id,
                "helper_id": u.helper_id or helper_id,
                "helper_name": helper_name,
                "driver_id": driver_id,
                "driver_name": driver_name,
                "delivery_status": "en_route",
                "latitude": u.latitude,
                "longitude": u.longitude,
                "evidence_latitude": u.latitude,
                "evidence_longitude": u.longitude,
                "evidence_device_captured_at": (
                    u.evidence_device_captured_at.isoformat() if u.evidence_device_captured_at else None
                ),
                "submitted_by": helper_name,
                "update_index": i,
            }
        )
    events.sort(key=lambda e: e["at"])
    return events


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
        latest_ping = None
        if location_updates:
            latest_ping = location_updates[-1].location_name
        if not (latest_ping or "").strip():
            for u in reversed(status_updates):
                if (u.location_name or "").strip():
                    latest_ping = u.location_name
                    break
        if not (latest_ping or "").strip():
            latest_ping = getattr(tr, "latest_location", None)

        latest_location_name = latest_location_display_for_trip(
            tr,
            booking.dropoff_location,
            latest_ping,
        )
        driver_name = driver.full_name if driver else None
        helper_name = helper.full_name if helper else None
        timeline_events = _merge_assignment_timeline(
            booking_id=booking.id,
            trip_id=tr.id,
            driver_id=tr.driver_id,
            driver_name=driver_name,
            helper_id=tr.helper_id,
            helper_name=helper_name,
            status_updates=status_updates,
            location_updates=location_updates,
        )
        assignment_rows.append(
            {
                "trip_id": tr.id,
                "booking_id": booking.id,
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
                        "photo_url": _photo_public(u.photo_url),
                        "created_at": u.created_at.isoformat(),
                        "booking_id": booking.id,
                        "trip_id": tr.id,
                        "helper_id": u.helper_id or tr.helper_id,
                        "helper_name": helper_name,
                        "driver_id": tr.driver_id,
                        "driver_name": driver_name,
                        "delivery_status": "en_route",
                        "latitude": u.latitude,
                        "longitude": u.longitude,
                    }
                    for u in location_updates
                ],
                "status_timeline": [
                    {
                        "status": u.status,
                        "location_name": u.location_name,
                        "remarks": u.remarks,
                        "photo_url": _photo_public(u.photo_url),
                        "created_at": u.created_at.isoformat(),
                        "booking_id": booking.id,
                        "trip_id": tr.id,
                        "helper_id": u.helper_id or tr.helper_id,
                        "helper_name": helper_name,
                        "driver_id": tr.driver_id,
                        "driver_name": driver_name,
                        "delivery_status": (u.status or "").strip().lower(),
                        "latitude": u.latitude,
                        "longitude": u.longitude,
                    }
                    for u in status_updates
                ],
                "timeline_events": timeline_events,
            }
        )
    return assignment_rows
