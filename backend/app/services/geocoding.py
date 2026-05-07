"""
Forward geocoding for booking route estimates.

- If GOOGLE_MAPS_GEOCODING_API_KEY is set, uses Google Geocoding API.
- Else uses OpenStreetMap Nominatim (free; polite 1 req/s throttle + cache).

Nominatim usage policy:
https://operations.osmfoundation.org/policies/nominatim/
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

GEOCODE_CACHE_TTL_S = 24 * 3600
GEOCODE_CACHE_MAX = 256
_NOM_DELAY_S = 1.1

_cache: dict[str, tuple[float, float, float, str]] = {}
_cache_lock = threading.Lock()
_nom_lock = threading.Lock()
_last_nom_at = 0.0


def _cache_get(key: str) -> tuple[float, float, str] | None:
    now = time.monotonic()
    with _cache_lock:
        hit = _cache.get(key)
        if not hit:
            return None
        lat, lon, saved_at, prov = hit
        if now - saved_at > GEOCODE_CACHE_TTL_S:
            del _cache[key]
            return None
        return lat, lon, prov


def _cache_set(key: str, lat: float, lon: float, provider: str) -> None:
    now = time.monotonic()
    with _cache_lock:
        if len(_cache) >= GEOCODE_CACHE_MAX:
            oldest_k = min(_cache.keys(), key=lambda k: _cache[k][2])
            del _cache[oldest_k]
        _cache[key] = (lat, lon, now, provider)


def _respect_nom_throttle() -> None:
    global _last_nom_at
    with _nom_lock:
        now = time.monotonic()
        wait = _last_nom_at + _NOM_DELAY_S - now
        if wait > 0:
            time.sleep(wait)
        _last_nom_at = time.monotonic()


def _query_google(address: str, settings: Settings) -> tuple[float, float] | None:
    key = (settings.google_maps_geocoding_api_key or "").strip()
    if not key:
        return None
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": address, "key": key, "region": "ph"},
            )
            r.raise_for_status()
            data = r.json()
            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                logger.warning("Google geocode status %s", data.get("status"))
            results = data.get("results") or []
            if not results:
                return None
            loc = results[0].get("geometry", {}).get("location") or {}
            lat = loc.get("lat")
            lng = loc.get("lng")
            if lat is None or lng is None:
                return None
            return float(lat), float(lng)
    except Exception as e:
        logger.warning("Google geocode failed: %s", e)
        return None


def _query_nominatim(address: str, settings: Settings) -> tuple[float, float] | None:
    ua = settings.geocoding_user_agent.strip() or "FleetOpt/1.0"
    bias = ", Philippines"
    query = address if bias.lower() in address.lower() else f"{address}{bias}"

    _respect_nom_throttle()
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": query,
                    "format": "json",
                    "limit": "1",
                    "countrycodes": "ph",
                },
                headers={"User-Agent": ua},
            )
            r.raise_for_status()
            rows: list[dict[str, Any]] = r.json()
            if not rows:
                return None
            row = rows[0]
            return float(row["lat"]), float(row["lon"])
    except Exception as e:
        logger.warning("Nominatim geocode failed: %s", e)
        return None


def geocode_coordinates(address: str, settings: Settings) -> tuple[float | None, float | None, str]:
    """
    Returns (lat, lon, provider) where provider is google | nominatim | none.
    """
    a = address.strip()
    if len(a) < 3:
        return None, None, "none"

    key = "".join(a.lower().split())
    cached = _cache_get(key)
    if cached:
        lat, lon, prov = cached
        return lat, lon, prov

    g = _query_google(a, settings)
    if g:
        lat, lon = g
        _cache_set(key, lat, lon, "google")
        return lat, lon, "google"

    n = _query_nominatim(a, settings)
    if n:
        lat, lon = n
        _cache_set(key, lat, lon, "nominatim")
        return lat, lon, "nominatim"

    return None, None, "none"
