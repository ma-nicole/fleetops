#!/usr/bin/env python3
"""Auth login E2E — credentials, JWT, /me, and 401 detail bodies."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from jose import jwt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import settings  # noqa: E402
from app.core.security import verify_password  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models.entities import User  # noqa: E402
from sqlalchemy import func  # noqa: E402

PASSED: list[str] = []
FAILED: list[str] = []


def ok(step: str, detail: str = "") -> None:
    PASSED.append(step)
    print(f"  PASS  {step}" + (f" — {detail}" if detail else ""))


def fail(step: str, detail: str) -> None:
    FAILED.append(f"{step}: {detail}")
    print(f"  FAIL  {step} — {detail}")


def main() -> int:
    print("Auth login E2E test\n")
    client = TestClient(app)
    db = SessionLocal()

    try:
        admin = db.query(User).filter(func.lower(User.email) == "admin@fleetops.com").first()
        if not admin:
            fail("0 Admin user exists", "admin@fleetops.com not in database")
            return 1
        ok("0 Admin user exists", f"id={admin.id} role={admin.role}")

        if admin.locked_until:
            fail("1 Account active", f"locked_until={admin.locked_until}")
        else:
            ok("1 Account active")

        if not verify_password("password", admin.password_hash or ""):
            fail("2 Password hash", "password does not verify for admin@fleetops.com")
        else:
            ok("2 Password hash verifies")

        r = client.post("/api/auth/login", data={"username": "admin@fleetops.com", "password": "wrong"})
        if r.status_code != 401:
            fail("3 Wrong password 401", f"status={r.status_code}")
        else:
            body = r.json()
            detail = body.get("detail", "")
            if "Invalid credentials" not in str(detail):
                fail("3 Wrong password detail", detail)
            else:
                ok("3 Wrong password detail", str(detail)[:60])

        r = client.post("/api/auth/login", data={"username": "admin@fleetops.com", "password": "password"})
        if r.status_code != 200:
            fail("4 Admin login", f"status={r.status_code} body={r.text[:200]}")
            return 1
        token = r.json()["access_token"]
        ok("4 Admin login")

        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("sub") != admin.email and payload.get("sub", "").lower() != admin.email.lower():
            fail("5 JWT subject", f"sub={payload.get('sub')}")
        else:
            ok("5 JWT subject", str(payload.get("sub")))

        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        if r.status_code != 200:
            fail("6 GET /auth/me", f"status={r.status_code} body={r.text[:200]}")
        else:
            me = r.json()
            ok("6 GET /auth/me", f"role={me.get('role')}")

        r = client.get("/api/auth/me")
        if r.status_code != 401:
            fail("7 Unauthenticated /me", f"status={r.status_code}")
        else:
            detail = r.json().get("detail")
            ok("7 Unauthenticated /me", str(detail))

    finally:
        db.close()

    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    raise SystemExit(main())
