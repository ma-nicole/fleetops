"""Menruz / FleetOpt service area — Northern Luzon only."""

from __future__ import annotations

# PSGC region codes (9-digit) for Northern Luzon service coverage.
# Region I (Ilocos), Region II (Cagayan Valley), CAR (Cordillera).
NORTHERN_LUZON_REGION_CODES: frozenset[str] = frozenset(
    {
        "010000000",  # Ilocos Region
        "020000000",  # Cagayan Valley
        "140000000",  # CAR
    }
)

NORTHERN_LUZON_REGION_NAME_HINTS: frozenset[str] = frozenset(
    {
        "ilocos",
        "cagayan valley",
        "cordillera",
        " car",
        "car ",
    }
)

# Approximate bounding box for Northern Luzon (WGS84) — used to filter free-text search/map pins.
NORTHERN_LUZON_BBOX = {
    "min_lat": 15.6,
    "max_lat": 19.4,
    "min_lon": 119.4,
    "max_lon": 122.6,
}


def is_northern_luzon_region_code(code: str | None) -> bool:
    raw = (code or "").strip()
    if not raw:
        return False
    if raw in NORTHERN_LUZON_REGION_CODES:
        return True
    # Tolerate 10-digit PSGC variants by prefix match on the first 2 digits.
    prefix = raw[:2]
    return prefix in {"01", "02", "14"}


def is_within_northern_luzon(lat: float | None, lon: float | None) -> bool:
    if lat is None or lon is None:
        return False
    try:
        la = float(lat)
        lo = float(lon)
    except (TypeError, ValueError):
        return False
    box = NORTHERN_LUZON_BBOX
    return box["min_lat"] <= la <= box["max_lat"] and box["min_lon"] <= lo <= box["max_lon"]


def label_suggests_northern_luzon(label: str | None) -> bool:
    text = f" {(label or '').lower()} "
    if any(h in text for h in ("ilocos", "cagayan", "cordillera", "benguet", "abra", "apayao", "kalinga", "ifugao", "mountain province")):
        return True
    # Common Northern Luzon cities/provinces
    tips = (
        "baguio",
        "laoag",
        "vigan",
        "tuguegarao",
        "santiago city",
        "candon",
        "san fernando city",
        "la union",
        "pangasinan",
        "ilocos norte",
        "ilocos sur",
        "isabela",
        "nueva vizcaya",
        "quirino",
        "batanes",
    )
    return any(t in text for t in tips)
