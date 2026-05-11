#!/usr/bin/env python3
"""Truncate every table except ``users`` (MySQL / MariaDB).

Run from repo root or backend:

    cd backend
    python scripts/reset_database_keep_users.py

Requires DATABASE_URL / settings pointing at your local DB.
After reset you must re-seed trucks, sites, etc., or use admin flows — only login accounts remain.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add backend root for `app` imports
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import inspect, text  # noqa: E402

from app.db import engine  # noqa: E402
from app.models import entities  # noqa: F401, E402 — register ORM tables on Base
from app.models.base import Base  # noqa: E402


def _dialect_table_names() -> list[str]:
    insp = inspect(engine)
    return list(insp.get_table_names())


def main() -> None:
    dialect = engine.dialect.name
    if dialect not in ("mysql", "mariadb"):
        print(f"This script targets MySQL/MariaDB; got dialect {dialect!r}. Aborting.")
        sys.exit(1)

    existing = set(_dialect_table_names())
    ordered = [t.name for t in Base.metadata.sorted_tables if t.name in existing]
    # Tables in DB not in ORM (e.g. old erd_*) — skip unless user drops manually
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        for name in reversed(ordered):
            if name == "users":
                continue
            conn.execute(text(f"TRUNCATE TABLE `{name}`"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    print(f"Truncated {len(ordered) - 1} tables (kept `users`).")
    print("Re-create fleet data (trucks, customer sites, pricing) via your admin tools or seeds as needed.")


if __name__ == "__main__":
    main()
