"""Distance + freight pricing — uses road-network km (Google Directions, OSRM, or OpenRouteService)."""

from __future__ import annotations

import math
from typing import NamedTuple, Protocol

from app.core.config import Settings
from app.services.geocoding import geocode_coordinates
from app.services.road_routing import driving_route_distance_km, effective_google_directions_key


class PreciseDistanceUnavailable(Exception):
    """Strict mode: pricing requires geocoded pins + a successful road route (Google / ORS / OSRM)."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class FreightPricingKnobsLike(Protocol):
    """Settings or ``BookingFreightSettings`` row — same numeric fields for pricing math."""

    cargo_weight_multiplier_per_ton: float
    truck_fuel_efficiency_kmpl: float
    diesel_price_php_per_liter: float
    trip_wear_misc_php_per_km: float
    trip_depreciation_rate: float
    helper_pay_php_per_trip: float
    driver_freight_commission_rate: float


class RoadDistanceEstimate(NamedTuple):
    distance_km: float
    pickup_provider: str
    dropoff_provider: str
    tier: str
    """geocoded | partial_metro | heuristic | heuristic_near_dupe (legacy only)"""
    routing_method: str
    """google_directions | openrouteservice_hgv | openrouteservice_car | osrm | same_location — legacy: ..."""
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    dropoff_lat: float | None = None
    dropoff_lng: float | None = None


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
) -> RoadDistanceEstimate:
    """
    Default (require_routed_distance=True): only returns km from a real road route:
    Google Directions (if configured), else OpenRouteService, else OSRM.
    No straight-line “×1.28” fallback — that path raises PreciseDistanceUnavailable.

    Set REQUIRE_ROUTED_DISTANCE=false only for offline/dev approximate behavior.
    """
    strict = bool(getattr(settings, "require_routed_distance", True))
    p_pick = pickup.strip().lower()
    p_drop = dropoff.strip().lower()
    plat, plon, pprov = geocode_coordinates(pickup, settings)
    dlat, dlon, dprov = geocode_coordinates(dropoff, settings)

    cp = (plat, plon) if plat is not None and plon is not None else None
    cd = (dlat, dlon) if dlat is not None and dlon is not None else None

    if strict:
        if not cp or not cd:
            raise PreciseDistanceUnavailable(
                "Could not place pickup and dropoff on the map. Use full Philippine addresses "
                "(house/street, barangay, city or municipality, province). "
                "Vague labels like a province name alone are not enough for road distance."
            )
        crow = haversine_km(cp, cd)
        if crow < 0.001:
            if p_pick == p_drop:
                return RoadDistanceEstimate(
                    0.0,
                    pprov,
                    dprov,
                    "geocoded",
                    "same_location",
                    cp[0],
                    cp[1],
                    cd[0],
                    cd[1],
                )
            raise PreciseDistanceUnavailable(
                "Pickup and dropoff resolved to the same coordinates but the address text differs. "
                "Refine one or both addresses (add street, barangay, or landmark) so each stop maps cleanly."
            )
        g_ok = bool(getattr(settings, "use_google_directions_for_routing", True)) and bool(
            effective_google_directions_key(settings)
        )
        ors_ok = bool((getattr(settings, "openrouteservice_api_key", None) or "").strip())
        osrm_ok = bool(getattr(settings, "use_osrm_driving_distance", True))
        if not (g_ok or ors_ok or osrm_ok):
            raise PreciseDistanceUnavailable(
                "Road routing is disabled: enable Google Directions (GOOGLE_MAPS_SERVER_API_KEY or server-usable key + "
                "Directions API), or OPENROUTESERVICE_API_KEY, or OSRM (USE_OSRM_DRIVING_DISTANCE=true)."
            )
        drive_km, r_src = driving_route_distance_km(cp[0], cp[1], cd[0], cd[1], settings)
        _valid_routing = (
            "google_directions",
            "openrouteservice_hgv",
            "openrouteservice_car",
            "openrouteservice",
            "osrm",
        )
        if drive_km is None or r_src not in _valid_routing:
            raise PreciseDistanceUnavailable(
                "The routing engine could not compute a driving path between the two resolved points "
                "(service down, no road connection in the map data, or timeout). "
                "Verify both addresses, try again, or set GOOGLE_MAPS_SERVER_API_KEY with Geocoding + Directions enabled "
                "(not HTTP-referrer-only), OPENROUTESERVICE_API_KEY, or OSRM_ROUTE_BASE_URL."
            )
        return RoadDistanceEstimate(
            float(drive_km),
            pprov,
            dprov,
            "geocoded",
            r_src,
            cp[0],
            cp[1],
            cd[0],
            cd[1],
        )

    # ---- Legacy approximate mode (REQUIRE_ROUTED_DISTANCE=false) ----
    if cp and cd:
        crow = haversine_km(cp, cd)
        if crow < 0.001 and p_pick != p_drop:
            km = _heuristic_km(pickup, dropoff)
            return RoadDistanceEstimate(
                km,
                pprov,
                dprov,
                "heuristic_near_dupe",
                "heuristic",
                plat,
                plon,
                dlat,
                dlon,
            )
        drive_km, r_src = driving_route_distance_km(cp[0], cp[1], cd[0], cd[1], settings)
        if drive_km is not None and r_src in (
            "google_directions",
            "openrouteservice_hgv",
            "openrouteservice_car",
            "openrouteservice",
            "osrm",
        ):
            return RoadDistanceEstimate(
                drive_km,
                pprov,
                dprov,
                "geocoded",
                r_src,
                cp[0],
                cp[1],
                cd[0],
                cd[1],
            )
        km = round(crow * ROAD_FACTOR, 2)
        return RoadDistanceEstimate(
            km,
            pprov,
            dprov,
            "geocoded",
            "haversine_road_factor",
            cp[0],
            cp[1],
            cd[0],
            cd[1],
        )
    if cp and not cd:
        crow = haversine_km(cp, METRO_CENTER)
        km = round(crow * ROAD_FACTOR, 1)
        return RoadDistanceEstimate(
            km,
            pprov,
            dprov,
            "partial_metro",
            "partial_metro_haversine",
            cp[0],
            cp[1],
            None,
            None,
        )
    if not cp and cd:
        crow = haversine_km(METRO_CENTER, cd)
        km = round(crow * ROAD_FACTOR, 1)
        return RoadDistanceEstimate(
            km,
            pprov,
            dprov,
            "partial_metro",
            "partial_metro_haversine",
            None,
            None,
            cd[0],
            cd[1],
        )
    km = _heuristic_km(pickup, dropoff)
    return RoadDistanceEstimate(km, pprov, dprov, "heuristic", "heuristic")


def _weight_factor(weight_tons: float, coef: float) -> float:
    w = weight_tons if math.isfinite(weight_tons) and weight_tons > 0 else 1.0
    w = min(168.0, max(0.1, w))
    return 1.0 + max(0.0, w - 1.0) * coef


def customer_freight_pricing(km: float, weight_tons: float, knobs: FreightPricingKnobsLike) -> dict[str, float]:
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
    w_norm = min(168.0, max(0.1, w_norm))

    return {
        "distance_km": round(km_eff, 2),
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
