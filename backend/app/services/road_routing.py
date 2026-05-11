"""
Driving distance (road network) between two WGS84 points.

Precedence (when enabled and keys set):

1. **Google Directions API** (``driving``) — aligns with **Google Maps** driving distance for the same endpoints.
2. **OpenRouteService** — ``driving-hgv`` or ``driving-car`` on OpenStreetMap.
3. **OSRM** — public demo ``driving`` (car-oriented OSM) or self-hosted profile.

Coordinates: latitude / longitude (EPSG:4326). OSRM URLs use lon,lat order.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

_OSRM_PROFILE_RE = re.compile(r"^[a-z][a-z0-9_-]{0,48}$", re.IGNORECASE)


def effective_google_directions_key(settings: Settings) -> str:
    """Directions API key: dedicated key, or GOOGLE_MAPS_GEOCODING_API_KEY when fallback is enabled."""
    d = (getattr(settings, "google_maps_directions_api_key", None) or "").strip()
    if d:
        return d
    if getattr(settings, "google_directions_fallback_to_geocoding_key", True):
        return (getattr(settings, "google_maps_geocoding_api_key", None) or "").strip()
    return ""


def _sanitize_osrm_profile(raw: str | None) -> str:
    s = (raw or "driving").strip().lower()
    if _OSRM_PROFILE_RE.fullmatch(s):
        return s
    logger.warning("Invalid OSRM_ROUTE_PROFILE %r — using 'driving'", raw)
    return "driving"


def _google_directions_driving_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    api_key: str,
) -> float | None:
    """Google Maps Platform Directions API — driving distance (best match to Google Maps)."""
    key = api_key.strip()
    if not key:
        return None
    origin = f"{lat1},{lon1}"
    dest = f"{lat2},{lon2}"
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params={
                    "origin": origin,
                    "destination": dest,
                    "mode": "driving",
                    "region": "ph",
                    "key": key,
                },
            )
            r.raise_for_status()
            data: dict[str, Any] = r.json()
    except Exception as e:
        logger.warning("Google Directions failed: %s", e)
        return None

    status = data.get("status")
    if status != "OK":
        logger.warning(
            "Google Directions status=%s error_message=%s — enable Directions API on the key; server must not use "
            "HTTP-referrer-only restricted keys",
            status,
            data.get("error_message") or "",
        )
        return None
    routes = data.get("routes") or []
    if not routes:
        return None
    total_m = 0.0
    for leg in routes[0].get("legs") or []:
        if not isinstance(leg, dict):
            continue
        dist = (leg.get("distance") or {}).get("value")
        if isinstance(dist, (int, float)) and dist > 0:
            total_m += float(dist)
    if total_m <= 0:
        return None
    return round(total_m / 1000.0, 2)


def _ors_route_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    api_key: str,
    profile: str,
) -> float | None:
    key = api_key.strip()
    if not key:
        return None
    url = f"https://api.openrouteservice.org/v2/directions/{profile}"
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.post(
                url,
                json={"coordinates": [[lon1, lat1], [lon2, lat2]]},
                headers={
                    "Authorization": key,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code >= 400:
                logger.warning("OpenRouteService HTTP %s: %s", r.status_code, r.text[:200])
                return None
            data = r.json()
    except Exception as e:
        logger.warning("OpenRouteService request failed: %s", e)
        return None

    # GeoJSON FeatureCollection — summary.distance is meters
    features = data.get("features") if isinstance(data, dict) else None
    if features and isinstance(features, list) and len(features) > 0:
        props = features[0].get("properties") or {}
        summary = props.get("summary") or {}
        dist = summary.get("distance")
        if isinstance(dist, (int, float)) and dist > 0:
            return round(float(dist) / 1000.0, 2)
        segments = props.get("segments") or []
        if isinstance(segments, list) and segments:
            total_m = sum(float(s.get("distance") or 0) for s in segments if isinstance(s, dict))
            if total_m > 0:
                return round(total_m / 1000.0, 2)

    routes = data.get("routes") if isinstance(data, dict) else None
    if routes and isinstance(routes, list) and len(routes) > 0:
        summary = routes[0].get("summary") or {}
        dist = summary.get("distance")
        if isinstance(dist, (int, float)) and dist > 0:
            return round(float(dist) / 1000.0, 2)

    return None


def _osrm_route_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    base_url: str,
    profile: str,
) -> float | None:
    base = (base_url or "").strip().rstrip("/")
    if not base:
        return None
    prof = _sanitize_osrm_profile(profile)
    # OSRM expects lon,lat; limit precision for stable caching on server
    lon1, lat1, lon2, lat2 = (
        round(lon1, 6),
        round(lat1, 6),
        round(lon2, 6),
        round(lat2, 6),
    )
    path_coords = f"{lon1},{lat1};{lon2},{lat2}"
    url = f"{base}/route/v1/{prof}/{path_coords}"
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.get(url, params={"overview": "false", "steps": "false"})
            if r.status_code >= 400:
                logger.warning("OSRM HTTP %s: %s", r.status_code, r.text[:200])
                return None
            data: dict[str, Any] = r.json()
    except Exception as e:
        logger.warning("OSRM request failed: %s", e)
        return None

    if data.get("code") != "Ok":
        logger.warning("OSRM code %s message=%s", data.get("code"), data.get("message"))
        return None
    routes = data.get("routes") or []
    if not routes:
        return None
    meters = routes[0].get("distance")
    if not isinstance(meters, (int, float)) or meters <= 0:
        return None
    return round(float(meters) / 1000.0, 2)


def driving_route_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    settings: Settings,
) -> tuple[float | None, str]:
    """
    Returns (kilometers, provider_tag).
    provider_tag: google_directions | openrouteservice_hgv | openrouteservice_car | osrm | unavailable
    """
    if getattr(settings, "use_google_directions_for_routing", True):
        gkey = effective_google_directions_key(settings)
        if gkey:
            km = _google_directions_driving_km(lat1, lon1, lat2, lon2, gkey)
            if km is not None:
                return km, "google_directions"

    key = (getattr(settings, "openrouteservice_api_key", None) or "").strip()
    if key:
        if getattr(settings, "use_truck_route_profile", True):
            km_hgv = _ors_route_km(lat1, lon1, lat2, lon2, key, "driving-hgv")
            if km_hgv is not None:
                return km_hgv, "openrouteservice_hgv"
            km_car = _ors_route_km(lat1, lon1, lat2, lon2, key, "driving-car")
            if km_car is not None:
                return km_car, "openrouteservice_car"
        else:
            km_car = _ors_route_km(lat1, lon1, lat2, lon2, key, "driving-car")
            if km_car is not None:
                return km_car, "openrouteservice_car"

    if not getattr(settings, "use_osrm_driving_distance", True):
        return None, "unavailable"

    base = (getattr(settings, "osrm_route_base_url", None) or "https://router.project-osrm.org").strip()
    osrm_prof = getattr(settings, "osrm_route_profile", None) or "driving"
    km = _osrm_route_km(lat1, lon1, lat2, lon2, base, osrm_prof)
    if km is not None:
        return km, "osrm"
    return None, "unavailable"
