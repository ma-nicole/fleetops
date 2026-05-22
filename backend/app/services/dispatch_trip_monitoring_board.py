"""Dispatcher trip monitoring board — DB-backed counts, operational status, human-readable locations only."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.models.entities import (
    Booking,
    Trip,
    TripLocationUpdate,
    TripStatus,
    TripStatusUpdate,
)
from app.services.booking_paid_amount import paid_verified_amount_by_booking_ids
from app.services.booking_road_distance import booking_pickup_dropoff_distance_km
from app.services.booking_status_aggregate import aggregate_customer_display_from_trips
from app.services.dispatch_operations_center import _display_status
from app.services.latest_location_display import latest_location_display_for_trip
from app.services.dispatcher_booking_assignment import filter_trips_for_dispatcher

_COORDS = re.compile(r"^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$")


def _iso_utc(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _clean_location_text(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    if not s:
        return None
    if _COORDS.match(s):
        return None
    return s


def _latest_locations_and_touch(
    db: Session, trip_ids: list[int]
) -> tuple[dict[int, str], dict[int, datetime | None]]:
    """Best human-readable location per trip + latest operational touch time (no GPS strings)."""
    if not trip_ids:
        return {}, {}

    best_loc: dict[int, str] = {}
    best_touch: dict[int, datetime | None] = {tid: None for tid in trip_ids}

    loc_rows = (
        db.query(TripLocationUpdate)
        .filter(TripLocationUpdate.trip_id.in_(trip_ids))
        .order_by(TripLocationUpdate.created_at.desc())
        .limit(8000)
        .all()
    )
    for lu in loc_rows:
        tid = lu.trip_id
        if lu.created_at and (best_touch.get(tid) is None or lu.created_at > best_touch[tid]):
            best_touch[tid] = lu.created_at
        if tid not in best_loc:
            txt = _clean_location_text(lu.location_name)
            if txt:
                best_loc[tid] = txt

    st_rows = (
        db.query(TripStatusUpdate)
        .filter(TripStatusUpdate.trip_id.in_(trip_ids))
        .order_by(TripStatusUpdate.created_at.desc())
        .limit(8000)
        .all()
    )
    for su in st_rows:
        tid = su.trip_id
        if su.created_at and (best_touch.get(tid) is None or su.created_at > best_touch[tid]):
            best_touch[tid] = su.created_at
        if tid not in best_loc:
            txt = _clean_location_text(su.location_name)
            if txt:
                best_loc[tid] = txt

    return best_loc, best_touch


def _count_bookings_all_legs_completed(db: Session) -> int:
    """Bookings with at least one non-cancelled trip and every such leg completed."""
    rows = (
        db.query(Trip.booking_id)
        .filter(Trip.status != TripStatus.CANCELLED)
        .group_by(Trip.booking_id)
        .having(
            func.count(Trip.id) > 0,
            func.count(Trip.id) == func.sum(case((Trip.status == TripStatus.COMPLETED, 1), else_=0)),
        )
        .all()
    )
    return len(rows)


def build_trip_monitoring_board_payload(db: Session, *, list_limit: int = 200, viewer=None) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    active_legs = (
        int(
            db.query(func.count(Trip.id))
            .filter(~Trip.status.in_((TripStatus.COMPLETED, TripStatus.CANCELLED)))
            .scalar()
            or 0
        )
    )
    completed_legs_total = (
        int(db.query(func.count(Trip.id)).filter(Trip.status == TripStatus.COMPLETED).scalar() or 0)
    )
    today_utc = datetime.now(timezone.utc).date()
    completed_today = (
        int(
            db.query(func.count(Trip.id))
            .filter(
                Trip.status == TripStatus.COMPLETED,
                Trip.completed_at.isnot(None),
                func.date(Trip.completed_at) == today_utc,
            )
            .scalar()
            or 0
        )
    )

    trips_for_buckets = (
        db.query(Trip).filter(~Trip.status.in_((TripStatus.COMPLETED, TripStatus.CANCELLED))).all()
    )
    if viewer is not None:
        trips_for_buckets = filter_trips_for_dispatcher(db, viewer, trips_for_buckets)
    in_transit = 0
    loading_unloading = 0
    for tr in trips_for_buckets:
        disp = _display_status(tr)
        if disp in ("picked_up", "en_route"):
            in_transit += 1
        elif disp in ("for_pickup", "dropped_off"):
            loading_unloading += 1

    bookings_all_complete = _count_bookings_all_legs_completed(db)

    trips = (
        db.query(Trip)
        .options(
            joinedload(Trip.booking).joinedload(Booking.customer),
            joinedload(Trip.driver),
            joinedload(Trip.helper),
            joinedload(Trip.truck),
        )
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Trip.status != TripStatus.CANCELLED)
        .order_by(Trip.updated_at.desc())
        .limit(max(list_limit, 400))
        .all()
    )
    if viewer is not None:
        trips = filter_trips_for_dispatcher(db, viewer, trips)
    trips_by_booking: defaultdict[int, list[Trip]] = defaultdict(list)
    for tr in trips:
        trips_by_booking[tr.booking_id].append(tr)
    booking_display_status = {
        bid: aggregate_customer_display_from_trips(ts) for bid, ts in trips_by_booking.items()
    }

    trip_ids = [tr.id for tr in trips]
    loc_map, touch_map = _latest_locations_and_touch(db, trip_ids)

    booking_ids = [tr.booking_id for tr in trips]
    paid_map = paid_verified_amount_by_booking_ids(db, booking_ids)
    leg_km_cache: dict[int, float | None] = {}

    active_assignments: list[dict[str, Any]] = []
    for tr in trips:
        bk = tr.booking
        tk = tr.truck
        dr = tr.driver
        hp = tr.helper
        cust = bk.customer if bk else None
        operational = _display_status(tr)

        if bk.id not in leg_km_cache:
            leg_km_cache[bk.id] = booking_pickup_dropoff_distance_km(bk)
        geo_leg_km = leg_km_cache[bk.id]
        display_distance_km = float(geo_leg_km) if geo_leg_km is not None else float(tr.distance_km or 0)

        raw_ping = loc_map.get(tr.id) or _clean_location_text(getattr(tr, "latest_location", None))
        latest = latest_location_display_for_trip(tr, bk.dropoff_location, raw_ping)

        touch = touch_map.get(tr.id)
        last_updated = touch or tr.updated_at

        bk_status_val = bk.status.value if hasattr(bk.status, "value") else str(bk.status)
        active_assignments.append(
            {
                "trip_id": tr.id,
                "trip_status": tr.status.value if hasattr(tr.status, "value") else str(tr.status),
                "operational_status": operational,
                "booking_id": bk.id,
                "customer_id": bk.customer_id,
                "customer_name": cust.full_name if cust else None,
                "customer_company_name": (cust.company_name or None) if cust else None,
                "pickup_location": bk.pickup_location,
                "dropoff_location": bk.dropoff_location,
                "scheduled_date": bk.scheduled_date.isoformat(),
                "scheduled_time_slot": bk.scheduled_time_slot,
                "cargo_weight_tons": bk.cargo_weight_tons,
                "estimated_cost": float(bk.estimated_cost or 0),
                "booking_status": booking_display_status.get(bk.id, bk_status_val),
                "booking_db_status": bk_status_val,
                "paid_amount_verified": paid_map.get(bk.id),
                "truck_id": tk.id if tk else None,
                "truck_code": tk.code if tk else "",
                "driver_id": dr.id if dr else None,
                "driver_name": dr.full_name if dr else None,
                "helper_id": hp.id if hp else None,
                "helper_name": hp.full_name if hp else None,
                "helper_progress_status": tr.helper_progress_status,
                "distance_km": display_distance_km,
                "latest_location": latest,
                "last_updated": _iso_utc(last_updated),
            }
        )

    active_assignments.sort(key=lambda r: r.get("last_updated") or "", reverse=True)
    active_assignments = active_assignments[:list_limit]

    return {
        "generated_at": now.isoformat(),
        "summary": {
            "active_legs": active_legs,
            "in_transit_legs": in_transit,
            "loading_unloading_legs": loading_unloading,
            "completed_trip_legs_today": completed_today,
            "completed_trip_legs_total": completed_legs_total,
            "bookings_all_legs_completed": bookings_all_complete,
        },
        "active_assignments": active_assignments,
    }
