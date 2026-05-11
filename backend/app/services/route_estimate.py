"""Distance + freight pricing — uses road-network km (Google Directions, OSRM, or OpenRouteService)."""

from __future__ import annotations

import math
from typing import NamedTuple, Protocol

from app.constants.customer_pricing import (
    CARGO_RATE_PHP_PER_TON,
    DRIVER_FREIGHT_SHARE_RATE,
    HELPER_FREIGHT_SHARE_RATE,
    TRUCK_FUEL_KMPL,
)
from app.constants.fleet_capacity import TRUCK_MAX_CAPACITY_TONS
from app.core.config import Settings
from app.services.geocoding import geocode_coordinates
from app.services.road_routing import driving_route_distance_km, effective_google_directions_key


class PreciseDistanceUnavailable(Exception):
    """Strict mode: pricing requires geocoded pins + a successful road route (Google / ORS / OSRM)."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class FreightPricingKnobsLike(Protocol):
    """``BookingFreightSettings`` row — admin only stores diesel ₱/L and toll; rest are app constants."""

    diesel_price_php_per_liter: float
    toll_fees_php_per_trip: float


class RoadDistanceEstimate(NamedTuple):
    distance_km: float
    pickup_provider: str
    dropoff_provider: str
    tier: str
    """geocoded | partial_metro | heuristic | heuristic_near_dupe (legacy only)"""
    routing_method: str
    """google_directions | openrouteservice_hgv | openrouteservice_car | osrm | same_location — legacy: ..."""


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
                return RoadDistanceEstimate(0.0, pprov, dprov, "geocoded", "same_location")
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
                "Road routing is disabled: enable Google Directions (GOOGLE_MAPS_GEOCODING_API_KEY + Directions API, "
                "or GOOGLE_MAPS_DIRECTIONS_API_KEY), or OPENROUTESERVICE_API_KEY, or OSRM (USE_OSRM_DRIVING_DISTANCE=true)."
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
                "Verify both addresses, try again, or set GOOGLE_MAPS_GEOCODING_API_KEY with Geocoding + Directions "
                "enabled (server-usable restrictions), OPENROUTESERVICE_API_KEY, or OSRM_ROUTE_BASE_URL."
            )
        return RoadDistanceEstimate(float(drive_km), pprov, dprov, "geocoded", r_src)

    # ---- Legacy approximate mode (REQUIRE_ROUTED_DISTANCE=false) ----
    if cp and cd:
        crow = haversine_km(cp, cd)
        if crow < 0.001 and p_pick != p_drop:
            km = _heuristic_km(pickup, dropoff)
            return RoadDistanceEstimate(km, pprov, dprov, "heuristic_near_dupe", "heuristic")
        drive_km, r_src = driving_route_distance_km(cp[0], cp[1], cd[0], cd[1], settings)
        if drive_km is not None and r_src in (
            "google_directions",
            "openrouteservice_hgv",
            "openrouteservice_car",
            "openrouteservice",
            "osrm",
        ):
            return RoadDistanceEstimate(drive_km, pprov, dprov, "geocoded", r_src)
        km = round(crow * ROAD_FACTOR, 2)
        return RoadDistanceEstimate(km, pprov, dprov, "geocoded", "haversine_road_factor")
    if cp and not cd:
        crow = haversine_km(cp, METRO_CENTER)
        km = round(crow * ROAD_FACTOR, 1)
        return RoadDistanceEstimate(km, pprov, dprov, "partial_metro", "partial_metro_haversine")
    if not cp and cd:
        crow = haversine_km(METRO_CENTER, cd)
        km = round(crow * ROAD_FACTOR, 1)
        return RoadDistanceEstimate(km, pprov, dprov, "partial_metro", "partial_metro_haversine")
    km = _heuristic_km(pickup, dropoff)
    return RoadDistanceEstimate(km, pprov, dprov, "heuristic", "heuristic")


def split_cargo_into_truck_loads(
    total_tons: float,
    max_tons_per_truck: float = TRUCK_MAX_CAPACITY_TONS,
) -> list[float]:
    """Split booking weight into full 42 t (or configured cap) loads plus remainder. No load exceeds the cap."""
    if not math.isfinite(total_tons) or total_tons <= 0:
        return []
    cap = float(max_tons_per_truck)
    if cap <= 0:
        return []
    remaining = round(float(total_tons), 6)
    loads: list[float] = []
    while remaining > 1e-9:
        chunk = min(cap, remaining)
        loads.append(round(chunk, 4))
        remaining = round(remaining - chunk, 6)
    return loads


def _profit_line_one_truck(
    km_eff: float,
    tons: float,
    knobs: FreightPricingKnobsLike,
    truck_index: int,
) -> dict[str, float | int]:
    """One truck on this route: net profit = cargo gross + fuel + driver + helper + toll (all additive)."""
    w = float(tons)
    if not math.isfinite(w) or w <= 0:
        w = 0.0
    w = min(float(TRUCK_MAX_CAPACITY_TONS), max(0.0, w))

    cargo_rate = float(CARGO_RATE_PHP_PER_TON)
    gross = w * cargo_rate

    kmpl = max(0.5, float(TRUCK_FUEL_KMPL))
    liters = max(0.0, float(km_eff) / kmpl)
    diesel_per_l = float(knobs.diesel_price_php_per_liter)
    fuel_cost = liters * diesel_per_l

    d_r = float(DRIVER_FREIGHT_SHARE_RATE)
    h_r = float(HELPER_FREIGHT_SHARE_RATE)
    driver_amt = gross * d_r
    helper_amt = gross * h_r
    toll = float(knobs.toll_fees_php_per_trip)

    additives = fuel_cost + driver_amt + helper_amt + toll
    net_profit = gross + additives

    return {
        "truck_index": truck_index,
        "weight_tons": round(w, 4),
        "distance_km": round(float(km_eff), 2),
        "cargo_gross_php": round(gross, 2),
        "diesel_liters": round(liters, 2),
        "diesel_cost_php": round(fuel_cost, 2),
        "driver_share_php": round(driver_amt, 2),
        "helper_share_php": round(helper_amt, 2),
        "toll_fees_php": round(toll, 2),
        "additives_total_php": round(additives, 2),
        "net_profit_php": round(net_profit, 2),
    }


def customer_freight_pricing(km: float, total_weight_tons: float, knobs: FreightPricingKnobsLike) -> dict:
    """Multi-truck profit model: split cargo into ≤42 t loads; run the additive formula per truck; sum totals.

    Net profit (per truck) = (tons×650) + (km/4×fuel) + (gross×10%) + (gross×4.62%) + toll.
    Each truck is charged full-route fuel and full toll (separate vehicle per load).
    """
    km_eff = float(km)
    w_booking = (
        float(total_weight_tons)
        if math.isfinite(total_weight_tons) and float(total_weight_tons) > 0
        else 0.1
    )
    w_booking = min(168.0, max(0.1, w_booking))

    loads = split_cargo_into_truck_loads(w_booking, TRUCK_MAX_CAPACITY_TONS)
    if not loads:
        loads = [round(w_booking, 4)]

    truck_lines: list[dict[str, float | int]] = []
    for i, tons in enumerate(loads, start=1):
        truck_lines.append(_profit_line_one_truck(km_eff, tons, knobs, i))

    def sum_float(key: str) -> float:
        return round(sum(float(row[key]) for row in truck_lines), 2)

    total_trucks = len(truck_lines)
    cargo_gross = sum_float("cargo_gross_php")
    diesel_liters = sum_float("diesel_liters")
    diesel_cost = sum_float("diesel_cost_php")
    driver_share = sum_float("driver_share_php")
    helper_share = sum_float("helper_share_php")
    toll_total = sum_float("toll_fees_php")
    additives_total = sum_float("additives_total_php")
    net_total = sum_float("net_profit_php")

    diesel_per_l = float(knobs.diesel_price_php_per_liter)
    d_pct = round(float(DRIVER_FREIGHT_SHARE_RATE) * 100, 4)
    h_pct = round(float(HELPER_FREIGHT_SHARE_RATE) * 100, 4)
    cargo_rate = float(CARGO_RATE_PHP_PER_TON)

    return {
        "distance_km": round(km_eff, 2),
        "weight_tons": round(w_booking, 4),
        "total_trucks": total_trucks,
        "cargo_rate_php_per_ton": round(cargo_rate, 2),
        "cargo_gross_php": cargo_gross,
        "diesel_liters": diesel_liters,
        "diesel_cost_php": diesel_cost,
        "driver_share_php": driver_share,
        "helper_share_php": helper_share,
        "toll_fees_php": toll_total,
        "additives_total_php": additives_total,
        "net_profit_total_php": net_total,
        "quoted_total": net_total,
        "diesel_price_per_liter": round(diesel_per_l, 2),
        "driver_freight_share_pct": d_pct,
        "helper_freight_share_pct": h_pct,
        "truck_loads": truck_lines,
    }
