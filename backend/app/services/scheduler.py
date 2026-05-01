"""Driver/truck/helper availability + rolling weekly schedule helpers."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.entities import Booking, Trip, Truck, User, UserRole


def find_available_truck(db: Session, scheduled_date: date) -> Truck | None:
    scheduled_truck_ids = (
        db.query(Trip.truck_id)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Booking.scheduled_date == scheduled_date)
        .all()
    )
    blocked_ids = {row[0] for row in scheduled_truck_ids}

    query = db.query(Truck).filter(Truck.status == "available")
    if blocked_ids:
        query = query.filter(~Truck.id.in_(blocked_ids))
    return query.first()


def find_available_driver(db: Session, scheduled_date: date) -> User | None:
    scheduled_driver_ids = (
        db.query(Trip.driver_id)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Booking.scheduled_date == scheduled_date)
        .all()
    )
    blocked_ids = {row[0] for row in scheduled_driver_ids}

    query = db.query(User).filter(User.role == UserRole.DRIVER)
    if blocked_ids:
        query = query.filter(~User.id.in_(blocked_ids))
    return query.first()


def find_available_helper(db: Session, scheduled_date: date) -> User | None:
    scheduled_helper_ids = (
        db.query(Trip.helper_id)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Booking.scheduled_date == scheduled_date, Trip.helper_id.isnot(None))
        .all()
    )
    blocked_ids = {row[0] for row in scheduled_helper_ids if row[0] is not None}
    query = db.query(User).filter(User.role == UserRole.HELPER)
    if blocked_ids:
        query = query.filter(~User.id.in_(blocked_ids))
    return query.first()


def _week_dates(week_iso: str | None) -> list[date]:
    """Given an ISO week like '2026-W18' return Mon..Sun dates. None → current week."""
    if week_iso:
        try:
            year, wk = week_iso.split("-W")
            year, wk = int(year), int(wk)
            monday = datetime.fromisocalendar(year, wk, 1).date()
        except Exception:
            monday = date.today() - timedelta(days=date.today().weekday())
    else:
        monday = date.today() - timedelta(days=date.today().weekday())
    return [monday + timedelta(days=i) for i in range(7)]


def truck_week_board(db: Session, week_iso: str | None = None) -> dict:
    """Truck × day matrix (paper Fig 16)."""
    days = _week_dates(week_iso)
    trucks = db.query(Truck).order_by(Truck.code).all()

    # Bookings/Trips per (truck_id, date)
    activity: dict[tuple[int, date], dict] = {}
    rows = (
        db.query(Trip, Booking)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Booking.scheduled_date.in_(days))
        .all()
    )
    for trip, booking in rows:
        activity[(trip.truck_id, booking.scheduled_date)] = {
            "trip_id": trip.id,
            "booking_id": booking.id,
            "status": trip.status.value if hasattr(trip.status, "value") else str(trip.status),
            "pickup": booking.pickup_location,
            "dropoff": booking.dropoff_location,
        }

    matrix = []
    for truck in trucks:
        row = {
            "truck_id": truck.id,
            "code": truck.code,
            "capacity_tons": truck.capacity_tons,
            "status": truck.status,
            "days": [],
        }
        for d in days:
            cell = activity.get((truck.id, d))
            row["days"].append({
                "date": d.isoformat(),
                "weekday": d.strftime("%a"),
                "activity": cell,
            })
        matrix.append(row)

    return {
        "week_start": days[0].isoformat(),
        "week_end": days[-1].isoformat(),
        "trucks": matrix,
    }


def driver_week_board(db: Session, week_iso: str | None = None) -> dict:
    """Driver × day matrix (paper Fig 17)."""
    days = _week_dates(week_iso)
    drivers = db.query(User).filter(User.role == UserRole.DRIVER).order_by(User.full_name).all()

    activity: dict[tuple[int, date], dict] = {}
    rows = (
        db.query(Trip, Booking)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Booking.scheduled_date.in_(days))
        .all()
    )
    for trip, booking in rows:
        activity[(trip.driver_id, booking.scheduled_date)] = {
            "trip_id": trip.id,
            "truck_id": trip.truck_id,
            "status": trip.status.value if hasattr(trip.status, "value") else str(trip.status),
            "route": f"{booking.pickup_location} → {booking.dropoff_location}",
        }

    matrix = []
    for driver in drivers:
        row = {
            "driver_id": driver.id,
            "name": driver.full_name,
            "days": [],
        }
        for d in days:
            row["days"].append({
                "date": d.isoformat(),
                "weekday": d.strftime("%a"),
                "activity": activity.get((driver.id, d)),
            })
        matrix.append(row)

    return {
        "week_start": days[0].isoformat(),
        "week_end": days[-1].isoformat(),
        "drivers": matrix,
    }
