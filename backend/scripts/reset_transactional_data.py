#!/usr/bin/env python3
"""Full transactional workflow reset — removes all bookings/trips and related rows.

Keeps: users, trucks, toll matrix, pricing config, routes master, system settings.

Usage:
  python scripts/reset_transactional_data.py --dry-run
  python scripts/reset_transactional_data.py --apply
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
BLOCKED_ENVS = {"production", "prod", "staging"}

# Child tables first (FK-safe order). Table must exist in fleetopt schema.
DELETE_STEPS: list[tuple[str, str | None]] = [
    # Analytics / ML feedback tied to trips
    ("prediction_feedback", None),
    ("forecast_results", None),
    ("model_metrics", None),
    ("forecast_runs", None),
    # Trip execution children
    ("driver_trip_notifications", None),
    ("driver_ratings", None),
    ("trip_issues", None),
    ("fuel_logs", None),
    ("toll_logs", None),
    ("additional_toll_entries", None),
    ("completion_reports", None),
    ("trip_status_updates", None),
    ("trip_location_updates", None),
    ("operational_logs", None),
    ("general_operational_reports", None),
    ("vehicle_issue_reports", None),
    ("trip_shoulder_cost_entries", None),
    ("historical_toll_records", None),
    # Trips (parent of above)
    ("trips", None),
    # Booking workflow children
    ("truck_assignments", None),
    ("truck_slot_holds", None),
    ("route_options", None),
    ("job_orders", None),
    ("payments", None),
    ("feedback", None),
    ("transactions", None),
    # Bookings last
    ("bookings", None),
]

# Reset AUTO_INCREMENT after full wipe
AUTO_INCREMENT_TABLES = [name for name, _ in DELETE_STEPS]

MASTER_TABLES = [
    "users",
    "driver_profiles",
    "helper_profiles",
    "trucks",
    "routes",
    "toll_plazas",
    "toll_plaza_aliases",
    "toll_matrix",
    "pricing_configs",
    "booking_freight_settings",
    "truck_ban_rules",
    "customer_saved_sites",
    "maintenance_records",
    "attendance_records",
    "alembic_version",
]

INTEGRITY_CHECKS = [
    ("bookings_remaining", "SELECT COUNT(*) AS n FROM bookings"),
    ("trips_remaining", "SELECT COUNT(*) AS n FROM trips"),
    ("payments_remaining", "SELECT COUNT(*) AS n FROM payments"),
    ("truck_assignments_remaining", "SELECT COUNT(*) AS n FROM truck_assignments"),
    ("job_orders_remaining", "SELECT COUNT(*) AS n FROM job_orders"),
    ("route_options_remaining", "SELECT COUNT(*) AS n FROM route_options"),
    ("orphan_trips", "SELECT COUNT(*) AS n FROM trips t LEFT JOIN bookings b ON b.id = t.booking_id WHERE b.id IS NULL"),
    ("orphan_payments", "SELECT COUNT(*) AS n FROM payments p LEFT JOIN bookings b ON b.id = p.booking_id WHERE b.id IS NULL"),
    ("orphan_truck_assignments", "SELECT COUNT(*) AS n FROM truck_assignments ta LEFT JOIN bookings b ON b.id = ta.booking_id WHERE b.id IS NULL"),
    ("orphan_trip_status_updates", "SELECT COUNT(*) AS n FROM trip_status_updates u LEFT JOIN trips t ON t.id = u.trip_id WHERE t.id IS NULL"),
    ("orphan_driver_notifications", "SELECT COUNT(*) AS n FROM driver_trip_notifications n LEFT JOIN bookings b ON b.id = n.booking_id WHERE b.id IS NULL"),
    ("active_trips", "SELECT COUNT(*) AS n FROM trips WHERE status NOT IN ('completed', 'cancelled')"),
]


def assert_dev_environment() -> None:
    env = (settings.app_env or "development").strip().lower()
    if env in BLOCKED_ENVS:
        print(f"Refusing to run: APP_ENV={settings.app_env!r}")
        sys.exit(2)
    print(f"APP_ENV={settings.app_env!r} — reset permitted.")
    print(f"Database: {settings.database_url.split('@')[-1]}")


def _table_exists(conn, table: str) -> bool:
    row = conn.execute(
        text(
            "SELECT COUNT(*) AS n FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = :t"
        ),
        {"t": table},
    ).one()
    return int(row.n) > 0


def _count_table(conn, table: str) -> int:
    if not _table_exists(conn, table):
        return 0
    return int(conn.execute(text(f"SELECT COUNT(*) AS n FROM `{table}`")).one().n)


def snapshot_counts(conn) -> dict[str, int]:
    counts: dict[str, int] = {}
    for table, _ in DELETE_STEPS:
        counts[table] = _count_table(conn, table)
    for table in MASTER_TABLES:
        counts[f"master:{table}"] = _count_table(conn, table)
    return counts


def run_integrity(conn) -> dict[str, int]:
    results: dict[str, int] = {}
    for key, sql in INTEGRITY_CHECKS:
        try:
            if "trips" in sql and not _table_exists(conn, "trips"):
                results[key] = 0
                continue
            if "bookings" in sql and "LEFT JOIN bookings" in sql and not _table_exists(conn, "bookings"):
                results[key] = 0
                continue
            results[key] = int(conn.execute(text(sql)).one().n)
        except Exception:
            results[key] = -1
    return results


def apply_reset(conn) -> dict[str, int]:
    deleted: dict[str, int] = {}
    for table, _ in DELETE_STEPS:
        if not _table_exists(conn, table):
            deleted[table] = 0
            continue
        before = _count_table(conn, table)
        conn.execute(text(f"DELETE FROM `{table}`"))
        deleted[table] = before

    # Release crew/truck assignment flags from deleted workflow data
    if _table_exists(conn, "trucks"):
        conn.execute(text("UPDATE trucks SET availability_status = 'available' WHERE availability_status = 'assigned'"))
    if _table_exists(conn, "users"):
        conn.execute(
            text(
                "UPDATE users SET availability_status = 'available' "
                "WHERE availability_status = 'assigned' AND role IN ('driver', 'helper')"
            )
        )

    for table in AUTO_INCREMENT_TABLES:
        if _table_exists(conn, table):
            conn.execute(text(f"ALTER TABLE `{table}` AUTO_INCREMENT = 1"))

    return deleted


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset all booking/trip transactional data.")
    parser.add_argument("--dry-run", action="store_true", help="Report only (default).")
    parser.add_argument("--apply", action="store_true", help="Execute delete + reset sequences.")
    args = parser.parse_args()

    assert_dev_environment()
    engine = create_engine(settings.database_url)

    with engine.connect() as conn:
        before = snapshot_counts(conn)
        integrity_before = run_integrity(conn)

    total_booking_rows = before.get("bookings", 0)
    total_trip_rows = before.get("trips", 0)

    print(f"\nBookings to remove: {total_booking_rows}")
    print(f"Trips to remove: {total_trip_rows}")
    print("\nRow counts before reset:")
    for table, _ in DELETE_STEPS:
        print(f"  {table}: {before.get(table, 0)}")

    if not args.apply:
        print("\nDry run — no rows deleted. Re-run with --apply to reset.")
        return

    with engine.begin() as conn:
        deleted = apply_reset(conn)
        after = snapshot_counts(conn)
        integrity_after = run_integrity(conn)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_path = BACKUP_DIR / f"transactional_reset_report_{stamp}.json"

    master_remaining = {t: after.get(f"master:{t}", 0) for t in MASTER_TABLES}

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "database": settings.database_url.split("@")[-1],
        "app_env": settings.app_env,
        "tables_cleaned": [t for t, _ in DELETE_STEPS],
        "rows_deleted": deleted,
        "total_rows_deleted": sum(deleted.values()),
        "counts_before": {k: v for k, v in before.items() if not k.startswith("master:")},
        "counts_after": {k: v for k, v in after.items() if not k.startswith("master:")},
        "master_data_remaining": master_remaining,
        "integrity_before": integrity_before,
        "integrity_after": integrity_after,
        "caches_cleared": {
            "database_cache_tables": "none (no analytics_cache / dispatch_cache tables in schema)",
            "in_memory_geocoding_cache": "clear on backend restart (uvicorn reload)",
            "dashboard_statistics": "recomputed live from DB on next API request",
        },
        "notes": [
            "Users, trucks, toll matrix, pricing config, and routes master were preserved.",
            "AUTO_INCREMENT reset to 1 on all transactional tables.",
            "Truck and driver/helper availability_status reset from 'assigned' to 'available'.",
        ],
    }

    report_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

    print("\n=== TRANSACTIONAL RESET COMPLETE ===")
    print(f"Report: {report_path}")
    print(f"Total rows deleted: {report['total_rows_deleted']}")
    print("\nRows deleted by table:")
    for table, n in deleted.items():
        if n:
            print(f"  {table}: {n}")

    print("\nMaster data remaining:")
    for table, n in master_remaining.items():
        print(f"  {table}: {n}")

    print("\nIntegrity checks (after):")
    all_ok = True
    for key, val in integrity_after.items():
        ok = val == 0
        if not ok:
            all_ok = False
        status = "OK" if ok else "FAIL"
        print(f"  [{status}] {key}: {val}")

    if all_ok:
        print("\nAll integrity checks passed. Dashboards should show zero bookings/trips.")
    else:
        print("\nSome integrity checks failed — review report.")
        sys.exit(1)


if __name__ == "__main__":
    main()
