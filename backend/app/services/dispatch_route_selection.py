"""Dispatcher route selection before driver assignment — uses existing RouteOption rows."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import Booking, Route, RouteOption
from app.schemas.predict import RouteOptimizeRequest
from app.services.booking_road_distance import booking_pickup_dropoff_distance_km
from app.services.prescriptive.routing_astar import optimize_route
from app.services.routing import optimize_route as legacy_optimize_route


def _departure_hour_from_slot(time_slot: str | None) -> int:
    raw = (time_slot or "08:00").strip()
    try:
        return int(raw.split(":")[0])
    except (ValueError, IndexError):
        return 8


def _estimate_synthetic_costs(distance_km: float, cargo_weight_tons: float) -> tuple[float, float]:
    """Lightweight estimates when the road graph has no matching nodes."""
    dist = max(float(distance_km or 0), 1.0)
    weight = max(float(cargo_weight_tons or 0), 0.1)
    fuel = round(dist * 0.32 * 65.0 * (1.0 + min(weight, 42.0) / 84.0), 2)
    toll = round(dist * 1.5, 2)
    return fuel, toll


def serialize_route_option(row: RouteOption) -> dict[str, Any]:
    try:
        path = json.loads(row.path_json or "[]")
    except json.JSONDecodeError:
        path = []
    if not isinstance(path, list):
        path = []
    return {
        "id": row.id,
        "booking_id": row.booking_id,
        "rank": row.rank,
        "path": path,
        "distance_km": float(row.distance_km or 0),
        "fuel_cost": float(row.fuel_cost or 0),
        "toll_cost": float(row.toll_cost or 0),
        "time_penalty": float(row.time_penalty or 0),
        "maintenance_penalty": float(row.maintenance_penalty or 0),
        "total_cost": float(row.total_cost or 0),
        "is_selected": bool(row.is_selected),
        "source": "catalog" if row.rank >= 900 else "optimized",
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def list_booking_route_options(db: Session, booking_id: int) -> list[dict[str, Any]]:
    rows = (
        db.query(RouteOption)
        .filter(RouteOption.booking_id == booking_id)
        .order_by(RouteOption.is_selected.desc(), RouteOption.rank.asc(), RouteOption.id.asc())
        .all()
    )
    return [serialize_route_option(r) for r in rows]


def get_selected_route_option(db: Session, booking_id: int) -> RouteOption | None:
    return (
        db.query(RouteOption)
        .filter(RouteOption.booking_id == booking_id, RouteOption.is_selected.is_(True))
        .order_by(RouteOption.id.desc())
        .first()
    )


def _catalog_matches(db: Session, booking: Booking) -> list[RouteOption]:
    pickup = (booking.pickup_location or "").strip().lower()
    dropoff = (booking.dropoff_location or "").strip().lower()
    if not pickup or not dropoff:
        return []
    rows = db.query(Route).filter(Route.is_active.is_(True)).all()
    created: list[RouteOption] = []
    rank = 900
    for route in rows:
        o = (route.origin or "").strip().lower()
        d = (route.destination or "").strip().lower()
        if not o or not d:
            continue
        if (o in pickup or pickup in o) and (d in dropoff or dropoff in d):
            fuel, toll = _estimate_synthetic_costs(float(route.distance_km or 0), booking.cargo_weight_tons)
            total = round(fuel + toll + float(route.base_toll or 0), 2)
            created.append(
                RouteOption(
                    booking_id=booking.id,
                    rank=rank,
                    path_json=json.dumps([route.origin, route.destination]),
                    distance_km=float(route.distance_km or 0),
                    fuel_cost=fuel,
                    toll_cost=round(float(route.base_toll or 0) + toll, 2),
                    time_penalty=0.0,
                    maintenance_penalty=0.0,
                    total_cost=total,
                    is_selected=False,
                )
            )
            rank += 1
    return created


def _synthetic_direct_option(booking: Booking) -> RouteOption:
    geo_km = booking_pickup_dropoff_distance_km(booking)
    route_fb = legacy_optimize_route(booking.pickup_location, booking.dropoff_location, weight="distance")
    distance = float(geo_km) if geo_km is not None else float(route_fb.get("score") or 120)
    if distance <= 0:
        distance = 120.0
    path = route_fb.get("path") or [booking.pickup_location, booking.dropoff_location]
    fuel, toll = _estimate_synthetic_costs(distance, booking.cargo_weight_tons)
    return RouteOption(
        booking_id=booking.id,
        rank=1,
        path_json=json.dumps(path),
        distance_km=round(distance, 2),
        fuel_cost=fuel,
        toll_cost=toll,
        time_penalty=0.0,
        maintenance_penalty=0.0,
        total_cost=round(fuel + toll, 2),
        is_selected=True,
    )


def generate_route_options_for_booking(db: Session, booking: Booking) -> list[RouteOption]:
    """Build route candidates for dispatcher review. Does not affect assignment until selected."""
    db.query(RouteOption).filter(RouteOption.booking_id == booking.id).delete()

    req = RouteOptimizeRequest(
        origin=(booking.pickup_location or "").strip(),
        destination=(booking.dropoff_location or "").strip(),
        weight="cost",
        cargo_weight_tons=float(booking.cargo_weight_tons or 5),
        departure_hour=_departure_hour_from_slot(booking.scheduled_time_slot),
    )
    response = optimize_route(req, db)

    options: list[RouteOption] = []
    if response.candidates:
        for cand in response.candidates:
            options.append(
                RouteOption(
                    booking_id=booking.id,
                    rank=cand.rank,
                    path_json=json.dumps(cand.path),
                    distance_km=cand.distance_km,
                    fuel_cost=cand.fuel_cost,
                    toll_cost=cand.toll_cost,
                    time_penalty=cand.time_penalty,
                    maintenance_penalty=cand.maintenance_penalty,
                    total_cost=cand.total_cost,
                    is_selected=cand.rank == response.selected_rank,
                )
            )
    else:
        options.append(_synthetic_direct_option(booking))

    options.extend(_catalog_matches(db, booking))
    if options and not any(o.is_selected for o in options):
        options[0].is_selected = True

    for row in options:
        db.add(row)
    db.flush()
    return options


def select_route_option(db: Session, booking_id: int, option_id: int) -> RouteOption:
    option = (
        db.query(RouteOption)
        .filter(RouteOption.id == option_id, RouteOption.booking_id == booking_id)
        .first()
    )
    if not option:
        raise ValueError("Route option not found for this booking.")
    db.query(RouteOption).filter(RouteOption.booking_id == booking_id).update(
        {RouteOption.is_selected: False},
        synchronize_session=False,
    )
    option.is_selected = True
    return option


def resolve_dispatch_route(db: Session, booking: Booking) -> dict[str, Any]:
    """Use dispatcher-selected route when present; otherwise preserve legacy assignment routing."""
    selected = get_selected_route_option(db, booking.id)
    if selected:
        try:
            path = json.loads(selected.path_json or "[]")
        except json.JSONDecodeError:
            path = []
        if not isinstance(path, list) or not path:
            path = [booking.pickup_location, booking.dropoff_location]
        distance = float(selected.distance_km or 0)
        if distance <= 0:
            distance = 120.0
        return {
            "path": path,
            "distance_km": distance,
            "fuel_cost": float(selected.fuel_cost or 120.0),
            "toll_cost": float(selected.toll_cost or 45.0),
            "duration_hours": max(distance / 50.0, 1.0),
            "selected_route_option_id": selected.id,
        }

    geo_km = booking_pickup_dropoff_distance_km(booking)
    route_fb = legacy_optimize_route(booking.pickup_location, booking.dropoff_location, weight="distance")
    distance = float(geo_km) if geo_km is not None else float(route_fb.get("score") or 120)
    if distance <= 0:
        distance = 120.0
    duration = max(distance / 50.0, 1.0)
    return {
        "path": route_fb.get("path", [booking.pickup_location, booking.dropoff_location]),
        "distance_km": distance,
        "fuel_cost": 120.0,
        "toll_cost": 45.0,
        "duration_hours": duration,
        "selected_route_option_id": None,
    }
