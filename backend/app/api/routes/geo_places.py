"""Crew geocoding / PH admin area helpers for structured location pickers."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import require_roles
from app.models.entities import User, UserRole
from app.services import ph_admin_areas
from app.services.geocoding import geocode_coordinates, reverse_geocode_label, search_place_suggestions

router = APIRouter(prefix="/geo", tags=["geo"])

_CREW = require_roles(UserRole.HELPER, UserRole.DRIVER, UserRole.DISPATCHER, UserRole.ADMIN, UserRole.MANAGER)


class PlaceSuggestion(BaseModel):
    label: str
    latitude: float
    longitude: float
    provider: str


class GeocodeResponse(BaseModel):
    label: str
    latitude: float | None
    longitude: float | None
    provider: str


class ReverseResponse(BaseModel):
    label: str | None
    latitude: float
    longitude: float
    provider: str


class AdminAreaItem(BaseModel):
    code: str
    name: str
    kind: str | None = None
    region_name: str | None = None


@router.get("/places/search", response_model=list[PlaceSuggestion])
def search_places(
    q: str = Query(..., min_length=3, max_length=400),
    limit: int = Query(default=6, ge=1, le=10),
    _: User = Depends(_CREW),
):
    rows = search_place_suggestions(q, settings, limit=limit)
    return [PlaceSuggestion(**row) for row in rows]


@router.get("/places/geocode", response_model=GeocodeResponse)
def geocode_place(
    q: str = Query(..., min_length=3, max_length=400),
    _: User = Depends(_CREW),
):
    lat, lon, provider = geocode_coordinates(q, settings)
    return GeocodeResponse(label=q.strip(), latitude=lat, longitude=lon, provider=provider)


@router.get("/places/reverse", response_model=ReverseResponse)
def reverse_place(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    _: User = Depends(_CREW),
):
    label, provider = reverse_geocode_label(lat, lon, settings)
    return ReverseResponse(label=label, latitude=lat, longitude=lon, provider=provider)


@router.get("/ph/regions", response_model=list[AdminAreaItem])
def ph_regions(_: User = Depends(_CREW)):
    try:
        return [AdminAreaItem(**r) for r in ph_admin_areas.list_regions()]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unable to load PH regions: {e}") from e


@router.get("/ph/provinces", response_model=list[AdminAreaItem])
def ph_provinces(
    region_code: str = Query(..., min_length=2, max_length=32),
    _: User = Depends(_CREW),
):
    try:
        return [AdminAreaItem(**r) for r in ph_admin_areas.list_provinces(region_code)]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unable to load provinces: {e}") from e


@router.get("/ph/cities", response_model=list[AdminAreaItem])
def ph_cities(
    parent_code: str = Query(..., min_length=2, max_length=32),
    kind: str = Query(default="province", pattern="^(province|district)$"),
    _: User = Depends(_CREW),
):
    try:
        rows = ph_admin_areas.list_cities(parent_code, kind=kind)
        return [AdminAreaItem(code=r["code"], name=r["name"]) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unable to load cities: {e}") from e


@router.get("/ph/barangays", response_model=list[AdminAreaItem])
def ph_barangays(
    city_code: str = Query(..., min_length=2, max_length=32),
    _: User = Depends(_CREW),
):
    try:
        return [AdminAreaItem(**r) for r in ph_admin_areas.list_barangays(city_code)]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unable to load barangays: {e}") from e
