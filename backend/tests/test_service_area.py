"""Menruz Northern Luzon service area filters."""

from __future__ import annotations

from app.services.ph_admin_areas import list_regions
from app.services.service_area import (
    is_northern_luzon_region_code,
    is_within_northern_luzon,
)


def test_northern_luzon_region_codes():
    assert is_northern_luzon_region_code("010000000")
    assert is_northern_luzon_region_code("020000000")
    assert is_northern_luzon_region_code("140000000")
    assert not is_northern_luzon_region_code("130000000")  # NCR
    assert not is_northern_luzon_region_code("060000000")  # Western Visayas
    assert not is_northern_luzon_region_code("170000000")  # MIMAROPA


def test_northern_luzon_bbox():
    assert is_within_northern_luzon(16.4, 120.6)  # Baguio
    assert is_within_northern_luzon(18.2, 120.7)  # Laoag-ish
    assert not is_within_northern_luzon(14.6, 121.0)  # Metro Manila
    assert not is_within_northern_luzon(10.3, 123.9)  # Cebu


def test_list_regions_filters_to_northern_luzon(monkeypatch):
    monkeypatch.setattr(
        "app.services.ph_admin_areas._get_json",
        lambda _path: [
            {"code": "010000000", "name": "Ilocos Region", "regionName": "Region I"},
            {"code": "130000000", "name": "NCR", "regionName": "National Capital Region"},
            {"code": "060000000", "name": "Western Visayas", "regionName": "Region VI"},
            {"code": "140000000", "name": "CAR", "regionName": "Cordillera Administrative Region"},
            {"code": "020000000", "name": "Cagayan Valley", "regionName": "Region II"},
        ],
    )
    rows = list_regions()
    codes = {r["code"] for r in rows}
    assert codes == {"010000000", "020000000", "140000000"}
