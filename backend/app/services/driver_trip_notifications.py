"""In-app driver trip notifications — created on assignment and trip/booking updates."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import Booking, DriverTripNotification, DriverTripNotificationKind, Trip, TripStatus


def _parse_route_waypoints(route_path: str | None) -> list[str]:
    raw = (route_path or "").strip()
    if not raw:
        return []
    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    if "->" in raw:
        return [p.strip() for p in raw.split("->") if p.strip()]
    return [raw]


def schedule_summary_for_booking(booking: Booking) -> str:
    date_part = booking.scheduled_date.isoformat() if booking.scheduled_date else "—"
    slot = (booking.scheduled_time_slot or "").strip()
    return f"{date_part} · {slot}" if slot else date_part


def route_summary_for_trip(booking: Booking | None, route_path: str | None = None) -> str:
    waypoints = _parse_route_waypoints(route_path)
    if len(waypoints) >= 2:
        return f"{waypoints[0]} → {waypoints[-1]}"
    if booking:
        pickup = (booking.pickup_location or "").strip()
        dropoff = (booking.dropoff_location or "").strip()
        if pickup and dropoff:
            return f"{pickup} → {dropoff}"
        if pickup or dropoff:
            return pickup or dropoff
    return "—"


def required_action_for_assigned() -> str:
    return (
        "Open Scheduled Bookings to review pickup time, route, truck, and helper. "
        "Coordinate with your helper before departure."
    )


def required_action_for_updated(update_reason: str = "details") -> str:
    if update_reason == "route":
        return "Route was updated — open Scheduled Bookings to review the new path before departure."
    return "Trip details were updated — review schedule and route in Scheduled Bookings."


def create_driver_trip_notification(
    db: Session,
    *,
    driver_id: int,
    booking_id: int,
    trip_id: int | None,
    kind: DriverTripNotificationKind | str,
    schedule_summary: str,
    route_summary: str,
    required_action: str,
) -> DriverTripNotification:
    kind_val = kind.value if isinstance(kind, DriverTripNotificationKind) else str(kind)
    row = DriverTripNotification(
        driver_id=driver_id,
        trip_id=trip_id,
        booking_id=booking_id,
        kind=kind_val,
        schedule_summary=schedule_summary,
        route_summary=route_summary,
        required_action=required_action,
    )
    db.add(row)
    return row


def notify_driver_trip_assigned(db: Session, trip: Trip, booking: Booking | None = None) -> DriverTripNotification | None:
    if not trip.driver_id:
        return None
    bk = booking or trip.booking
    if not bk:
        bk = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    if not bk:
        return None
    return create_driver_trip_notification(
        db,
        driver_id=trip.driver_id,
        booking_id=trip.booking_id,
        trip_id=trip.id,
        kind=DriverTripNotificationKind.ASSIGNED,
        schedule_summary=schedule_summary_for_booking(bk),
        route_summary=route_summary_for_trip(bk, trip.route_path),
        required_action=required_action_for_assigned(),
    )


def notify_driver_trip_updated(
    db: Session,
    trip: Trip,
    booking: Booking | None = None,
    *,
    update_reason: str = "details",
) -> DriverTripNotification | None:
    if not trip.driver_id:
        return None
    bk = booking or trip.booking
    if not bk:
        bk = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    if not bk:
        return None
    return create_driver_trip_notification(
        db,
        driver_id=trip.driver_id,
        booking_id=trip.booking_id,
        trip_id=trip.id,
        kind=DriverTripNotificationKind.UPDATED,
        schedule_summary=schedule_summary_for_booking(bk),
        route_summary=route_summary_for_trip(bk, trip.route_path),
        required_action=required_action_for_updated(update_reason),
    )


def notify_drivers_booking_route_updated(db: Session, booking_id: int) -> list[DriverTripNotification]:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        return []
    trips = (
        db.query(Trip)
        .filter(
            Trip.booking_id == booking_id,
            ~Trip.status.in_({TripStatus.COMPLETED, TripStatus.CANCELLED}),
        )
        .all()
    )
    created: list[DriverTripNotification] = []
    for trip in trips:
        row = notify_driver_trip_updated(db, trip, booking, update_reason="route")
        if row:
            created.append(row)
    return created


def serialize_driver_notification(row: DriverTripNotification) -> dict[str, Any]:
    return {
        "id": row.id,
        "trip_id": row.trip_id,
        "booking_id": row.booking_id,
        "kind": row.kind,
        "schedule_summary": row.schedule_summary,
        "route_summary": row.route_summary,
        "required_action": row.required_action,
        "read": row.read_at is not None,
        "read_at": row.read_at.isoformat() if row.read_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def list_driver_trip_notifications(
    db: Session,
    driver_id: int,
    *,
    unread_only: bool = False,
    limit: int = 30,
) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 100)
    q = db.query(DriverTripNotification).filter(DriverTripNotification.driver_id == driver_id)
    if unread_only:
        q = q.filter(DriverTripNotification.read_at.is_(None))
    rows = q.order_by(DriverTripNotification.created_at.desc()).limit(safe_limit).all()
    return [serialize_driver_notification(r) for r in rows]


def mark_driver_notification_read(db: Session, driver_id: int, notification_id: int) -> dict[str, Any] | None:
    row = (
        db.query(DriverTripNotification)
        .filter(
            DriverTripNotification.id == notification_id,
            DriverTripNotification.driver_id == driver_id,
        )
        .first()
    )
    if not row:
        return None
    if row.read_at is None:
        row.read_at = datetime.utcnow()
    return serialize_driver_notification(row)


def mark_all_driver_notifications_read(db: Session, driver_id: int) -> int:
    now = datetime.utcnow()
    rows = (
        db.query(DriverTripNotification)
        .filter(
            DriverTripNotification.driver_id == driver_id,
            DriverTripNotification.read_at.is_(None),
        )
        .all()
    )
    for row in rows:
        row.read_at = now
    return len(rows)
