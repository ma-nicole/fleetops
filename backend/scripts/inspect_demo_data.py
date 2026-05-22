#!/usr/bin/env python3
"""List bookings, trucks, users for demo-data cleanup review."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text

from app.core.config import settings

PLACEHOLDER_PATTERNS = (
    "%Warehouse A%",
    "%Warehouse B%",
    "%Warehouse C%",
    "%City X%",
    "%City Y%",
    "%City Z%",
    "%Warehouse-Tarlac%",
    "%Customer-QC%",
    "%TRUCK-001%",
    "%TRK-001%",
)


def main() -> None:
    e = create_engine(settings.database_url)
    with e.connect() as c:
        print("=== BOOKINGS ===")
        for r in c.execute(
            text(
                "SELECT id, customer_id, pickup_location, dropoff_location, status "
                "FROM bookings ORDER BY id"
            )
        ):
            print(r)
        print("\n=== TRUCKS ===")
        for r in c.execute(text("SELECT id, code, model_name FROM trucks ORDER BY id")):
            print(r)
        print("\n=== USERS ===")
        for r in c.execute(
            text("SELECT id, email, full_name, role FROM users ORDER BY id")
        ):
            print(r)
        print("\n=== TRIPS ===")
        for r in c.execute(
            text("SELECT id, booking_id, truck_id, driver_id, status FROM trips ORDER BY id")
        ):
            print(r)


if __name__ == "__main__":
    main()
