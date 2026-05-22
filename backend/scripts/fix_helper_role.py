#!/usr/bin/env python3
"""Add HELPER to users.role ENUM and repair helper staff rows."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import apply_runtime_schema_fixes


def main() -> None:
    apply_runtime_schema_fixes()
    from sqlalchemy import text
    from app.db import SessionLocal
    from app.models.entities import User, UserRole

    db = SessionLocal()
    try:
        rows = db.execute(
            text("SELECT id, email, role FROM users WHERE LOWER(email) LIKE '%helper%'")
        ).fetchall()
        print("Helper rows:", rows)
        u = db.query(User).filter(User.email == "helper@fleetops.com").first()
        if u:
            print("ORM role:", u.role, getattr(u.role, "value", None))
            assert u.role == UserRole.HELPER, u.role
            print("OK: helper@fleetops.com is UserRole.HELPER")
    finally:
        db.close()


if __name__ == "__main__":
    main()
