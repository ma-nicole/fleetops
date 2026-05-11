"""Pickup-window capacity: four trucks × 42 t, with overlap by estimated trip duration."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.constants.booking_time_slots import (
    BOOKING_SLOT_TERMINAL_STATUSES,
    BOOKING_TIME_SLOTS,
)
from app.constants.fleet_capacity import (
    DEFAULT_ROAD_SPEED_KMH_FOR_ETA,
    FLEET_TRUCK_COUNT,
    MIN_TRIP_DURATION_HOURS,
    trucks_required_for_cargo,
)
from app.core.config import Settings, settings as app_settings
from app.models.entities import Booking, Trip, TripStatus
from app.services.route_estimate import estimate_road_distance_km

_TERMINAL_TRIP: frozenset[TripStatus] = frozenset({TripStatus.COMPLETED, TripStatus.CANCELLED})


def _slot_start_on_date(booking_date: date, time_slot: str) -> datetime:
    t = datetime.strptime(time_slot.strip(), "%H:%M").time()
    return datetime.combine(booking_date, t)


def duration_hours_for_route(pickup_location: str, dropoff_location: str, cfg: Settings | None = None) -> float:
    cfg = cfg or app_settings
    est = estimate_road_distance_km(pickup_location, dropoff_location, cfg)
    km = est.distance_km
    return max(MIN_TRIP_DURATION_HOURS, float(km) / DEFAULT_ROAD_SPEED_KMH_FOR_ETA)


def duration_hours_for_booking(booking: Booking, cfg: Settings | None = None) -> float:
    return duration_hours_for_route(booking.pickup_location, booking.dropoff_location, cfg)


def interval_for_pickup_window(
    scheduled_date: date,
    time_slot: str,
    pickup_location: str,
    dropoff_location: str,
    cfg: Settings | None = None,
) -> tuple[datetime, datetime]:
    start = _slot_start_on_date(scheduled_date, time_slot)
    end = start + timedelta(hours=duration_hours_for_route(pickup_location, dropoff_location, cfg))
    return start, end


def booking_interval(
    booking: Booking,
    cfg: Settings | None = None,
) -> tuple[datetime, datetime]:
    return interval_for_pickup_window(
        booking.scheduled_date,
        booking.scheduled_time_slot,
        booking.pickup_location,
        booking.dropoff_location,
        cfg,
    )


def trip_interval(db: Session, trip: Trip, cfg: Settings | None = None) -> tuple[datetime, datetime]:
    booking = trip.booking or db.query(Booking).filter(Booking.id == trip.booking_id).first()
    if booking is None:
        now = datetime.utcnow()
        return now, now + timedelta(hours=MIN_TRIP_DURATION_HOURS)
    start = _slot_start_on_date(booking.scheduled_date, booking.scheduled_time_slot)
    dur = float(trip.duration_hours) if trip.duration_hours and trip.duration_hours > 0 else 0.0
    if dur <= 0:
        dur = duration_hours_for_booking(booking, cfg)
    end = start + timedelta(hours=dur)
    return start, end


def intervals_overlap(a0: datetime, a1: datetime, b0: datetime, b1: datetime) -> bool:
    return a0 < b1 and b0 < a1


def slot_has_capacity(
    db: Session,
    scheduled_date: date,
    time_slot: str,
    cargo_weight_tons: float,
    pickup_location: str,
    dropoff_location: str,
    cfg: Settings | None = None,
    exclude_booking_id: int | None = None,
) -> bool:
    if not pickup_location.strip() or not dropoff_location.strip():
        return False
    cfg = cfg or app_settings
    need = trucks_required_for_cargo(cargo_weight_tons)
    ns, ne = interval_for_pickup_window(
        scheduled_date, time_slot, pickup_location, dropoff_location, cfg
    )

    total = 0
    rows = (
        db.query(Booking)
        .filter(
            Booking.scheduled_date == scheduled_date,
            ~Booking.status.in_(BOOKING_SLOT_TERMINAL_STATUSES),
        )
        .all()
    )
    for b in rows:
        if exclude_booking_id is not None and b.id == exclude_booking_id:
            continue
        s, e = booking_interval(b, cfg)
        if intervals_overlap(ns, ne, s, e):
            total += trucks_required_for_cargo(b.cargo_weight_tons)
    return total + need <= FLEET_TRUCK_COUNT


def slot_available(
    db: Session,
    scheduled_date: date,
    time_slot: str,
    cargo_weight_tons: float,
    pickup_location: str,
    dropoff_location: str,
    cfg: Settings | None = None,
    exclude_booking_id: int | None = None,
) -> bool:
    return slot_has_capacity(
        db,
        scheduled_date,
        time_slot,
        cargo_weight_tons,
        pickup_location,
        dropoff_location,
        cfg,
        exclude_booking_id,
    )


def availability_for_date(
    db: Session,
    scheduled_date: date,
    cargo_weight_tons: float,
    pickup_location: str,
    dropoff_location: str,
    cfg: Settings | None = None,
) -> dict[str, bool]:
    """Map each canonical slot → True when a new booking may start then (fleet trucks + overlap)."""
    return {
        slot: slot_available(
            db,
            scheduled_date,
            slot,
            cargo_weight_tons,
            pickup_location,
            dropoff_location,
            cfg,
        )
        for slot in BOOKING_TIME_SLOTS
    }


def truck_free_for_booking(
    db: Session,
    truck_id: int,
    booking: Booking,
    cfg: Settings | None = None,
    exclude_trip_id: int | None = None,
) -> bool:
    cfg = cfg or app_settings
    ns, ne = booking_interval(booking, cfg)
    trips = db.query(Trip).filter(Trip.truck_id == truck_id, ~Trip.status.in_(_TERMINAL_TRIP)).all()
    for tr in trips:
        if exclude_trip_id is not None and tr.id == exclude_trip_id:
            continue
        s, e = trip_interval(db, tr, cfg)
        if intervals_overlap(ns, ne, s, e):
            return False
    return True


def driver_free_for_booking(
    db: Session,
    driver_id: int,
    booking: Booking,
    cfg: Settings | None = None,
    exclude_trip_id: int | None = None,
) -> bool:
    cfg = cfg or app_settings
    ns, ne = booking_interval(booking, cfg)
    trips = db.query(Trip).filter(Trip.driver_id == driver_id, ~Trip.status.in_(_TERMINAL_TRIP)).all()
    for tr in trips:
        if exclude_trip_id is not None and tr.id == exclude_trip_id:
            continue
        s, e = trip_interval(db, tr, cfg)
        if intervals_overlap(ns, ne, s, e):
            return False
    return True


def helper_free_for_booking(
    db: Session,
    helper_id: int,
    booking: Booking,
    cfg: Settings | None = None,
    exclude_trip_id: int | None = None,
) -> bool:
    cfg = cfg or app_settings
    ns, ne = booking_interval(booking, cfg)
    trips = db.query(Trip).filter(Trip.helper_id == helper_id, ~Trip.status.in_(_TERMINAL_TRIP)).all()
    for tr in trips:
        if exclude_trip_id is not None and tr.id == exclude_trip_id:
            continue
        s, e = trip_interval(db, tr, cfg)
        if intervals_overlap(ns, ne, s, e):
            return False
    return True
