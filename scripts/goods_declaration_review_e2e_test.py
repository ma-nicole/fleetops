#!/usr/bin/env python3
"""Goods declaration review E2E — revision locking and resubmit cycle."""
from __future__ import annotations

import io
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal, apply_runtime_schema_fixes  # noqa: E402
from app.main import app  # noqa: E402
from app.models.entities import Booking, User  # noqa: E402

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

        customer = db.query(User).filter(User.id == booking.customer_id).first()
        if not customer:
            fail("0 Customer", f"missing for booking {booking.id}")
            return 1

        dispatcher_h = {"Authorization": f"Bearer {login(client, 'dispatcher@fleetops.com')}"}
        r = client.get("/api/admin/goods-declarations", headers=dispatcher_h)
        if r.status_code != 403:
            fail("1 Dispatcher denied", f"status={r.status_code}")
        else:
            ok("1 Dispatcher denied")

        manager_h = {"Authorization": f"Bearer {login(client, 'manager@fleetops.com')}"}
        customer_h = {"Authorization": f"Bearer {login(client, customer.email)}"}

        r = client.get("/api/admin/goods-declarations", headers=manager_h)
        if r.status_code != 200:
            fail("2 Manager list", f"status={r.status_code} {r.text[:200]}")
            return 1
        ok("2 Manager list", f"count={len(r.json())}")

        bid = booking.id

        # Reset to pending for a clean cycle
        r = client.patch(
            f"/api/admin/goods-declarations/{bid}",
            headers=manager_h,
            json={"status": "approved", "remarks": None},
        )
        if r.status_code != 200:
            # May fail if already locked from prior run — force pending in DB
            booking.goods_declaration_review_status = "pending"
            booking.goods_declaration_review_remarks = None
            booking.goods_declaration_validated = False
            db.commit()
            db.refresh(booking)
        else:
            ok("2b Reset to approved", "for cycle setup")

        booking.goods_declaration_review_status = "pending"
        booking.goods_declaration_review_remarks = None
        booking.goods_declaration_validated = False
        db.commit()

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
            json={"status": "rejected", "remarks": "Should be blocked"},
        )
        if r.status_code == 200:
            fail("5 Reject while locked", "expected 400")
        else:
            ok("5 Reject while locked", f"status={r.status_code}")

        r = client.patch(
            f"/api/admin/goods-declarations/{bid}",
            headers=manager_h,
            json={"status": "approved", "remarks": None},
        )
        if r.status_code == 200:
            fail("6 Approve while locked", "expected 400")
        else:
            ok("6 Approve while locked", f"status={r.status_code}")

        pdf_bytes = b"%PDF-1.4 e2e resubmit\n"
        r = client.post(
            f"/api/bookings/{bid}/documents/resubmit",
            headers=customer_h,
            files={"cargo_declaration": ("revised-decl.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )
        if r.status_code != 200:
            fail("7 Customer resubmit", f"status={r.status_code} {r.text[:300]}")
        else:
            body = r.json()
            if body.get("goods_declaration_review_status") != "resubmitted":
                fail("7 Customer resubmit", f"status={body.get('goods_declaration_review_status')}")
            else:
                ok("7 Customer resubmit", "revision_requested -> resubmitted")

        r = client.patch(
            f"/api/admin/goods-declarations/{bid}",
            headers=manager_h,
            json={"status": "approved", "remarks": None},
        )
        if r.status_code != 200:
            fail("8 Approve after resubmit", f"status={r.status_code} {r.text[:200]}")
        else:
            body = r.json()
            if body.get("goods_declaration_review_status") != "approved":
                fail("8 Approve after resubmit", f"status={body.get('goods_declaration_review_status')}")
            else:
                ok("8 Approve after resubmit")

        r = client.patch(
            f"/api/admin/goods-declarations/{bid}",
            headers=manager_h,
            json={"status": "rejected", "remarks": "Should be blocked final"},
        )
        if r.status_code == 200:
            fail("9 Reject after approved", "expected 400")
        else:
            ok("9 Reject after approved (final)", f"status={r.status_code}")

    finally:
        db.close()

    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    raise SystemExit(main())
