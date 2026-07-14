"""Dispatcher route selection before driver assignment — uses existing RouteOption rows."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.constants.fleet_capacity import MIN_TRIP_DURATION_HOURS
from app.core.config import settings as app_settings
from app.models.entities import Booking, RouteOption
from app.services.booking_pricing import pricing_with_toll_matrix
from app.services.geocoding import geocode_coordinates
from app.services.road_routing import RoadRouteOption, driving_route_alternatives
from app.services.route_estimate import MAP_LOCATION_VERIFY_WARNING, estimate_road_distance_km_with_fallback
from app.services.route_options_quote import travel_hours_for_option
from app.services.routing import optimize_route as legacy_optimize_route
from app.services.toll_matrix import DEFAULT_VEHICLE_CLASS


def _parse_path_payload(path_json: str | None) -> tuple[list[str], dict[str, Any]]:
    raw = (path_json or "").strip()
    if not raw:
        return [], {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return [raw], {}
    if isinstance(parsed, dict):
        path_raw = parsed.get("path")
        path = [str(x).strip() for x in path_raw if str(x).strip()] if isinstance(path_raw, list) else []
        meta = {k: v for k, v in parsed.items() if k != "path"}
        return path, meta
    if isinstance(parsed, list):
        return [str(x).strip() for x in parsed if str(x).strip()], {}
    return [], {}


def _estimate_synthetic_costs(distance_km: float, cargo_weight_tons: float) -> tuple[float, float]:
    """Lightweight estimates when the road graph / toll matrix is unavailable."""
    dist = max(float(distance_km or 0), 1.0)
    weight = max(float(cargo_weight_tons or 0), 0.1)
    fuel = round(dist * 0.32 * 65.0 * (1.0 + min(weight, 42.0) / 84.0), 2)
    toll = round(dist * 1.5, 2)
    return fuel, toll


def _option_is_near_duplicate(a: RoadRouteOption, b: RoadRouteOption) -> bool:
    if abs(a.distance_km - b.distance_km) > 0.35:
        return False
    a_dur = a.duration_seconds or 0.0
    b_dur = b.duration_seconds or 0.0
    if a_dur <= 0 or b_dur <= 0:
        return True
    return abs(a_dur - b_dur) <= 90


def _merge_distinct_road_options(
    primary: list[RoadRouteOption],
    extra: list[RoadRouteOption],
    *,
    max_options: int = 3,
) -> list[RoadRouteOption]:
    """Keep provider primary alternatives; append preference strategies only when metrics differ."""
    kept: list[RoadRouteOption] = []
    for opt in list(primary) + list(extra):
        if any(_option_is_near_duplicate(opt, prev) for prev in kept):
            continue
        kept.append(opt)
        if len(kept) >= max_options:
            break
    return kept


def _assign_objective_tags(
    rows: list[dict[str, Any]],
    *,
    alternatives_available: bool,
) -> list[dict[str, Any]]:
    """
    Tag only from real metrics on the persisted set.
    Single real option → Optimal route (no fake Fastest/Shortest trio).
    """
    if not rows:
        return rows
    if len(rows) == 1 or not alternatives_available:
        for row in rows:
            if row.get("source") == "manual":
                row["objective_tags"] = ["Manual Route"]
            elif row.get("source") == "fallback":
                row["objective_tags"] = ["Fallback estimate"]
            else:
                tags = ["Optimal route"]
                if "avoid_tolls" in str(row.get("provider") or ""):
                    tags.append("Avoid Toll Roads")
                row["objective_tags"] = tags
        return rows

    for row in rows:
        row["objective_tags"] = []

    def push(idx: int, label: str) -> None:
        tags = rows[idx].setdefault("objective_tags", [])
        if label not in tags:
            tags.append(label)

    by_hours = sorted(
        range(len(rows)),
        key=lambda i: float(rows[i].get("duration_hours") or 1e9),
    )
    if rows[by_hours[0]].get("duration_hours") is not None:
        push(by_hours[0], "Fastest Route")

    by_km = sorted(range(len(rows)), key=lambda i: float(rows[i].get("distance_km") or 1e9))
    push(by_km[0], "Shortest Distance")

    avoid_idxs = [
        i
        for i, r in enumerate(rows)
        if "avoid_tolls" in str(r.get("provider") or "")
    ]
    if avoid_idxs:
        for i in avoid_idxs:
            push(i, "Avoid Toll Roads")
    else:
        by_toll = sorted(range(len(rows)), key=lambda i: float(rows[i].get("toll_cost") or 1e9))
        push(by_toll[0], "Lowest Toll Cost")

    by_total = sorted(range(len(rows)), key=lambda i: float(rows[i].get("total_cost") or 1e9))
    push(by_total[0], "Balanced Route")

    for row in rows:
        if not row.get("objective_tags"):
            row["objective_tags"] = ["Generated Route"]
    return rows


def serialize_route_option(row: RouteOption) -> dict[str, Any]:
    path, meta = _parse_path_payload(row.path_json)
    source = str(meta.get("source") or "").strip().lower()
    if not source:
        source = "catalog" if row.rank >= 900 else "optimized"
    objective_tags = meta.get("objective_tags")
    if not isinstance(objective_tags, list):
        objective_tags = []
    return {
        "id": row.id,
        "booking_id": row.booking_id,
        "rank": row.rank,
        "path": path,
        "route_name": meta.get("name"),
        "notes": meta.get("notes"),
        "summary": meta.get("summary"),
        "duration_hours": float(meta["duration_hours"]) if meta.get("duration_hours") is not None else None,
        "distance_km": float(row.distance_km or 0),
        "fuel_cost": float(row.fuel_cost or 0),
        "toll_cost": float(row.toll_cost or 0),
        "time_penalty": float(row.time_penalty or 0),
        "maintenance_penalty": float(row.maintenance_penalty or 0),
        "total_cost": float(row.total_cost or 0),
        "is_selected": bool(row.is_selected),
        "source": source,
        "provider": meta.get("provider"),
        "objective_tags": [str(t) for t in objective_tags if str(t).strip()],
        "routing_note": meta.get("routing_note"),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def map_verification_warning_for_booking(booking: Booking) -> str | None:
    _, verified, warning = estimate_road_distance_km_with_fallback(
        booking.pickup_location,
        booking.dropoff_location,
        app_settings,
    )
    return None if verified else warning


def list_booking_route_options(db: Session, booking_id: int) -> list[dict[str, Any]]:
    rows = (
        db.query(RouteOption)
        .filter(RouteOption.booking_id == booking_id)
        .order_by(RouteOption.is_selected.desc(), RouteOption.rank.asc(), RouteOption.id.asc())
        .all()
    )
    return [serialize_route_option(r) for r in rows]


def route_options_meta_from_serialized(options: list[dict[str, Any]]) -> dict[str, Any]:
    """Derive response-level honesty fields from stored option rows."""
    road = [o for o in options if str(o.get("source") or "") == "road"]
    fallback = [o for o in options if str(o.get("source") or "") == "fallback"]
    alternatives_available = len(road) > 1
    routing_note: str | None = None
    for o in options:
        note = o.get("routing_note")
        if isinstance(note, str) and note.strip():
            routing_note = note.strip()
            break
    if routing_note is None:
        if fallback and not road:
            routing_note = (
                "Provider routing was unavailable for this origin/destination. "
                "Showing a single estimated fallback path — not multiple real alternatives."
            )
        elif len(road) == 1:
            routing_note = (
                "Routing engine returned one optimal path for this OD. "
                "Multiple provider alternatives were not available."
            )
    return {
        "alternatives_available": alternatives_available,
        "routing_note": routing_note,
    }


def get_selected_route_option(db: Session, booking_id: int) -> RouteOption | None:
    return (
        db.query(RouteOption)
        .filter(RouteOption.booking_id == booking_id, RouteOption.is_selected.is_(True))
        .order_by(RouteOption.id.desc())
        .first()
    )


def _synthetic_direct_option(booking: Booking, *, routing_note: str) -> RouteOption:
    km, _, _ = estimate_road_distance_km_with_fallback(
        booking.pickup_location,
        booking.dropoff_location,
        app_settings,
    )
    route_fb = legacy_optimize_route(booking.pickup_location, booking.dropoff_location, weight="distance")
    distance = float(km) if km > 0 else float(route_fb.get("score") or 120)
    if distance <= 0:
        distance = 120.0
    path = route_fb.get("path") or [booking.pickup_location, booking.dropoff_location]
    fuel, toll = _estimate_synthetic_costs(distance, booking.cargo_weight_tons)
    hours = max(distance / 50.0, MIN_TRIP_DURATION_HOURS)
    return RouteOption(
        booking_id=booking.id,
        rank=1,
        path_json=json.dumps(
            {
                "source": "fallback",
                "name": "Fallback estimate",
                "path": path,
                "duration_hours": round(hours, 2),
                "objective_tags": ["Fallback estimate"],
                "routing_note": routing_note,
                "provider": "fallback",
            }
        ),
        distance_km=round(distance, 2),
        fuel_cost=fuel,
        toll_cost=toll,
        time_penalty=0.0,
        maintenance_penalty=0.0,
        total_cost=round(fuel + toll, 2),
        is_selected=True,
    )


def _price_road_option(
    db: Session,
    booking: Booking,
    opt: RoadRouteOption,
) -> tuple[float, float, float, float]:
    """Return distance_km, duration_hours, fuel_cost, toll_cost from real km/hours + toll matrix."""
    hours = travel_hours_for_option(opt)
    pricing, _toll_meta = pricing_with_toll_matrix(
        db,
        pickup_location=booking.pickup_location or "",
        dropoff_location=booking.dropoff_location or "",
        cargo_weight_tons=float(booking.cargo_weight_tons or 5),
        distance_km=float(opt.distance_km),
        settings=app_settings,
        vehicle_class=DEFAULT_VEHICLE_CLASS,
    )
    fuel = round(float(pricing["diesel_cost_php"]), 2)
    toll = round(float(pricing["toll_fees_php"]), 2)
    return round(float(opt.distance_km), 2), round(hours, 2), fuel, toll


def _resolve_road_options_for_dispatch(booking: Booking) -> tuple[list[RoadRouteOption], str, str | None]:
    """
    Same provider alternatives path as customer quotes, plus optional avoid-tolls preference.
    Does not invent padding options.
    """
    pickup = (booking.pickup_location or "").strip()
    dropoff = (booking.dropoff_location or "").strip()
    plat, plon, _pprov = geocode_coordinates(pickup, app_settings)
    dlat, dlon, _dprov = geocode_coordinates(dropoff, app_settings)
    if plat is None or plon is None or dlat is None or dlon is None:
        return [], "unavailable", "Could not geocode pickup/dropoff for provider routing."

    if abs(float(plat) - float(dlat)) < 1e-7 and abs(float(plon) - float(dlon)) < 1e-7:
        return (
            [
                RoadRouteOption(
                    distance_km=0.0,
                    duration_seconds=0.0,
                    provider="same_location",
                    index=0,
                    summary=None,
                )
            ],
            "same_location",
            None,
        )

    primary, provider = driving_route_alternatives(
        float(plat),
        float(plon),
        float(dlat),
        float(dlon),
        app_settings,
        max_options=3,
        want_alternatives=True,
    )
    if not primary or provider == "unavailable":
        return [], "unavailable", None

    avoid_opts, _avoid_provider = driving_route_alternatives(
        float(plat),
        float(plon),
        float(dlat),
        float(dlon),
        app_settings,
        max_options=1,
        want_alternatives=False,
        avoid_tolls=True,
    )
    merged = _merge_distinct_road_options(primary, avoid_opts, max_options=3)
    return merged, provider, None


def generate_route_options_for_booking(db: Session, booking: Booking) -> tuple[list[RouteOption], str | None]:
    """
    Build route candidates for dispatcher review from real road-provider alternatives
    (same engines as customer quotes). Does not invent synthetic triples for the panel.
    """
    db.query(RouteOption).filter(RouteOption.booking_id == booking.id).delete()

    map_warning: str | None = None
    options: list[RouteOption] = []
    road_opts, provider, geo_note = _resolve_road_options_for_dispatch(booking)

    if road_opts and provider != "unavailable":
        alternatives_available = len(road_opts) > 1
        routing_note = (
            None
            if alternatives_available
            else (
                "Routing engine returned one optimal path for this OD. "
                "Multiple provider alternatives were not available."
            )
        )
        priced_meta: list[dict[str, Any]] = []
        for rank, opt in enumerate(road_opts, start=1):
            distance, hours, fuel, toll = _price_road_option(db, booking, opt)
            summary = (opt.summary or "").strip() or None
            if not alternatives_available:
                name = "Optimal route"
            elif rank == 1:
                name = f"Recommended{f' ({summary})' if summary else ''}"
            else:
                name = f"Alternative {rank - 1}{f' ({summary})' if summary else ''}"
            priced_meta.append(
                {
                    "rank": rank,
                    "name": name,
                    "summary": summary,
                    "duration_hours": hours,
                    "distance_km": distance,
                    "fuel_cost": fuel,
                    "toll_cost": toll,
                    "total_cost": round(fuel + toll, 2),
                    "provider": opt.provider,
                    "source": "road",
                    "path": [
                        (booking.pickup_location or "").strip(),
                        (booking.dropoff_location or "").strip(),
                    ],
                }
            )
        priced_meta = _assign_objective_tags(priced_meta, alternatives_available=alternatives_available)
        for meta in priced_meta:
            if routing_note:
                meta["routing_note"] = routing_note
            options.append(
                RouteOption(
                    booking_id=booking.id,
                    rank=int(meta["rank"]),
                    path_json=json.dumps(
                        {
                            "source": "road",
                            "name": meta["name"],
                            "path": meta["path"],
                            "summary": meta.get("summary"),
                            "duration_hours": meta["duration_hours"],
                            "provider": meta.get("provider"),
                            "objective_tags": meta.get("objective_tags") or [],
                            "routing_note": meta.get("routing_note"),
                        }
                    ),
                    distance_km=float(meta["distance_km"]),
                    fuel_cost=float(meta["fuel_cost"]),
                    toll_cost=float(meta["toll_cost"]),
                    time_penalty=0.0,
                    maintenance_penalty=0.0,
                    total_cost=float(meta["total_cost"]),
                    is_selected=int(meta["rank"]) == 1,
                )
            )
    else:
        # Last-resort single fallback only — never pad with A*/catalog fakes.
        note = (
            "Provider routing was unavailable for this origin/destination. "
            "Showing a single estimated fallback path — not multiple real alternatives."
        )
        if geo_note:
            note = f"{geo_note} {note}"
        options.append(_synthetic_direct_option(booking, routing_note=note))
        _, verified, warning = estimate_road_distance_km_with_fallback(
            booking.pickup_location,
            booking.dropoff_location,
            app_settings,
        )
        if not verified:
            map_warning = warning or MAP_LOCATION_VERIFY_WARNING
        elif geo_note:
            map_warning = geo_note

    if options and not any(o.is_selected for o in options):
        options[0].is_selected = True

    for row in options:
        db.add(row)
    db.flush()
    return options, map_warning


def save_manual_route_option(
    db: Session,
    booking: Booking,
    *,
    route_name: str,
    distance_km: float,
    duration_hours: float,
    toll_cost_php: float,
    notes: str | None,
) -> RouteOption:
    db.query(RouteOption).filter(RouteOption.booking_id == booking.id).update(
        {RouteOption.is_selected: False},
        synchronize_session=False,
    )
    dist = round(float(distance_km), 2)
    fuel, toll_est = _estimate_synthetic_costs(dist, booking.cargo_weight_tons)
    toll = round(float(toll_cost_php), 2) if toll_cost_php > 0 else toll_est
    path_payload = {
        "source": "manual",
        "name": route_name.strip(),
        "path": [(booking.pickup_location or "").strip(), (booking.dropoff_location or "").strip()],
        "notes": (notes or "").strip(),
        "duration_hours": round(float(duration_hours), 2),
        "objective_tags": ["Manual Route"],
        "routing_note": "Operator-entered route override (not a provider alternative).",
    }
    option = RouteOption(
        booking_id=booking.id,
        rank=1,
        path_json=json.dumps(path_payload),
        distance_km=dist,
        fuel_cost=fuel,
        toll_cost=toll,
        time_penalty=0.0,
        maintenance_penalty=0.0,
        total_cost=round(fuel + toll, 2),
        is_selected=True,
    )
    db.add(option)
    db.flush()
    return option


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
        path, meta = _parse_path_payload(selected.path_json)
        if not path:
            path = [booking.pickup_location, booking.dropoff_location]
        distance = float(selected.distance_km or 0)
        if distance <= 0:
            distance = 120.0
        duration = float(meta.get("duration_hours") or 0)
        if duration <= 0:
            duration = max(distance / 50.0, MIN_TRIP_DURATION_HOURS)
        source = str(meta.get("source") or "")
        return {
            "path": path,
            "distance_km": distance,
            "fuel_cost": float(selected.fuel_cost or 120.0),
            "toll_cost": float(selected.toll_cost or 45.0),
            "duration_hours": duration,
            "selected_route_option_id": selected.id,
            "map_verified": source not in ("manual", "fallback"),
        }

    km, verified, _ = estimate_road_distance_km_with_fallback(
        booking.pickup_location,
        booking.dropoff_location,
        app_settings,
    )
    route_fb = legacy_optimize_route(booking.pickup_location, booking.dropoff_location, weight="distance")
    distance = float(km) if km > 0 else float(route_fb.get("score") or 120)
    if distance <= 0:
        distance = 120.0
    duration = max(distance / 50.0, MIN_TRIP_DURATION_HOURS)
    return {
        "path": route_fb.get("path", [booking.pickup_location, booking.dropoff_location]),
        "distance_km": distance,
        "fuel_cost": 120.0,
        "toll_cost": 45.0,
        "duration_hours": duration,
        "selected_route_option_id": None,
        "map_verified": verified,
    }
