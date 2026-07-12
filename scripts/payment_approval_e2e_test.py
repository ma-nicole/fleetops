#!/usr/bin/env python3
"""Payment approval workflow E2E (in-process TestClient)."""
from __future__ import annotations

import io
import sys
from datetime import date, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal, apply_runtime_schema_fixes  # noqa: E402
from app.main import app  # noqa: E402
from app.models.entities import Booking, BookingStatus, Payment, PaymentStatus  # noqa: E402

PASSED: list[str] = []
FAILED: list[str] = []


def ok(step: str, detail: str = "") -> None:
    PASSED.append(step)
    print(f"  PASS  {step}" + (f" — {detail}" if detail else ""))


def fail(step: str, detail: str) -> None:
    FAILED.append(f"{step}: {detail}")
    print(f"  FAIL  {step} — {detail}")


def login(client: TestClient, email: str, password: str = "password") -> str:
    r = client.post("/api/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def main() -> int:
    print("Payment approval E2E test\n")
    apply_runtime_schema_fixes()
    client = TestClient(app)
    db = SessionLocal()

    try:
        admin_h = {"Authorization": f"Bearer {login(client, 'admin@fleetops.com')}"}
        customer_h = {"Authorization": f"Bearer {login(client, 'customer1@fleetops.com')}"}

        # ── Admin list endpoints (same as Payment Approval page) ──
        r = client.get("/api/payments", headers=admin_h)
        if r.status_code != 200:
            fail("0 Admin list payments", f"status={r.status_code} body={r.text[:400]}")
        else:
            ok("0 Admin list payments", f"count={len(r.json())}")

        r = client.get("/api/bookings", headers=admin_h)
        if r.status_code != 200:
            fail("0 Admin list bookings", f"status={r.status_code} body={r.text[:400]}")
        else:
            ok("0 Admin list bookings", f"count={len(r.json())}")

        # Prefer a booking owned by customer1; otherwise create one for that customer.
        me = client.get("/api/auth/me", headers=customer_h)
        if me.status_code != 200:
            fail("1 Resolve customer", me.text)
            return 1
        customer_id = int(me.json()["id"])

        booking = (
            db.query(Booking)
            .filter(
                Booking.customer_id == customer_id,
                Booking.status.in_(
                    [
                        BookingStatus.PENDING_APPROVAL,
                        BookingStatus.PAYMENT_VERIFICATION,
                        BookingStatus.APPROVED,
                        BookingStatus.PENDING_PAYMENT,
                    ]
                ),
            )
            .order_by(Booking.id.desc())
            .first()
        )
        booking_id: int | None = booking.id if booking else None
        if booking_id is None:
            sched = (date.today() + timedelta(days=30)).isoformat()
            r = client.post(
                "/api/bookings",
                json={
                    "pickup_location": "TEST_BOOKING_ Manila City Hall, Manila",
                    "dropoff_location": "TEST_BOOKING_ Quezon City Hall, Quezon City",
                    "service_type": "fixed",
                    "scheduled_date": sched,
                    "scheduled_time_slot": "17:30",
                    "cargo_weight_tons": 5,
                    "cargo_description": "PAYMENT_E2E_TEST",
                    "cargo_type_category": "general",
                },
                headers=customer_h,
            )
            if r.status_code not in (200, 201):
                fail("1 Create booking", r.text)
                return 1
            booking_id = int(r.json()["id"])
            # TestClient commits in a different session — reopen DB handle.
            db.close()
            db = SessionLocal()
            booking = db.query(Booking).filter(Booking.id == booking_id).first()
            if booking is None:
                # Still proceed with API id for payment steps (auth uses customer token).
                ok("1 Create booking", f"#{booking_id} (API id; ORM not required)")
            else:
                ok("1 Create booking", f"#{booking.id}")
        else:
            ok("1 Use existing booking", f"#{booking.id} status={booking.status.value} customer={booking.customer_id}")

        assert booking_id is not None

        db.query(Payment).filter(
            Payment.booking_id == booking_id,
            Payment.status.in_([PaymentStatus.FOR_VERIFICATION, PaymentStatus.VERIFIED]),
        ).delete(synchronize_session=False)
        db.commit()

        # Minimal valid JPEG bytes
        jpeg = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            b"\xff\xd9"
        )
        r = client.post(
            "/api/payments/submit-proof",
            headers=customer_h,
            data={"booking_id": str(booking_id), "method": "manual"},
            files={"file": ("proof-e2e.jpg", io.BytesIO(jpeg), "image/jpeg")},
        )
        if r.status_code not in (200, 201):
            fail("2 Customer submit proof", r.text)
            return 1
        payment_id = r.json()["id"]
        ok("2 Customer submit proof", f"payment #{payment_id}")

        r = client.get("/api/payments", headers=admin_h)
        if r.status_code != 200:
            fail("3 Admin list after submit", r.text)
        else:
            match = next((p for p in r.json() if p["id"] == payment_id), None)
            if match and match.get("status") == "for_verification":
                ok("3 Admin sees pending payment", f"ref={match.get('reference')}")
            else:
                fail("3 Admin sees pending payment", str(match))

        r = client.get(f"/api/payments/{payment_id}/proof", headers=admin_h)
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"):
            ok("4 Admin view proof", f"{len(r.content)} bytes")
        else:
            fail("4 Admin view proof", f"status={r.status_code}")

        r = client.post(f"/api/payments/{payment_id}/verify", headers=admin_h, json={})
        if r.status_code == 200 and r.json().get("status") == "verified":
            ok("5 Admin approve payment")
        else:
            fail("5 Admin approve payment", r.text)

        r = client.post(f"/api/payments/{payment_id}/reject", headers=admin_h, json={})
        if r.status_code == 400:
            ok("6 Reject blocked after verify", "expected 400")
        else:
            fail("6 Reject blocked after verify", f"status={r.status_code}")

    finally:
        db.close()

    print(f"\n{'=' * 60}")
    print(f"Passed: {len(PASSED)}  Failed: {len(FAILED)}")
    for f in FAILED:
        print(f"  • {f}")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
