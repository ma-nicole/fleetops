#!/usr/bin/env python3
"""Unit smoke checks for automatic fuel price parsing + unchanged quotation formula.

Does not require MySQL. Run: python scripts/cost_estimation_smoke_test.py
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.constants.customer_pricing import (
    CARGO_RATE_PHP_PER_TON,
    DRIVER_FREIGHT_SHARE_RATE,
    HELPER_FREIGHT_SHARE_RATE,
    TRUCK_FUEL_KMPL,
)
from app.services.fuel_price_service import (
    SEED_PATH,
    _parse_html_diesel_common,
    _parse_json_payload,
    fetch_fuel_price_from_url,
)
from app.services.route_estimate import customer_freight_pricing
from app.services.toll_matrix import _parse_waypoint_segments


def approx(a: float, b: float, tol: float = 0.02) -> bool:
    return abs(float(a) - float(b)) <= tol


def main() -> int:
    failures: list[str] = []

    # --- Fuel JSON / HTML parsing ---
    parsed = _parse_json_payload(
        {"diesel_php_per_liter": 128.8, "source": "unit-test", "as_of": "2026-04-01T00:00:00"}
    )
    if not parsed or parsed[0] != 128.8:
        failures.append(f"JSON diesel parse failed: {parsed}")
    else:
        print(f"PASS fuel JSON parse -> PHP {parsed[0]}/L source={parsed[1]}")
    html_price = _parse_html_diesel_common(
        "| Diesel | 110.00 | 144.90 | 128.80 |\nDiesel Common Price 128.80"
    )
    if html_price is None:
        failures.append("HTML diesel parse failed")
    else:
        print(f"PASS fuel HTML parse -> PHP {html_price}/L")

    if not SEED_PATH.is_file():
        failures.append(f"Missing seed file {SEED_PATH}")
    else:
        seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        seed_parsed = _parse_json_payload(seed)
        if not seed_parsed:
            failures.append("Bundled fuel seed unreadable")
        else:
            print(f"PASS bundled seed -> PHP {seed_parsed[0]}/L ({seed_parsed[1]})")

    bad = fetch_fuel_price_from_url("http://127.0.0.1:9/nope", timeout_sec=1.0)
    if bad is not None:
        failures.append("Expected None from unreachable fuel URL")
    else:
        print("PASS unreachable fuel URL returns None (cache fallback path)")

    # --- Formula preservation ---
    knobs = SimpleNamespace(diesel_price_php_per_liter=74.75, toll_fees_php_per_trip=0.0)
    km, tons = 40.0, 10.0
    pricing = customer_freight_pricing(km, tons, knobs, toll_budget_per_truck=146.0)
    expected_gross = tons * CARGO_RATE_PHP_PER_TON
    expected_liters = km / TRUCK_FUEL_KMPL
    expected_fuel = expected_liters * 74.75
    expected_driver = expected_gross * DRIVER_FREIGHT_SHARE_RATE
    expected_helper = expected_gross * HELPER_FREIGHT_SHARE_RATE
    expected_total = expected_gross + expected_fuel + expected_driver + expected_helper + 146.0

    checks = [
        ("cargo", pricing["cargo_gross_php"], expected_gross),
        ("fuel", pricing["diesel_cost_php"], expected_fuel),
        ("driver", pricing["driver_share_php"], expected_driver),
        ("helper", pricing["helper_share_php"], expected_helper),
        ("toll", pricing["toll_fees_php"], 146.0),
        ("total", pricing["quoted_total"], expected_total),
    ]
    for name, got, want in checks:
        if not approx(got, want):
            failures.append(f"Formula {name}: got {got} want {want}")
        else:
            print(f"PASS formula {name} -> {got}")

    segs = _parse_waypoint_segments(["Mindanao Ave.", "Tarlac", "San Miguel"])
    if segs != [("Mindanao Ave.", "Tarlac"), ("Tarlac", "San Miguel")]:
        failures.append(f"Waypoint segments unexpected: {segs}")
    else:
        print(f"PASS multi-segment waypoints -> {segs}")

    if failures:
        print("\nFAIL")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nPASS - fuel automation + quotation formula smoke checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
