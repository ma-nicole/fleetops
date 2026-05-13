"""Crew (driver / helper) dashboard KPIs — all values derived from DB rows for the authenticated user."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from sqlalchemy.orm import Session, joinedload

from app.models.entities import Booking, BookingStatus, Trip, TripStatus
from app.services.dispatch_operations_center import _display_status

ACTIVE_OPERATIONAL = frozenset({"assigned", "for_pickup", "picked_up", "en_route", "dropped_off"})

_EXCLUDED_BOOKING_STATUSES: tuple[BookingStatus, ...] = (
    BookingStatus.CANCELLED,
    BookingStatus.REJECTED,
    BookingStatus.PAYMENT_REJECTED,
)

CrewRole = Literal["driver", "helper"]


def _crew_trips(db: Session, *, crew_user_id: int, role: CrewRole) -> list[Trip]:
    q = (
        db.query(Trip)
        .options(joinedload(Trip.booking))
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(
            Trip.status != TripStatus.CANCELLED,
            ~Booking.status.in_(_EXCLUDED_BOOKING_STATUSES),
        )
    )
    if role == "driver":
        q = q.filter(Trip.driver_id == crew_user_id)
    else:
        q = q.filter(Trip.helper_id == crew_user_id)
    return q.all()


def build_crew_dashboard_metrics(db: Session, *, crew_user_id: int, role: CrewRole, today: date) -> dict[str, Any]:
    trips = _crew_trips(db, crew_user_id=crew_user_id, role=role)

    assigned_today = 0
    completed_today = 0
    active_trips = 0
    completed_legs_total = 0
    distance_sum_km = 0.0
    distance_trip_count = 0
    fuel_completed_sum = 0.0
    trip_labor_completed_sum = 0.0
    completion_numer = 0
    completion_denom = 0

    for t in trips:
        bk = t.booking
        if bk is None:
            continue

        op = _display_status(t)

        if t.assigned_at is not None and t.assigned_at.date() == today:
            assigned_today += 1

        if t.status == TripStatus.COMPLETED:
            completed_legs_total += 1
            end = t.completed_at or t.updated_at
            if end is not None and end.date() == today:
                completed_today += 1

        if t.status != TripStatus.COMPLETED and op in ACTIVE_OPERATIONAL:
            active_trips += 1

        if t.status == TripStatus.COMPLETED or op in ACTIVE_OPERATIONAL:
            distance_sum_km += float(t.distance_km or 0)
            distance_trip_count += 1

        if t.status == TripStatus.COMPLETED:
            fuel_completed_sum += float(t.fuel_cost or 0)
            trip_labor_completed_sum += float(t.labor_cost or 0)

        if t.assigned_at is not None:
            completion_denom += 1
            if t.status == TripStatus.COMPLETED:
                completion_numer += 1

    avg_km = round(distance_sum_km / distance_trip_count, 1) if distance_trip_count else 0.0
    completion_pct = round(100.0 * completion_numer / completion_denom, 1) if completion_denom else 0.0

    return {
        "assignments_today": {
            "total_assigned_today": assigned_today,
            "active_trips": active_trips,
            "completed_today": completed_today,
            "completed_legs_total": completed_legs_total,
        },
        "distance_loaded_km": {
            "total_km": round(distance_sum_km, 1),
            "average_km": avg_km,
            "trip_count": distance_trip_count,
        },
        "fuel_completed_php": round(fuel_completed_sum, 2),
        "trip_labor_completed_php": round(trip_labor_completed_sum, 2),
        "completion_rate_percent": completion_pct,
        "completion_counts": {
            "completed_assigned_legs": completion_numer,
            "assigned_legs_excluded_cancelled": completion_denom,
        },
    }


def build_driver_dashboard_metrics(db: Session, *, driver_user_id: int, today: date) -> dict[str, Any]:
    """Backward-compatible alias — same as crew metrics scoped as driver."""
    return build_crew_dashboard_metrics(db, crew_user_id=driver_user_id, role="driver", today=today)
