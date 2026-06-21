#!/usr/bin/env python3
"""Verify customer analytics chart blocks used in recent UI fixes."""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient

from app.db import apply_runtime_schema_fixes
from app.main import app
from app.services.customer_role_analytics import (
    _booking_history_block,
    _booking_records_block,
    _truck_preference_records_block,
)

PASSED = 0
FAILED = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global PASSED, FAILED
    if ok:
        PASSED += 1
        print(f"  [OK] {name}" + (f" — {detail}" if detail else ""))
    else:
        FAILED += 1
        print(f"  [FAIL] {name}" + (f" — {detail}" if detail else ""))


def main() -> int:
    print("Customer chart verification\n")
    apply_runtime_schema_fixes()

    class Status:
        value = "approved"

    bookings = []
    for i in range(24):
        bookings.append(
            type(
                "B",
                (),
                {
                    "id": i + 1,
                    "cargo_weight_tons": [5, 12, 25][i % 3],
                    "service_type": "standard",
                    "cargo_type_category": "electronics",
                    "pickup_location": "A",
                    "dropoff_location": "B",
                    "created_at": datetime(2024, (i % 12) + 1, min(i + 1, 28)),
                    "status": Status(),
                },
            )()
        )

    truck_block = _truck_preference_records_block(bookings, {})
    records_block = _booking_records_block(bookings)
    history_block = _booking_history_block(bookings)

    truck_chart = truck_block.get("chart") or []
    records_chart = records_block.get("chart") or []
    history_chart = history_block.get("chart") or []

    check("truck_preference chart rows", len(truck_chart) >= 1, f"rows={len(truck_chart)}")
    if truck_chart:
        row0 = truck_chart[0]
        check("truck_preference truck_type key", "truck_type" in row0)
        check(
            "truck_preference sector keys",
            all(k in row0 for k in ("Cold Chain", "Express Delivery", "Standard Delivery", "Heavy Cargo")),
        )
        check("truck_preference total > 0", sum(int(r.get("total") or 0) for r in truck_chart) > 0)

    check("booking_records chart rows", len(records_chart) >= 1, f"rows={len(records_chart)}")
    if records_chart:
        row0 = records_chart[0]
        period = str(row0.get("period") or "")
        check("booking_records ISO period", len(period) == 7 and period[4] == "-", period)
        check(
            "booking_records status keys",
            all(k in row0 for k in ("Approved", "Cancelled", "Completed", "Pending")),
        )
        check("booking_records total > 0", sum(int(r.get("total") or 0) for r in records_chart) > 0)

    check("booking_history chart rows", len(history_chart) >= 1, f"rows={len(history_chart)}")
    if history_chart:
        check("booking_history multi-month", len(history_chart) >= 2, f"months={len(history_chart)}")
        check("booking_history count > 0", sum(int(r.get("count") or 0) for r in history_chart) > 0)

    client = TestClient(app)
    login = client.post("/api/auth/login", data={"username": "customer1@fleetops.com", "password": "password"})
    check("customer login", login.status_code == 200, f"status={login.status_code}")
    token = login.json()["access_token"]
    response = client.get("/api/customer/analytics", headers={"Authorization": f"Bearer {token}"})
    check("customer analytics API", response.status_code == 200, f"status={response.status_code}")

    root = response.json().get("customer_role_analytics") or {}
    for feature, pillar in (
        ("truck_preference_records", "service_selection"),
        ("booking_records", "booking_management"),
        ("booking_history", "booking_management"),
    ):
        block = root.get(pillar, {}).get("descriptive", {}).get(feature) or {}
        empty = bool(block.get("empty"))
        chart = block.get("chart") or []
        drilldown = block.get("drilldown") or []
        check(
            f"API {feature}",
            not empty and (len(chart) > 0 or len(drilldown) > 0),
            f"chart={len(chart)} drilldown={len(drilldown)}",
        )
        if feature == "truck_preference_records" and chart:
            check(f"API {feature} truck_type", any("truck_type" in row for row in chart))
        if feature == "booking_records" and chart:
            check(f"API {feature} Approved key", any("Approved" in row for row in chart))
        if feature == "booking_history" and chart:
            check(f"API {feature} count key", any("count" in row for row in chart))

    print(f"\n{PASSED} passed, {FAILED} failed")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
