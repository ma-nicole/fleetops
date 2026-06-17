"""Distance resolution for quotes and toll overrides — no silent fallback km."""
from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings
from app.services.route_estimate import (
    MAP_LOCATION_VERIFY_WARNING,
    PreciseDistanceUnavailable,
    estimate_road_distance_km,
    heuristic_fallback_km,
)

DISTANCE_UNVERIFIED_WARNING = (
    "Distance could not be verified. Please confirm estimated distance manually."
)
QUOTE_STATUS_CONFIRMED = "Confirmed"
QUOTE_STATUS_PENDING = "Estimated / Pending distance confirmation"


@dataclass(frozen=True)
class DistanceResolution:
    distance_km: float
    distance_confirmed: bool
    distance_warning: str | None
    quote_status: str
    pickup_resolution: str
    dropoff_resolution: str
    pricing_tier: str
    routing_method: str


def resolve_quote_distance_km(
    pickup: str,
    dropoff: str,
    settings: Settings,
    *,
    distance_km_override: float | None = None,
    allow_unverified_with_manual_toll: bool = False,
    allow_unverified: bool = False,
) -> DistanceResolution:
    """Resolve route distance for pricing. Uses heuristic fallback when allow_unverified is set."""
    if distance_km_override is not None and float(distance_km_override) > 0:
        km = round(float(distance_km_override), 2)
        return DistanceResolution(
            distance_km=km,
            distance_confirmed=True,
            distance_warning=None,
            quote_status=QUOTE_STATUS_CONFIRMED,
            pickup_resolution="manual",
            dropoff_resolution="manual",
            pricing_tier="manual_distance",
            routing_method="distance_override",
        )

    try:
        est = estimate_road_distance_km(pickup, dropoff, settings)
        return DistanceResolution(
            distance_km=float(est.distance_km),
            distance_confirmed=True,
            distance_warning=None,
            quote_status=QUOTE_STATUS_CONFIRMED,
            pickup_resolution=est.pickup_provider,
            dropoff_resolution=est.dropoff_provider,
            pricing_tier=est.tier,
            routing_method=est.routing_method,
        )
    except PreciseDistanceUnavailable:
        if allow_unverified or allow_unverified_with_manual_toll:
            km = heuristic_fallback_km(pickup, dropoff)
            return DistanceResolution(
                distance_km=km,
                distance_confirmed=False,
                distance_warning=MAP_LOCATION_VERIFY_WARNING,
                quote_status=QUOTE_STATUS_PENDING,
                pickup_resolution="unavailable",
                dropoff_resolution="unavailable",
                pricing_tier="distance_unverified",
                routing_method="heuristic_fallback",
            )
        raise
