"""Road distance for a booking leg (pickup → dropoff), same source as customer pricing / OSRM."""

from __future__ import annotations

from app.core.config import settings
from app.models.entities import Booking, Trip
from app.services.route_estimate import estimate_road_distance_km


def stored_trip_distance_km(trip: Trip) -> float | None:
    """Km already on the trip row — no geocoding (safe for crew/dispatcher list endpoints)."""
    if trip.distance_km is None:
        return None
    km = float(trip.distance_km)
    return km if km > 0 else None


def booking_pickup_dropoff_distance_km(booking: Booking) -> float | None:
    """
    Returns routed km when geocoding + road engine succeed; None if unavailable.
    Callers should fall back to trip.distance_km or a legacy estimate only when this returns None.
    """
    try:
        est = estimate_road_distance_km(booking.pickup_location, booking.dropoff_location, settings)
        v = float(est.distance_km)
        return v if v > 0 else None
    except Exception:
        return None
