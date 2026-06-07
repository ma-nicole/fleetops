#!/usr/bin/env python3
"""Remove E2E / test-marked bookings from the development database only.

Matches bookings where pickup, dropoff, or cargo description contains:
  E2E_TEST_   TEST_BOOKING_

Safety:
  - Refuses to run when APP_ENV is production (or staging).
  - Dry-run by default; pass --apply to delete.

Usage:
  cd backend
  python ../scripts/cleanup_e2e_test_data.py --dry-run
  python ../scripts/cleanup_e2e_test_data.py --apply
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import create_engine, text

from app.core.config import settings

BACKUP_DIR = ROOT / "backend" / "backups"
BLOCKED_ENVS = {"production", "prod", "staging"}

E2E_BOOKING_WHERE = """
(
    pickup_location LIKE 'E2E_TEST_%'
    OR dropoff_location LIKE 'E2E_TEST_%'
    OR pickup_location LIKE 'TEST_BOOKING_%'
    OR dropoff_location LIKE 'TEST_BOOKING_%'
    OR cargo_description LIKE '%E2E_TEST_%'
    OR cargo_description LIKE '%TEST_BOOKING_%'
)
"""


def assert_dev_environment() -> None:
    env = (settings.app_env or "development").strip().lower()
    if env in BLOCKED_ENVS:
        print(f"Refusing to run: APP_ENV={settings.app_env!r} is not allowed for test cleanup.")
        sys.exit(2)
    print(f"APP_ENV={settings.app_env!r} — cleanup permitted.")


def _fetch(conn, sql: str) -> list[dict]:
    return [dict(r._mapping) for r in conn.execute(text(sql))]


def _ids(rows: list[dict], key: str = "id") -> list[int]:
    return [int(r[key]) for r in rows]


def build_plan(conn) -> dict:
    booking_ids = _ids(_fetch(conn, f"SELECT id FROM bookings WHERE {E2E_BOOKING_WHERE}"))
    trip_ids: list[int] = []
    if booking_ids:
        bph = ", ".join(str(i) for i in booking_ids)
        trip_ids = _ids(_fetch(conn, f"SELECT id FROM trips WHERE booking_id IN ({bph})"))

    bookings = (
        _fetch(conn, f"SELECT id, pickup_location, dropoff_location, status FROM bookings WHERE id IN ({', '.join(str(i) for i in booking_ids)})")
        if booking_ids
        else []
    )
    trips = (
        _fetch(conn, f"SELECT id, booking_id, status FROM trips WHERE id IN ({', '.join(str(i) for i in trip_ids)})")
        if trip_ids
        else []
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "booking_ids": booking_ids,
        "trip_ids": trip_ids,
        "bookings": bookings,
        "trips": trips,
    }


def apply_plan(conn, plan: dict) -> None:
    booking_ids = plan["booking_ids"]
    trip_ids = plan["trip_ids"]
    if not booking_ids:
        return

    if trip_ids:
        tph = ", ".join(str(i) for i in trip_ids)
        for table in (
            "additional_toll_entries",
            "historical_toll_records",
            "prediction_feedback",
            "fuel_logs",
            "toll_logs",
            "completion_reports",
            "trip_status_updates",
            "trip_location_updates",
            "operational_logs",
            "general_operational_reports",
            "vehicle_issue_reports",
            "trip_issues",
            "driver_ratings",
        ):
            try:
                conn.execute(text(f"DELETE FROM {table} WHERE trip_id IN ({tph})"))
            except Exception:
                pass

    bph = ", ".join(str(i) for i in booking_ids)
    conn.execute(text(f"DELETE FROM truck_assignments WHERE booking_id IN ({bph})"))
    conn.execute(text(f"DELETE FROM truck_slot_holds WHERE booking_id IN ({bph})"))
    conn.execute(text(f"DELETE FROM payments WHERE booking_id IN ({bph})"))
    conn.execute(text(f"DELETE FROM transactions WHERE booking_id IN ({bph})"))
    conn.execute(text(f"DELETE FROM feedback WHERE booking_id IN ({bph})"))
    conn.execute(text(f"DELETE FROM job_orders WHERE booking_id IN ({bph})"))
    conn.execute(text(f"DELETE FROM route_options WHERE booking_id IN ({bph})"))

    if trip_ids:
        tph = ", ".join(str(i) for i in trip_ids)
        conn.execute(text(f"DELETE FROM trips WHERE id IN ({tph})"))

    conn.execute(text(f"DELETE FROM bookings WHERE id IN ({bph})"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove E2E test-marked bookings (development only).")
    parser.add_argument("--dry-run", action="store_true", help="List matches only (default).")
    parser.add_argument("--apply", action="store_true", help="Delete matched rows after backup.")
    args = parser.parse_args()

    assert_dev_environment()

    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        plan = build_plan(conn)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"e2e_test_cleanup_backup_{stamp}.json"
    backup_path.write_text(json.dumps(plan, indent=2, default=str), encoding="utf-8")

    print(f"Backup written: {backup_path}")
    print(f"Test bookings matched: {plan['booking_ids']}")
    print(f"Trips to remove: {plan['trip_ids']}")

    if not plan["booking_ids"]:
        print("\nNo E2E test bookings found.")
        return

    if not args.apply:
        print("\nDry run — no rows deleted. Re-run with --apply to delete.")
        return

    with engine.begin() as conn:
        apply_plan(conn, plan)

    print(f"\nRemoved {len(plan['booking_ids'])} test booking(s) and related trips.")


if __name__ == "__main__":
    main()
