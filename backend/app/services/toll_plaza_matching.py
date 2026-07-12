"""Resolve booking locations to toll plazas via nearest coordinates (primary) or aliases."""
from __future__ import annotations

import math
import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.core.config import Settings, settings as app_settings
from app.models.entities import Route, TollMatrix, TollPlaza, TollPlazaAlias, TollPlazaStatus
from app.services.geocoding import geocode_coordinates

MatchMethod = Literal[
    "manual",
    "route_catalog",
    "exact_canonical",
    "alias_exact",
    "alias_fuzzy",
    "matrix_exact",
    "matrix_fuzzy",
    "nearest_geo",
    "none",
]
MatchConfidence = Literal["high", "medium", "none"]

NO_NEARBY_ENTRY_MESSAGE = "No nearby toll entry found."
NO_NEARBY_EXIT_MESSAGE = "No nearby toll exit found."
NO_EXPRESSWAY_MESSAGE = "No expressway detected. Toll = ₱0."
NO_PLAZA_MATCH_MESSAGE = NO_EXPRESSWAY_MESSAGE  # back-compat alias
LOW_CONFIDENCE_PLAZA_MESSAGE = (
    "Toll plazas matched with medium confidence; auto-applied for quotation."
)
NEAREST_GEO_ESTIMATE_MESSAGE = (
    "Toll estimated using nearest Toll Matrix plazas to pickup/dropoff."
)


def class3_missing_message(entry: str | None, exit_: str | None) -> str:
    if entry and exit_:
        return f"Vehicle Class 3 does not exist for this toll route ({entry} → {exit_})."
    return "Vehicle Class 3 does not exist for this toll route."


# Prefer plazas within this crow-flies radius when ranking nearest entry/exit.
NEAREST_PLAZA_MAX_KM = 120.0
NEAREST_PLAZA_TOP_K = 8
# Below this straight-line trip distance, treat as local / no expressway when matrix misses.
MIN_EXPRESSWAY_TRIP_KM = 12.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def normalize_location(value: str) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    text = text.replace(".", "")
    return text


@dataclass(frozen=True)
class PlazaMatch:
    canonical: str | None
    method: MatchMethod
    confidence: MatchConfidence


def _load_plaza_index(db: Session) -> list[tuple[TollPlaza, list[str]]]:
    plazas = db.query(TollPlaza).filter(TollPlaza.status == TollPlazaStatus.ACTIVE.value).all()
    alias_rows = db.query(TollPlazaAlias).all()
    by_plaza: dict[int, list[str]] = defaultdict(list)
    for alias_row in alias_rows:
        by_plaza[alias_row.plaza_id].append(alias_row.alias)
    return [(plaza, by_plaza.get(plaza.id, [])) for plaza in plazas]


def _match_text_to_plaza(text: str, index: list[tuple[TollPlaza, list[str]]]) -> PlazaMatch:
    norm = normalize_location(text)
    if not norm:
        return PlazaMatch(None, "none", "none")

    for plaza, aliases in index:
        if normalize_location(plaza.canonical_name) == norm:
            return PlazaMatch(plaza.canonical_name, "exact_canonical", "high")

    for plaza, aliases in index:
        for alias in aliases:
            if normalize_location(alias) == norm:
                return PlazaMatch(plaza.canonical_name, "alias_exact", "high")

    for plaza, aliases in index:
        for alias in aliases:
            alias_norm = normalize_location(alias)
            if alias_norm and (alias_norm in norm or norm in alias_norm):
                return PlazaMatch(plaza.canonical_name, "alias_exact", "high")

    for plaza, aliases in index:
        canon_norm = normalize_location(plaza.canonical_name)
        if canon_norm and (canon_norm in norm or norm in canon_norm):
            return PlazaMatch(plaza.canonical_name, "exact_canonical", "high")

    return PlazaMatch(None, "none", "none")


def _match_matrix_point(text: str, points: set[str]) -> PlazaMatch:
    norm = normalize_location(text)
    if not norm:
        return PlazaMatch(None, "none", "none")
    exact = [p for p in points if normalize_location(p) == norm]
    if exact:
        return PlazaMatch(exact[0], "matrix_exact", "high")
    fuzzy = [p for p in points if normalize_location(p) in norm or norm in normalize_location(p)]
    if fuzzy:
        return PlazaMatch(sorted(fuzzy, key=len, reverse=True)[0], "matrix_fuzzy", "medium")
    return PlazaMatch(None, "none", "none")


def list_plaza_options(db: Session) -> list[str]:
    """Canonical plaza names for manual selection dropdowns."""
    names: set[str] = set()
    for row in db.query(TollPlaza).filter(TollPlaza.status == TollPlazaStatus.ACTIVE.value).all():
        if row.canonical_name.strip():
            names.add(row.canonical_name.strip())
    for row in (
        db.query(TollMatrix.entry_point, TollMatrix.exit_point)
        .filter(TollMatrix.status == "active")
        .distinct()
        .all()
    ):
        if row.entry_point:
            names.add(row.entry_point.strip())
        if row.exit_point:
            names.add(row.exit_point.strip())
    return sorted(names, key=str.lower)


def find_route_catalog_match(db: Session, pickup: str, dropoff: str) -> tuple[str, str] | None:
    pickup_norm = normalize_location(pickup)
    dropoff_norm = normalize_location(dropoff)
    if not pickup_norm or not dropoff_norm:
        return None
    routes = db.query(Route).filter(Route.is_active.is_(True)).all()
    for route in routes:
        o = normalize_location(route.origin or "")
        d = normalize_location(route.destination or "")
        if not o or not d:
            continue
        if (o in pickup_norm or pickup_norm in o) and (d in dropoff_norm or dropoff_norm in d):
            return route.origin.strip(), route.destination.strip()
    return None


def _plazas_with_coords(db: Session) -> list[TollPlaza]:
    return (
        db.query(TollPlaza)
        .filter(
            TollPlaza.status == TollPlazaStatus.ACTIVE.value,
            TollPlaza.latitude.isnot(None),
            TollPlaza.longitude.isnot(None),
        )
        .all()
    )


def nearest_plazas_to_point(
    plazas: list[TollPlaza],
    lat: float,
    lon: float,
    *,
    top_k: int = NEAREST_PLAZA_TOP_K,
    max_km: float = NEAREST_PLAZA_MAX_KM,
) -> list[tuple[TollPlaza, float]]:
    ranked: list[tuple[TollPlaza, float]] = []
    for plaza in plazas:
        if plaza.latitude is None or plaza.longitude is None:
            continue
        dist = haversine_km(lat, lon, float(plaza.latitude), float(plaza.longitude))
        if dist <= max_km:
            ranked.append((plaza, dist))
    ranked.sort(key=lambda item: item[1])
    return ranked[: max(1, top_k)]


def resolve_nearest_geo_candidates(
    db: Session,
    *,
    pickup_location: str,
    dropoff_location: str,
    settings: Settings | None = None,
    top_k: int = NEAREST_PLAZA_TOP_K,
) -> tuple[list[tuple[str, float]], list[tuple[str, float]], dict]:
    """Geocode pickup/dropoff and return top-K nearest plaza names with distances (km)."""
    cfg = settings or app_settings
    meta: dict = {"is_estimated": True, "match_method": "nearest_geo"}
    plazas = _plazas_with_coords(db)
    if not plazas:
        meta["geo_error"] = "no_plazas_with_coords"
        return [], [], meta

    plat, plon, pprov = geocode_coordinates(pickup_location or "", cfg)
    dlat, dlon, dprov = geocode_coordinates(dropoff_location or "", cfg)
    meta["pickup_geocode_provider"] = pprov
    meta["dropoff_geocode_provider"] = dprov

    entry_ranked: list[tuple[str, float]] = []
    exit_ranked: list[tuple[str, float]] = []
    if plat is not None and plon is not None:
        entry_ranked = [
            (p.canonical_name, round(dist, 2))
            for p, dist in nearest_plazas_to_point(plazas, float(plat), float(plon), top_k=top_k)
        ]
        meta["pickup_lat"] = plat
        meta["pickup_lon"] = plon
    else:
        meta["geo_error"] = "pickup_geocode_failed"

    if dlat is not None and dlon is not None:
        exit_ranked = [
            (p.canonical_name, round(dist, 2))
            for p, dist in nearest_plazas_to_point(plazas, float(dlat), float(dlon), top_k=top_k)
        ]
        meta["dropoff_lat"] = dlat
        meta["dropoff_lon"] = dlon
    else:
        meta["geo_error"] = (
            "dropoff_geocode_failed" if "geo_error" not in meta else str(meta["geo_error"]) + "+dropoff"
        )

    if plat is not None and plon is not None and dlat is not None and dlon is not None:
        meta["straight_line_km"] = round(haversine_km(float(plat), float(plon), float(dlat), float(dlon)), 2)

    meta["nearest_entry_candidates"] = [{"plaza": n, "km": d} for n, d in entry_ranked]
    meta["nearest_exit_candidates"] = [{"plaza": n, "km": d} for n, d in exit_ranked]
    return entry_ranked, exit_ranked, meta


def resolve_plaza_pair(
    db: Session,
    *,
    pickup_location: str,
    dropoff_location: str,
    manual_entry: str | None = None,
    manual_exit: str | None = None,
    route_origin: str | None = None,
    route_destination: str | None = None,
) -> tuple[str | None, str | None, MatchMethod, MatchConfidence, dict]:
    """Resolve entry/exit via manual override or secondary text/alias matching (not primary auto path)."""
    meta: dict = {"is_estimated": False}

    if manual_entry and manual_exit:
        entry = manual_entry.strip()
        exit_ = manual_exit.strip()
        return entry, exit_, "manual", "high", {
            **meta,
            "entry_match_method": "manual",
            "exit_match_method": "manual",
        }

    index = _load_plaza_index(db)
    matrix_points: set[str] = set()
    for ep, xp in db.query(TollMatrix.entry_point, TollMatrix.exit_point).filter(TollMatrix.status == "active").all():
        if ep:
            matrix_points.add(ep.strip())
        if xp:
            matrix_points.add(xp.strip())

    route_o = route_origin
    route_d = route_destination
    if not route_o or not route_d:
        catalog = find_route_catalog_match(db, pickup_location, dropoff_location)
        if catalog:
            route_o, route_d = catalog
            meta["route_catalog_origin"] = route_o
            meta["route_catalog_destination"] = route_d

    if route_o and route_d:
        entry_match = _match_text_to_plaza(route_o, index)
        exit_match = _match_text_to_plaza(route_d, index)
        if entry_match.confidence == "none":
            entry_match = _match_matrix_point(route_o, matrix_points)
        if exit_match.confidence == "none":
            exit_match = _match_matrix_point(route_d, matrix_points)
        if (
            entry_match.canonical
            and exit_match.canonical
            and entry_match.confidence != "none"
            and exit_match.confidence != "none"
        ):
            conf: MatchConfidence = (
                "high"
                if entry_match.confidence == "high" and exit_match.confidence == "high"
                else "medium"
            )
            return (
                entry_match.canonical,
                exit_match.canonical,
                "route_catalog",
                conf,
                {
                    **meta,
                    "is_estimated": conf != "high",
                    "entry_match_method": entry_match.method,
                    "exit_match_method": exit_match.method,
                },
            )

    entry_match = _match_text_to_plaza(pickup_location, index)
    exit_match = _match_text_to_plaza(dropoff_location, index)
    if entry_match.confidence == "none":
        entry_match = _match_matrix_point(pickup_location, matrix_points)
    if exit_match.confidence == "none":
        exit_match = _match_matrix_point(dropoff_location, matrix_points)

    meta.update(
        {
            "entry_match_method": entry_match.method,
            "exit_match_method": exit_match.method,
        }
    )

    if not entry_match.canonical or not exit_match.canonical:
        return None, None, "none", "none", meta

    if entry_match.confidence == "high" and exit_match.confidence == "high":
        method: MatchMethod = entry_match.method if entry_match.method != "none" else "matrix_exact"
        return entry_match.canonical, exit_match.canonical, method, "high", meta

    if entry_match.confidence != "none" and exit_match.confidence != "none":
        meta["is_estimated"] = True
        return entry_match.canonical, exit_match.canonical, entry_match.method, "medium", meta

    return None, None, "none", "none", meta
