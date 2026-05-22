#!/usr/bin/env python3
"""Back up and remove demo/placeholder bookings, trips, and trucks from MySQL.

Safe cleanup only — does NOT drop tables or delete admin/manager/dispatcher accounts.

Usage:
  python scripts/cleanup_demo_data.py --dry-run
  python scripts/cleanup_demo_data.py --apply
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text

from app.core.config import settings

BACKUP_DIR = Path(__file__).resolve().parents[1] / "backups"

from app.services.demo_booking_filter import demo_booking_sql_where

DEMO_BOOKING_SQL = f"SELECT id FROM bookings WHERE {demo_booking_sql_where()}"

DEMO_TRUCK_SQL = """
SELECT id FROM trucks
WHERE code LIKE 'TRUCK-%%' OR code LIKE 'TRK-%%'
"""


def _fetch(conn, sql: str, **params):
    return [dict(r._mapping) for r in conn.execute(text(sql), params)]


def _ids(rows: list[dict], key: str = "id") -> list[int]:
    return [int(r[key]) for r in rows]


def build_plan(conn) -> dict:
    booking_ids = _ids(_fetch(conn, DEMO_BOOKING_SQL))
    trip_ids: list[int] = []
    if booking_ids:
        bph = ", ".join(str(i) for i in booking_ids)
        trip_ids = _ids(_fetch(conn, f"SELECT id FROM trips WHERE booking_id IN ({bph})"))

    truck_ids = _ids(_fetch(conn, DEMO_TRUCK_SQL))
    if trip_ids:
        bph = ", ".join(str(i) for i in booking_ids)
        other_trips = _fetch(conn, f"SELECT id, truck_id FROM trips WHERE booking_id NOT IN ({bph})")
        trucks_still_used = {int(r["truck_id"]) for r in other_trips if r.get("truck_id")}
        truck_ids = [tid for tid in truck_ids if tid not in trucks_still_used]

    bookings = (
        _fetch(conn, f"SELECT * FROM bookings WHERE id IN ({', '.join(str(i) for i in booking_ids)})")
        if booking_ids
        else []
    )
    trips = (
        _fetch(conn, f"SELECT * FROM trips WHERE id IN ({', '.join(str(i) for i in trip_ids)})")
        if trip_ids
        else []
    )
    trucks = (
        _fetch(conn, f"SELECT * FROM trucks WHERE id IN ({', '.join(str(i) for i in truck_ids)})")
        if truck_ids
        else []
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "booking_ids": booking_ids,
        "trip_ids": trip_ids,
        "truck_ids": truck_ids,
        "bookings": bookings,
        "trips": trips,
        "trucks": trucks,
    }


def apply_plan(conn, plan: dict) -> None:
    booking_ids = plan["booking_ids"]
    trip_ids = plan["trip_ids"]
    truck_ids = plan["truck_ids"]

    if trip_ids:
        ph = ", ".join(str(i) for i in trip_ids)
        for table in (
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
            conn.execute(text(f"DELETE FROM {table} WHERE trip_id IN ({ph})"))

    if booking_ids:
        bph = ", ".join(str(i) for i in booking_ids)
        conn.execute(text(f"DELETE FROM truck_assignments WHERE booking_id IN ({bph})"))
        conn.execute(text(f"DELETE FROM truck_slot_holds WHERE booking_id IN ({bph})"))
        conn.execute(text(f"DELETE FROM payments WHERE booking_id IN ({bph})"))
        conn.execute(text(f"DELETE FROM transactions WHERE booking_id IN ({bph})"))
        conn.execute(text(f"DELETE FROM feedback WHERE booking_id IN ({bph})"))
        conn.execute(text(f"DELETE FROM job_orders WHERE booking_id IN ({bph})"))
        conn.execute(text(f"DELETE FROM route_options WHERE booking_id IN ({bph})"))

    if trip_ids:
        ph = ", ".join(str(i) for i in trip_ids)
        conn.execute(text(f"DELETE FROM trips WHERE id IN ({ph})"))

    if booking_ids:
        bph = ", ".join(str(i) for i in booking_ids)
        conn.execute(text(f"DELETE FROM bookings WHERE id IN ({bph})"))

    if truck_ids:
        tph = ", ".join(str(i) for i in truck_ids)
        conn.execute(text(f"DELETE FROM maintenance_records WHERE truck_id IN ({tph})"))
        conn.execute(text(f"DELETE FROM trucks WHERE id IN ({tph})"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove demo placeholder fleet data.")
    parser.add_argument("--dry-run", action="store_true", help="List records only (default).")
    parser.add_argument("--apply", action="store_true", help="Delete after writing backup.")
    args = parser.parse_args()

    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        plan = build_plan(conn)

    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"demo_cleanup_backup_{stamp}.json"

    serializable = {
        "generated_at": plan["generated_at"],
        "booking_ids": plan["booking_ids"],
        "trip_ids": plan["trip_ids"],
        "truck_ids": plan["truck_ids"],
        "bookings": plan["bookings"],
        "trips": plan["trips"],
        "trucks": plan["trucks"],
    }
    backup_path.write_text(json.dumps(serializable, indent=2, default=str), encoding="utf-8")

    print(f"Backup written: {backup_path}")
    print(f"Bookings to remove: {plan['booking_ids']}")
    print(f"Trips to remove: {plan['trip_ids']}")
    print(f"Trucks to remove: {plan['truck_ids']}")

    if not args.apply:
        print("\nDry run — no rows deleted. Re-run with --apply to delete.")
        return

    with engine.begin() as conn:
        apply_plan(conn, plan)

    print("\nDemo placeholder records removed.")


if __name__ == "__main__":
    main()
