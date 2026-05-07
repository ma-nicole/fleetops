"""Distance + freight pricing aligned with FleetOpt booking estimator."""

from __future__ import annotations

import math
from typing import Protocol

from app.core.config import Settings
from app.services.geocoding import geocode_coordinates


class FreightPricingKnobsLike(Protocol):
    """Settings or ``BookingFreightSettings`` row — same numeric fields for estimate math."""

    cargo_weight_multiplier_per_ton: float
    truck_fuel_efficiency_kmpl: float
    diesel_price_php_per_liter: float
    trip_wear_misc_php_per_km: float
    trip_depreciation_rate: float
    helper_pay_php_per_trip: float
    driver_freight_commission_rate: float

METRO_CENTER = (14.5995, 120.9842)
ROAD_FACTOR = 1.28


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    d_lat = lat2 - lat1
    d_lon = lon2 - lon1
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def _heuristic_km(pickup: str, dropoff: str) -> float:
    pa = pickup.strip().lower()
    da = dropoff.strip().lower()
    a = ord(pa[0]) if pa else 0
    b = ord(da[0]) if da else 0
    raw = abs(a - b) * 2.2 + 18
    return min(140, max(8, round(raw * 10) / 10))


def estimate_road_distance_km(
    pickup: str,
    dropoff: str,
    settings: Settings,
) -> tuple[float, str, str, str]:
    """
    Returns (distance_km, pickup_provider, dropoff_provider, tier).
    tier: geocoded | partial_metro | heuristic
    """
    p_pick = pickup.strip().lower()
    p_drop = dropoff.strip().lower()
    plat, plon, pprov = geocode_coordinates(pickup, settings)
    dlat, dlon, dprov = geocode_coordinates(dropoff, settings)

    cp = (plat, plon) if plat is not None and plon is not None else None
    cd = (dlat, dlon) if dlat is not None and dlon is not None else None

    tier = "heuristic"

    if cp and cd:
        tier = "geocoded"
        crow = haversine_km(cp, cd)
        if crow < 0.001 and p_pick != p_drop:
            return _heuristic_km(pickup, dropoff), pprov, dprov, "heuristic_near_dupe"
        km = round(crow * ROAD_FACTOR, 1)
        return km, pprov, dprov, tier

    if cp and not cd:
        tier = "partial_metro"
        crow = haversine_km(cp, METRO_CENTER)
        return round(crow * ROAD_FACTOR, 1), pprov, dprov, tier

    if not cp and cd:
        tier = "partial_metro"
        crow = haversine_km(METRO_CENTER, cd)
        return round(crow * ROAD_FACTOR, 1), pprov, dprov, tier

    return _heuristic_km(pickup, dropoff), pprov, dprov, "heuristic"


def _weight_factor(weight_tons: float, coef: float) -> float:
    w = weight_tons if math.isfinite(weight_tons) and weight_tons > 0 else 1.0
    w = min(50.0, max(0.1, w))
    return 1.0 + max(0.0, w - 1.0) * coef


def customer_freight_pricing(km: float, weight_tons: float, knobs: FreightPricingKnobsLike) -> dict[str, float]:
    """
    Freight base = diesel (₱/L × liters) + per-km wear × load factor
    plus depreciation on that diesel+wear core, helper allowance per trip.

    Gross freight (freight base) is invoiced separately from driver's 15%.
    Driver / commission = FREIGHT_COMMISSION_RATE × freight base — added to invoice total.

    Mirrors frontend `bookingRouteEstimate.ts` fallback when env knobs match `Settings` defaults
    until an admin persists overrides in ``booking_freight_settings``.
    """
    wf = _weight_factor(weight_tons, float(knobs.cargo_weight_multiplier_per_ton))
    km_eff = float(km)
    kmpl = max(1.5, float(knobs.truck_fuel_efficiency_kmpl))
    liters = max(0.0, (km_eff * wf) / kmpl)

    diesel_per_l = float(knobs.diesel_price_php_per_liter)
    diesel_cost = liters * diesel_per_l

    wear_ph = float(knobs.trip_wear_misc_php_per_km)
    wear_misc = km_eff * wear_ph * wf

    core_diesel_wear = diesel_cost + wear_misc
    dep_rate = float(knobs.trip_depreciation_rate)
    depreciation_charge = core_diesel_wear * dep_rate

    ops_stack = core_diesel_wear + depreciation_charge

    helper_pay = float(knobs.helper_pay_php_per_trip)
    freight_base = ops_stack + helper_pay

    d_rate = float(knobs.driver_freight_commission_rate)
    driver_fee = round(freight_base * d_rate, 2)
    total_customer = round(freight_base + driver_fee, 2)

    w_norm = weight_tons if math.isfinite(weight_tons) and weight_tons > 0 else 1.0
    w_norm = min(50.0, max(0.1, w_norm))

    return {
        "distance_km": round(km_eff, 1),
        "diesel_liters": round(liters, 2),
        "diesel_cost_php": round(diesel_cost, 2),
        "wear_misc_php": round(wear_misc, 2),
        "depreciation_php": round(depreciation_charge, 2),
        "helper_pay_php": round(helper_pay, 2),
        "freight_base_php": round(freight_base, 2),
        "fuel_route_charge": round(freight_base, 2),
        "driver_fee": driver_fee,
        "estimated_total": total_customer,
        "diesel_price_per_liter": round(diesel_per_l, 2),
        "weight_tons": w_norm,
        "driver_commission_pct": round(d_rate * 100, 2),
    }
