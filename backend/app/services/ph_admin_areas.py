"""Proxy Philippine Standard Geographic Code (PSGC) admin areas for cascading pickers."""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

PSGC_BASE = "https://psgc.gitlab.io/api"
_CACHE_TTL_S = 6 * 3600
_cache: dict[str, tuple[float, Any]] = {}


def _get_json(path: str) -> Any:
    now = time.monotonic()
    hit = _cache.get(path)
    if hit and now - hit[0] < _CACHE_TTL_S:
        return hit[1]
    url = f"{PSGC_BASE}{path}"
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(url, headers={"Accept": "application/json", "User-Agent": "FleetOpt/1.0"})
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning("PSGC fetch failed %s: %s", path, e)
        raise
    _cache[path] = (now, data)
    return data


def list_regions() -> list[dict[str, str]]:
    rows = _get_json("/regions.json")
    out = []
    for row in rows or []:
        code = str(row.get("code") or "").strip()
        name = str(row.get("name") or "").strip()
        if code and name:
            out.append({"code": code, "name": name, "region_name": str(row.get("regionName") or "")})
    return out


def list_provinces(region_code: str) -> list[dict[str, str]]:
    code = (region_code or "").strip()
    # NCR uses districts instead of provinces.
    if code.startswith("13"):
        rows = _get_json(f"/regions/{code}/districts.json")
        out = []
        for row in rows or []:
            c = str(row.get("code") or "").strip()
            name = str(row.get("name") or "").strip()
            if c and name:
                out.append({"code": c, "name": name, "kind": "district"})
        return out
    rows = _get_json(f"/regions/{code}/provinces.json")
    out = []
    for row in rows or []:
        c = str(row.get("code") or "").strip()
        name = str(row.get("name") or "").strip()
        if c and name:
            out.append({"code": c, "name": name, "kind": "province"})
    return out


def list_cities(parent_code: str, *, kind: str = "province") -> list[dict[str, str]]:
    code = (parent_code or "").strip()
    path = (
        f"/districts/{code}/cities-municipalities.json"
        if kind == "district"
        else f"/provinces/{code}/cities-municipalities.json"
    )
    rows = _get_json(path)
    out = []
    for row in rows or []:
        c = str(row.get("code") or "").strip()
        name = str(row.get("name") or "").strip()
        if c and name:
            out.append({"code": c, "name": name})
    return out


def list_barangays(city_code: str) -> list[dict[str, str]]:
    code = (city_code or "").strip()
    rows = _get_json(f"/cities-municipalities/{code}/barangays.json")
    out = []
    for row in rows or []:
        c = str(row.get("code") or "").strip()
        name = str(row.get("name") or "").strip()
        if c and name:
            out.append({"code": c, "name": name})
    return out
