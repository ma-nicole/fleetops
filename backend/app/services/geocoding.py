"""
Forward geocoding for booking route estimates.

- If GOOGLE_MAPS_SERVER_API_KEY or GOOGLE_MAPS_GEOCODING_API_KEY is set and the key allows server
  requests, uses Google Geocoding API.
- Else uses OpenStreetMap Nominatim (free; polite 1 req/s throttle + cache).

Keys restricted to “HTTP referrers” only work in the browser — not from FastAPI. Use a server key.

Nominatim usage policy:
https://operations.osmfoundation.org/policies/nominatim/
"""

from __future__ import annotations

import hashlib
import logging
import re
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


def _server_google_maps_key(settings: Settings) -> str:
    """Key for server-side Geocoding HTTP calls (IP / unrestricted — not websites-only)."""
    s = (getattr(settings, "google_maps_server_api_key", None) or "").strip()
    if s:
        return s
    return (settings.google_maps_geocoding_api_key or "").strip()


def _geocode_cache_key(normalized_addr: str, settings: Settings) -> str:
    """Invalidate cached Nominatim pins when Google keys are added or changed."""
    base = "".join(normalized_addr.lower().split())
    gk = _server_google_maps_key(settings)
    if gk:
        fp = hashlib.sha256(gk.encode()).hexdigest()[:12]
        return f"{base}|g:{fp}"
    return f"{base}|n"


def normalize_address_for_geocode(raw: str) -> str:
    """Strip site labels (e.g. ``MAIN WAREHOUSE — 214 …``) and fix common PH typos for Nominatim."""
    s = (raw or "").strip()
    if not s:
        return s
    # "LABEL — address" / "LABEL – address" (em/en dash, common in UI)
    s = re.sub(r"^[^\n\u2014\u2013]{1,200}[\u2014\u2013]\s*", "", s)
    # "LABEL: address"
    s = re.sub(r"^[^\n:]{1,120}:\s+", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Common misspellings (Philippines)
    s = re.sub(r"\bquezo\b", "Quezon", s, flags=re.IGNORECASE)
    s = re.sub(r"\brodrig\b", "Rodriguez", s, flags=re.IGNORECASE)
    s = re.sub(r"\bcomonwealth\b", "Commonwealth", s, flags=re.IGNORECASE)
    s = re.sub(r"\bparanaqe\b", "Parañaque", s, flags=re.IGNORECASE)
    s = re.sub(r"\bparanaque\b", "Parañaque", s, flags=re.IGNORECASE)
    return s


def _fallback_geocode_queries(normalized: str) -> list[str]:
    """Extra queries when the full string returns zero Nominatim hits."""
    out: list[str] = []
    parts = [p.strip() for p in normalized.split(",") if p.strip()]
    if len(parts) >= 2:
        # Drop leading segment if it looks like a venue name without a street number
        first = parts[0]
        if not any(ch.isdigit() for ch in first) and len(parts) >= 2:
            tail = ", ".join(parts[1:])
            if tail not in out:
                out.append(tail)
        # Shorter tail: barangay + town + province
        if len(parts) >= 3:
            tail3 = ", ".join(parts[-3:])
            if tail3 not in out and tail3 != normalized:
                out.append(tail3)
        tail2 = ", ".join(parts[-2:])
        if tail2 not in out and tail2 != normalized:
            out.append(tail2)
    return out


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
    key = _server_google_maps_key(settings)
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
            st = data.get("status")
            if st not in ("OK", "ZERO_RESULTS"):
                logger.warning(
                    "Google geocode status=%s error_message=%s — if REQUEST_DENIED, use GOOGLE_MAPS_SERVER_API_KEY "
                    "(IP / no referrer restriction) for backend calls",
                    st,
                    data.get("error_message") or "",
                )
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


def _pick_best_nominatim_row(rows: list[dict[str, Any]], original_query: str) -> dict[str, Any] | None:
    """Prefer house/building-level hits when the user typed a street-level address (avoids 'Rizal' province centroid)."""
    if not rows:
        return None
    if len(rows) == 1:
        return rows[0]

    q = original_query.strip().lower()
    word_count = len(q.split())
    has_digit = any(ch.isdigit() for ch in original_query)

    def score_row(row: dict[str, Any]) -> float:
        importance = float(row.get("importance") or 0.0)
        cls = str(row.get("class") or "").lower()
        typ = str(row.get("type") or "").lower()
        addr_type = str(row.get("addresstype") or "").lower()
        score = importance

        if has_digit and word_count >= 3:
            if typ in ("house", "building", "detached", "terrace", "apartments", "residential", "yes"):
                score += 5.0
            if cls == "building" or addr_type in ("building", "house"):
                score += 4.0
            if typ in ("suburb", "village", "neighbourhood", "quarter", "city_district", "road"):
                score += 2.0
            if typ in ("hamlet", "town", "city"):
                score += 1.0
            # Broad admin boundary — bad match for a long street address
            if word_count >= 5 and typ in ("administrative", "state", "province", "county"):
                score -= 4.0
        else:
            if typ in ("administrative", "state", "province") and word_count >= 4:
                score -= 2.0

        return score

    return max(rows, key=score_row)


def _query_nominatim_once(address: str, settings: Settings) -> tuple[float, float] | None:
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
                    "limit": "10",
                    "countrycodes": "ph",
                    "addressdetails": "1",
                },
                headers={"User-Agent": ua},
            )
            r.raise_for_status()
            rows: list[dict[str, Any]] = r.json()
            if not rows:
                return None
            best = _pick_best_nominatim_row(rows, address)
            if not best:
                return None
            return float(best["lat"]), float(best["lon"])
    except Exception as e:
        logger.warning("Nominatim geocode failed: %s", e)
        return None


def _query_nominatim(address: str, settings: Settings) -> tuple[float, float] | None:
    """Try full address, then shorter fallback queries."""
    found = _query_nominatim_once(address, settings)
    if found:
        return found
    for fb in _fallback_geocode_queries(address):
        if len(fb) < 4:
            continue
        found = _query_nominatim_once(fb, settings)
        if found:
            return found
    return None


def geocode_coordinates(address: str, settings: Settings) -> tuple[float | None, float | None, str]:
    """
    Returns (lat, lon, provider) where provider is google | nominatim | none.
    """
    a = normalize_address_for_geocode(address)
    if len(a) < 3:
        return None, None, "none"

    cache_key = _geocode_cache_key(a, settings)
    cached = _cache_get(cache_key)
    if cached:
        lat, lon, prov = cached
        return lat, lon, prov

    g = _query_google(a, settings)
    if g:
        lat, lon = g
        _cache_set(cache_key, lat, lon, "google")
        return lat, lon, "google"

    n = _query_nominatim(a, settings)
    if n:
        lat, lon = n
        _cache_set(cache_key, lat, lon, "nominatim")
        return lat, lon, "nominatim"

    return None, None, "none"
