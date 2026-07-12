"""Shared booking pricing with Toll Matrix lookup (Class 3)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.services.booking_freight_knobs import resolve_booking_freight_knobs
from app.services.fuel_price_service import ensure_fuel_price_for_quote, fuel_price_meta_dict
from app.services.route_estimate import customer_freight_pricing, split_cargo_into_truck_loads
from app.services.toll_matrix import DEFAULT_VEHICLE_CLASS, resolve_booking_toll_estimate


def pricing_with_toll_matrix(
    db: Session,
    *,
    pickup_location: str,
    dropoff_location: str,
    cargo_weight_tons: float,
    distance_km: float,
    settings: Settings,
    vehicle_class: str = DEFAULT_VEHICLE_CLASS,
    as_of_date=None,
    manual_entry: str | None = None,
    manual_exit: str | None = None,
    route_origin: str | None = None,
    route_destination: str | None = None,
    route_waypoints: list[str] | None = None,
) -> tuple[dict, dict]:
    fuel_snap = ensure_fuel_price_for_quote(db, settings)
    knobs = resolve_booking_freight_knobs(db, settings)
    loads = split_cargo_into_truck_loads(cargo_weight_tons)
    truck_count = max(1, len(loads))
    # Always Class 3 for fleet quotes; never fall back to flat toll knobs silently.
    per_truck, meta = resolve_booking_toll_estimate(
        db,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        vehicle_class=DEFAULT_VEHICLE_CLASS,
        truck_count=truck_count,
        as_of_date=as_of_date,
        manual_entry=manual_entry,
        manual_exit=manual_exit,
        route_origin=route_origin,
        route_destination=route_destination,
        route_waypoints=route_waypoints,
        settings=settings,
    )
    _ = vehicle_class
    toll_amount = float(per_truck if per_truck is not None else 0.0)
    pricing = customer_freight_pricing(
        distance_km,
        cargo_weight_tons,
        knobs,
        toll_budget_per_truck=toll_amount,
        toll_estimate_meta=meta,
    )
    pricing["fuel_price_meta"] = fuel_price_meta_dict(fuel_snap)
    pricing["maintenance_cost_php"] = 0.0
    pricing["service_fee_php"] = 0.0
    return pricing, meta
