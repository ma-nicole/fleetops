"""Pickup-window capacity: four trucks × 42 t, with overlap by planned trip duration on the route."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.constants.booking_time_slots import (
    BOOKING_SLOT_TERMINAL_STATUSES,
    BOOKING_TIME_SLOTS,
    normalize_time_slot,
)
from app.constants.fleet_capacity import (
    DEFAULT_ROAD_SPEED_KMH_FOR_ETA,
    FLEET_TRUCK_COUNT,
    MIN_TRIP_DURATION_HOURS,
    trucks_required_for_cargo,
)
from app.core.config import Settings, settings as app_settings
from app.models.entities import Booking, Trip, TripStatus
from app.services.route_estimate import (
    PreciseDistanceUnavailable,
    estimate_road_distance_km_with_fallback,
)
from app.services.booking_capacity import fleet_operational_pool_size
from app.services.demo_booking_filter import is_demo_placeholder_booking

_TERMINAL_TRIP: frozenset[TripStatus] = frozenset({TripStatus.COMPLETED, TripStatus.CANCELLED})


def _slot_start_on_date(booking_date: date, time_slot: str) -> datetime:
    t = datetime.strptime(time_slot.strip(), "%H:%M").time()
    return datetime.combine(booking_date, t)


def duration_hours_for_route(pickup_location: str, dropoff_location: str, cfg: Settings | None = None) -> float:
    cfg = cfg or app_settings
    km, _, _ = estimate_road_distance_km_with_fallback(pickup_location, dropoff_location, cfg)
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


def booking_interval_resolved(
    db: Session,
    booking: Booking,
    cfg: Settings | None = None,
) -> tuple[datetime, datetime]:
    """Uses dispatcher-selected route duration when a route option is saved."""
    from app.services.dispatch_route_selection import _parse_path_payload, get_selected_route_option

    cfg = cfg or app_settings
    if booking.scheduled_date is None or not (booking.scheduled_time_slot or "").strip():
        now = datetime.utcnow()
        return now, now + timedelta(hours=MIN_TRIP_DURATION_HOURS)
    start = _slot_start_on_date(booking.scheduled_date, booking.scheduled_time_slot)
    selected = get_selected_route_option(db, booking.id)
    dur: float | None = None
    if selected is not None:
        _, meta = _parse_path_payload(selected.path_json)
        raw_dur = meta.get("duration_hours")
        if raw_dur is not None:
            dur = float(raw_dur)
        if dur is None or dur <= 0:
            dist = float(selected.distance_km or 0)
            if dist > 0:
                dur = max(MIN_TRIP_DURATION_HOURS, dist / DEFAULT_ROAD_SPEED_KMH_FOR_ETA)
    if dur is None or dur <= 0:
        dur = duration_hours_for_booking(booking, cfg)
    return start, start + timedelta(hours=dur)


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


def booking_interval_best_effort(
    booking: Booking,
    cfg: Settings | None = None,
) -> tuple[datetime, datetime]:
    """Like ``booking_interval`` but falls back to slot start + MIN_TRIP_DURATION when route km is unavailable."""
    try:
        return booking_interval(booking, cfg)
    except PreciseDistanceUnavailable:
        if booking.scheduled_date is None or not (booking.scheduled_time_slot or "").strip():
            now = datetime.utcnow()
            return now, now + timedelta(hours=MIN_TRIP_DURATION_HOURS)
        start = _slot_start_on_date(booking.scheduled_date, booking.scheduled_time_slot)
        return start, start + timedelta(hours=MIN_TRIP_DURATION_HOURS)


def booking_pickup_window_end_approx(booking: Booking) -> datetime | None:
    """Fast pickup-window end for dashboards — no geocoding or external routing."""
    if booking.scheduled_date is None or not (booking.scheduled_time_slot or "").strip():
        return None
    if normalize_time_slot(booking.scheduled_time_slot) not in BOOKING_TIME_SLOTS:
        return None
    start = _slot_start_on_date(booking.scheduled_date, booking.scheduled_time_slot)
    return start + timedelta(hours=MIN_TRIP_DURATION_HOURS)


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


def trucks_committed_for_window(
    db: Session,
    scheduled_date: date,
    time_slot: str,
    pickup_location: str,
    dropoff_location: str,
    cfg: Settings | None = None,
    exclude_booking_id: int | None = None,
) -> int:
    """Sum required trucks for non-terminal bookings whose planned interval overlaps this window."""
    if not pickup_location.strip() or not dropoff_location.strip():
        return 0
    cfg = cfg or app_settings
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
        if is_demo_placeholder_booking(b.pickup_location, b.dropoff_location):
            continue
        s, e = booking_interval(b, cfg)
        if intervals_overlap(ns, ne, s, e):
            total += trucks_required_for_cargo(b.cargo_weight_tons)
    return total


def available_trucks_for_window(
    db: Session,
    scheduled_date: date,
    time_slot: str,
    pickup_location: str,
    dropoff_location: str,
    cfg: Settings | None = None,
    exclude_booking_id: int | None = None,
) -> int:
    pool = fleet_operational_pool_size(db)
    if pool <= 0:
        return 0
    committed = trucks_committed_for_window(
        db,
        scheduled_date,
        time_slot,
        pickup_location,
        dropoff_location,
        cfg,
        exclude_booking_id,
    )
    return max(0, pool - committed)


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
        if is_demo_placeholder_booking(b.pickup_location, b.dropoff_location):
            continue
        s, e = booking_interval(b, cfg)
        if intervals_overlap(ns, ne, s, e):
            total += trucks_required_for_cargo(b.cargo_weight_tons)
    pool = fleet_operational_pool_size(db)
    if pool <= 0:
        return False
    return total + need <= pool


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
    need = trucks_required_for_cargo(cargo_weight_tons)
    return {
        slot: available_trucks_for_window(
            db, scheduled_date, slot, pickup_location, dropoff_location, cfg
        )
        >= need
        for slot in BOOKING_TIME_SLOTS
    }


def available_trucks_by_slot_for_date(
    db: Session,
    scheduled_date: date,
    pickup_location: str,
    dropoff_location: str,
    cfg: Settings | None = None,
) -> dict[str, int]:
    return {
        slot: available_trucks_for_window(
            db, scheduled_date, slot, pickup_location, dropoff_location, cfg
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
    ns, ne = booking_interval_resolved(db, booking, cfg)
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
    ns, ne = booking_interval_resolved(db, booking, cfg)
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
    ns, ne = booking_interval_resolved(db, booking, cfg)
    trips = db.query(Trip).filter(Trip.helper_id == helper_id, ~Trip.status.in_(_TERMINAL_TRIP)).all()
    for tr in trips:
        if exclude_trip_id is not None and tr.id == exclude_trip_id:
            continue
        s, e = trip_interval(db, tr, cfg)
        if intervals_overlap(ns, ne, s, e):
            return False
    return True
