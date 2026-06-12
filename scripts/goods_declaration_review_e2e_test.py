#!/usr/bin/env python3
"""Goods declaration review E2E (manager/admin compliance)."""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal, apply_runtime_schema_fixes  # noqa: E402
from app.main import app  # noqa: E402
from app.models.entities import Booking  # noqa: E402

PASSED: list[str] = []
FAILED: list[str] = []


def ok(step: str, detail: str = "") -> None:
    PASSED.append(step)
    print(f"  PASS  {step}" + (f" — {detail}" if detail else ""))


def fail(step: str, detail: str) -> None:
    FAILED.append(f"{step}: {detail}")
    print(f"  FAIL  {step} — {detail}")


def login(client: TestClient, email: str) -> str:
    r = client.post("/api/auth/login", data={"username": email, "password": "password"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def main() -> int:
    print("Goods declaration review E2E test\n")
    apply_runtime_schema_fixes()
    client = TestClient(app)
    db = SessionLocal()

    try:
        booking = (
            db.query(Booking)
            .filter(Booking.cargo_declaration_storage_path.isnot(None))
            .order_by(Booking.id.desc())
            .first()
        )
        if not booking:
            booking = (
                db.query(Booking)
                .filter(Booking.cargo_declaration_original_filename.isnot(None))
                .order_by(Booking.id.desc())
                .first()
            )
        if not booking:
            fail("0 Booking with declaration", "none in database")
            return 1
        ok("0 Booking with declaration", f"id={booking.id}")

        dispatcher_h = {"Authorization": f"Bearer {login(client, 'dispatcher@fleetops.com')}"}
        r = client.get("/api/admin/goods-declarations", headers=dispatcher_h)
        if r.status_code != 403:
            fail("1 Dispatcher denied", f"status={r.status_code}")
        else:
            ok("1 Dispatcher denied")

        manager_h = {"Authorization": f"Bearer {login(client, 'manager@fleetops.com')}"}
        r = client.get("/api/admin/goods-declarations", headers=manager_h)
        if r.status_code != 200:
            fail("2 Manager list", f"status={r.status_code} {r.text[:200]}")
            return 1
        ok("2 Manager list", f"count={len(r.json())}")

        bid = booking.id
        r = client.patch(
            f"/api/admin/goods-declarations/{bid}",
            headers=manager_h,
            json={"status": "revision_requested", "remarks": ""},
        )
        if r.status_code != 400:
            fail("3 Revision without remarks rejected", f"status={r.status_code}")
        else:
            ok("3 Revision without remarks rejected")

        r = client.patch(
            f"/api/admin/goods-declarations/{bid}",
            headers=manager_h,
            json={"status": "revision_requested", "remarks": "E2E revision test"},
        )
        if r.status_code != 200:
            fail("4 Request revision", f"status={r.status_code} {r.text[:200]}")
        else:
            body = r.json()
            if body.get("goods_declaration_review_status") != "revision_requested":
                fail("4 Request revision", f"status={body.get('goods_declaration_review_status')}")
            else:
                ok("4 Request revision")

        r = client.patch(
            f"/api/admin/goods-declarations/{bid}",
            headers=manager_h,
            json={"status": "rejected", "remarks": "E2E reject test"},
        )
        if r.status_code != 200:
            fail("5 Reject", f"status={r.status_code} {r.text[:200]}")
        else:
            body = r.json()
            if body.get("goods_declaration_review_status") != "rejected":
                fail("5 Reject", f"status={body.get('goods_declaration_review_status')}")
            else:
                ok("5 Reject", body.get("goods_declaration_review_remarks", ""))

        r = client.patch(
            f"/api/admin/goods-declarations/{bid}",
            headers=manager_h,
            json={"status": "approved", "remarks": None},
        )
        if r.status_code != 200:
            fail("6 Approve reset", f"status={r.status_code}")
        else:
            ok("6 Approve reset")

    finally:
        db.close()

    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    raise SystemExit(main())
