"""
Driving distance (road network) between two WGS84 points.

Precedence (when enabled and keys set):

1. **Google Directions API** (``driving``) — aligns with **Google Maps** driving distance for the same endpoints.
2. **OpenRouteService** — ``driving-hgv`` or ``driving-car`` on OpenStreetMap.
3. **OSRM** — public demo ``driving`` (car-oriented OSM) or self-hosted profile.

Coordinates: latitude / longitude (EPSG:4326). OSRM URLs use lon,lat order.

``driving_route_distance_km`` remains the single-route API used by existing callers.
``driving_route_alternatives`` extends the same providers to return multiple options when available
(Google ``alternatives=true``, ORS ``alternative_routes``, OSRM ``alternatives=2``).
Pass ``avoid_tolls=True`` for a real preference-strategy call (Google ``avoid=tolls`` / ORS tollways).
Do not invent padding options when the provider returns only one path.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

_OSRM_PROFILE_RE = re.compile(r"^[a-z][a-z0-9_-]{0,48}$", re.IGNORECASE)

# Ask providers for enough alternates to usually yield 3 distinct options.
_MAX_ROUTE_OPTIONS = 3


@dataclass(frozen=True)
class RoadRouteOption:
    """One candidate driving path from a routing provider."""

    distance_km: float
    duration_seconds: float | None
    provider: str
    index: int
    summary: str | None = None


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


def _dedupe_route_options(options: list[RoadRouteOption]) -> list[RoadRouteOption]:
    """Drop near-duplicate paths (same distance / duration within a small tolerance)."""
    kept: list[RoadRouteOption] = []
    for opt in options:
        duplicate = False
        for prev in kept:
            if abs(prev.distance_km - opt.distance_km) <= 0.35:
                prev_dur = prev.duration_seconds or 0.0
                cur_dur = opt.duration_seconds or 0.0
                if prev_dur <= 0 or cur_dur <= 0 or abs(prev_dur - cur_dur) <= 90:
                    duplicate = True
                    break
        if not duplicate:
            kept.append(opt)
        if len(kept) >= _MAX_ROUTE_OPTIONS:
            break
    return kept


def _google_directions_options(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    api_key: str,
    *,
    alternatives: bool,
    avoid_tolls: bool = False,
    avoid_highways: bool = False,
) -> list[RoadRouteOption]:
    """Google Maps Platform Directions API — one or more driving routes."""
    key = api_key.strip()
    if not key:
        return []
    origin = f"{lat1},{lon1}"
    dest = f"{lat2},{lon2}"
    params: dict[str, str] = {
        "origin": origin,
        "destination": dest,
        "mode": "driving",
        "region": "ph",
        # Prefer a single primary path when applying avoidance preferences.
        "alternatives": "true" if alternatives and not avoid_tolls and not avoid_highways else "false",
        "key": key,
    }
    avoid_parts: list[str] = []
    if avoid_tolls:
        avoid_parts.append("tolls")
    if avoid_highways:
        avoid_parts.append("highways")
    if avoid_parts:
        params["avoid"] = "|".join(avoid_parts)
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params=params,
            )
            r.raise_for_status()
            data: dict[str, Any] = r.json()
    except Exception as e:
        logger.warning("Google Directions failed: %s", e)
        return []

    status = data.get("status")
    if status != "OK":
        logger.warning(
            "Google Directions status=%s error_message=%s — enable Directions API on the key; server must not use "
            "HTTP-referrer-only restricted keys",
            status,
            data.get("error_message") or "",
        )
        return []
    routes = data.get("routes") or []
    out: list[RoadRouteOption] = []
    if avoid_tolls and avoid_highways:
        provider = "google_directions_avoid_tolls_highways"
    elif avoid_tolls:
        provider = "google_directions_avoid_tolls"
    elif avoid_highways:
        provider = "google_directions_avoid_highways"
    else:
        provider = "google_directions"
    for idx, route in enumerate(routes):
        if not isinstance(route, dict):
            continue
        total_m = 0.0
        total_s = 0.0
        for leg in route.get("legs") or []:
            if not isinstance(leg, dict):
                continue
            dist = (leg.get("distance") or {}).get("value")
            dur = (leg.get("duration") or {}).get("value")
            if isinstance(dist, (int, float)) and dist > 0:
                total_m += float(dist)
            if isinstance(dur, (int, float)) and dur > 0:
                total_s += float(dur)
        if total_m <= 0:
            continue
        summary = route.get("summary")
        out.append(
            RoadRouteOption(
                distance_km=round(total_m / 1000.0, 2),
                duration_seconds=round(total_s, 1) if total_s > 0 else None,
                provider=provider,
                index=idx,
                summary=str(summary).strip() if summary else None,
            )
        )
    return _dedupe_route_options(out)


def _ors_route_options(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    api_key: str,
    profile: str,
    *,
    alternatives: bool,
    avoid_tolls: bool = False,
) -> list[RoadRouteOption]:
    key = api_key.strip()
    if not key:
        return []
    url = f"https://api.openrouteservice.org/v2/directions/{profile}"
    body: dict[str, Any] = {"coordinates": [[lon1, lat1], [lon2, lat2]]}
    if avoid_tolls:
        # ORS Directions v2 — avoid tollways when the profile/key supports it.
        body["options"] = {"avoid_features": ["tollways"]}
    elif alternatives:
        body["alternative_routes"] = {
            "target_count": 3,
            "share_factor": 0.6,
            "weight_factor": 1.4,
        }
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.post(
                url,
                json=body,
                headers={
                    "Authorization": key,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code >= 400 and (alternatives or avoid_tolls):
                # Some profiles/keys reject alternative_routes / avoid_features — retry primary only.
                logger.warning(
                    "OpenRouteService HTTP %s (alts=%s avoid_tolls=%s) — retrying primary",
                    r.status_code,
                    alternatives,
                    avoid_tolls,
                )
                if avoid_tolls:
                    return []
                return _ors_route_options(
                    lat1, lon1, lat2, lon2, api_key, profile, alternatives=False, avoid_tolls=False
                )
            if r.status_code >= 400:
                logger.warning("OpenRouteService HTTP %s: %s", r.status_code, r.text[:200])
                return []
            data = r.json()
    except Exception as e:
        logger.warning("OpenRouteService request failed: %s", e)
        return []

    base_provider = "openrouteservice_hgv" if "hgv" in profile else "openrouteservice_car"
    provider = f"{base_provider}_avoid_tolls" if avoid_tolls else base_provider
    out: list[RoadRouteOption] = []

    features = data.get("features") if isinstance(data, dict) else None
    if features and isinstance(features, list):
        for idx, feat in enumerate(features):
            if not isinstance(feat, dict):
                continue
            props = feat.get("properties") or {}
            summary = props.get("summary") or {}
            dist = summary.get("distance")
            dur = summary.get("duration")
            if not isinstance(dist, (int, float)) or dist <= 0:
                segments = props.get("segments") or []
                if isinstance(segments, list) and segments:
                    dist = sum(float(s.get("distance") or 0) for s in segments if isinstance(s, dict))
                    dur = sum(float(s.get("duration") or 0) for s in segments if isinstance(s, dict))
            if not isinstance(dist, (int, float)) or dist <= 0:
                continue
            out.append(
                RoadRouteOption(
                    distance_km=round(float(dist) / 1000.0, 2),
                    duration_seconds=round(float(dur), 1) if isinstance(dur, (int, float)) and dur > 0 else None,
                    provider=provider,
                    index=idx,
                    summary=None,
                )
            )
        if out:
            return _dedupe_route_options(out)

    # JSON (non-geojson) fallback
    routes = data.get("routes") if isinstance(data, dict) else None
    if routes and isinstance(routes, list):
        for idx, route in enumerate(routes):
            if not isinstance(route, dict):
                continue
            summary = route.get("summary") or {}
            dist = summary.get("distance")
            dur = summary.get("duration")
            if isinstance(dist, (int, float)) and dist > 0:
                out.append(
                    RoadRouteOption(
                        distance_km=round(float(dist) / 1000.0, 2),
                        duration_seconds=round(float(dur), 1) if isinstance(dur, (int, float)) and dur > 0 else None,
                        provider=provider,
                        index=idx,
                        summary=None,
                    )
                )
    return _dedupe_route_options(out)


def _osrm_route_options(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    base_url: str,
    profile: str,
    *,
    alternatives: bool,
) -> list[RoadRouteOption]:
    base = (base_url or "").strip().rstrip("/")
    if not base:
        return []
    prof = _sanitize_osrm_profile(profile)
    lon1, lat1, lon2, lat2 = (
        round(lon1, 6),
        round(lat1, 6),
        round(lon2, 6),
        round(lat2, 6),
    )
    path_coords = f"{lon1},{lat1};{lon2},{lat2}"
    url = f"{base}/route/v1/{prof}/{path_coords}"
    params: dict[str, str] = {"overview": "false", "steps": "false"}
    if alternatives:
        params["alternatives"] = "2"
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.get(url, params=params)
            if r.status_code >= 400:
                logger.warning("OSRM HTTP %s: %s", r.status_code, r.text[:200])
                return []
            data: dict[str, Any] = r.json()
    except Exception as e:
        logger.warning("OSRM request failed: %s", e)
        return []

    if data.get("code") != "Ok":
        logger.warning("OSRM code %s message=%s", data.get("code"), data.get("message"))
        return []
    routes = data.get("routes") or []
    out: list[RoadRouteOption] = []
    for idx, route in enumerate(routes):
        if not isinstance(route, dict):
            continue
        meters = route.get("distance")
        seconds = route.get("duration")
        if not isinstance(meters, (int, float)) or meters <= 0:
            continue
        out.append(
            RoadRouteOption(
                distance_km=round(float(meters) / 1000.0, 2),
                duration_seconds=round(float(seconds), 1) if isinstance(seconds, (int, float)) and seconds > 0 else None,
                provider="osrm",
                index=idx,
                summary=None,
            )
        )
    return _dedupe_route_options(out)


def driving_route_alternatives(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    settings: Settings,
    *,
    max_options: int = _MAX_ROUTE_OPTIONS,
    want_alternatives: bool = True,
    avoid_tolls: bool = False,
    avoid_highways: bool = False,
) -> tuple[list[RoadRouteOption], str]:
    """
    Returns (route options, provider_tag). Prefer the same engine precedence as single-route distance.

    When ``avoid_tolls`` / ``avoid_highways`` is True, request a single preference-strategy path.
    Do not invent padding options.
    """
    limit = max(1, min(int(max_options or _MAX_ROUTE_OPTIONS), _MAX_ROUTE_OPTIONS))
    preference = bool(avoid_tolls or avoid_highways)
    if preference:
        limit = 1
    alt = bool(want_alternatives) and limit > 1 and not preference

    if getattr(settings, "use_google_directions_for_routing", True):
        gkey = effective_google_directions_key(settings)
        if gkey:
            opts = _google_directions_options(
                lat1,
                lon1,
                lat2,
                lon2,
                gkey,
                alternatives=alt,
                avoid_tolls=avoid_tolls,
                avoid_highways=avoid_highways,
            )
            if opts:
                return opts[:limit], opts[0].provider

    key = (getattr(settings, "openrouteservice_api_key", None) or "").strip()
    if key:
        profiles = (
            ["driving-hgv", "driving-car"]
            if getattr(settings, "use_truck_route_profile", True)
            else ["driving-car"]
        )
        for profile in profiles:
            opts = _ors_route_options(
                lat1, lon1, lat2, lon2, key, profile, alternatives=alt, avoid_tolls=avoid_tolls
            )
            if opts:
                return opts[:limit], opts[0].provider

    if preference:
        # OSRM public demo has no reliable toll/highway-avoid preference.
        return [], "unavailable"

    if not getattr(settings, "use_osrm_driving_distance", True):
        return [], "unavailable"

    base = (getattr(settings, "osrm_route_base_url", None) or "https://router.project-osrm.org").strip()
    osrm_prof = getattr(settings, "osrm_route_profile", None) or "driving"
    opts = _osrm_route_options(lat1, lon1, lat2, lon2, base, osrm_prof, alternatives=alt)
    if opts:
        return opts[:limit], "osrm"
    return [], "unavailable"


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
    opts, provider = driving_route_alternatives(
        lat1, lon1, lat2, lon2, settings, max_options=1, want_alternatives=False
    )
    if opts:
        return opts[0].distance_km, provider
    return None, "unavailable"
