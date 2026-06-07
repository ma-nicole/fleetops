#!/usr/bin/env python3
"""Full toll matrix + booking workflow E2E test (in-process TestClient)."""
from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal, apply_runtime_schema_fixes  # noqa: E402
from app.main import app  # noqa: E402
from app.models.entities import (  # noqa: E402
    Booking,
    BookingStatus,
    HistoricalTollRecord,
    TollMatrix,
    TollPlaza,
    TollPlazaAlias,
    Trip,
    TripStatus,
    Truck,
    User,
    UserRole,
)
from app.services.analytics_stats import compute_statistics  # noqa: E402
from app.services.toll_analytics import build_toll_analytics  # noqa: E402
from app.services.booking_schedule import driver_free_for_booking, truck_free_for_booking  # noqa: E402
from app.services.scheduler import find_available_driver, find_available_truck  # noqa: E402

PASSED: list[str] = []
FAILED: list[str] = []
FIXED: list[str] = []


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


def reload_session(db: Session) -> Session:
    """Avoid stale ORM state after TestClient commits in a separate session."""
    db.close()
    return SessionLocal()


def pick_crew_for_booking(db: Session, booking: Booking) -> tuple[Truck | None, User | None]:
    """Pick truck/driver free for this booking window (ignores stale availability flags)."""
    truck = find_available_truck(db, booking.scheduled_date, booking)
    driver = find_available_driver(db, booking.scheduled_date, booking)
    if not truck:
        for candidate in db.query(Truck).order_by(Truck.id).all():
            if truck_free_for_booking(db, candidate.id, booking):
                truck = candidate
                break
    if not driver:
        for candidate in db.query(User).filter(User.role == UserRole.DRIVER).order_by(User.id).all():
            if driver_free_for_booking(db, candidate.id, booking):
                driver = candidate
                break
    return truck, driver


def main() -> int:
    print("Toll full E2E workflow test\n")
    apply_runtime_schema_fixes()
    client = TestClient(app)
    db = SessionLocal()

    try:
        admin_h = {"Authorization": f"Bearer {login(client, 'admin@fleetops.com')}"}
        customer_h = {"Authorization": f"Bearer {login(client, 'customer1@fleetops.com')}"}
        driver_h = {"Authorization": f"Bearer {login(client, 'driver1@fleetops.com')}"}
        dispatcher_h = {"Authorization": f"Bearer {login(client, 'dispatcher@fleetops.com')}"}

        # ── Step 1: Admin toll matrix + plaza aliases ──
        db.query(TollPlazaAlias).delete()
        db.query(TollPlaza).delete()
        db.commit()

        r = client.post(
            "/api/admin/toll-plazas",
            json={
                "canonical_name": "San Fernando",
                "status": "active",
                "aliases": ["San Fernando Pampanga", "San Fernando Exit"],
            },
            headers=admin_h,
        )
        if r.status_code not in (200, 201):
            fail("1a Plaza create", r.text)
        else:
            ok("1a Plaza create", r.json()["canonical_name"])

        r = client.post(
            "/api/admin/toll-plazas",
            json={"canonical_name": "San Simon", "status": "active", "aliases": ["San Simon Exit"]},
            headers=admin_h,
        )
        if r.status_code not in (200, 201):
            fail("1b Plaza create San Simon", r.text)
        else:
            ok("1b Plaza create San Simon")

        sample_path = ROOT / "backend" / "app" / "data" / "nlex_sctex_class3_sample.json"
        samples = json.loads(sample_path.read_text(encoding="utf-8"))
        imported = 0
        for row in samples:
            payload = {**row, "status": "active"}
            r = client.post("/api/admin/toll-matrix", json=payload, headers=admin_h)
            if r.status_code in (200, 201):
                imported += 1
            elif r.status_code == 409:
                imported += 1
            else:
                fail("1c Matrix import", f"{row['entry_point']}->{row['exit_point']}: {r.text}")
                break
        else:
            ok("1c NLEX Class 3 matrix rows", f"{imported}/{len(samples)}")

        r = client.get("/api/admin/toll-matrix", headers=admin_h)
        if r.status_code != 200:
            fail("1d List matrix", r.text)
        else:
            row = next(
                (
                    x
                    for x in r.json()
                    if x["entry_point"] == "San Fernando" and x["exit_point"] == "San Simon"
                ),
                None,
            )
            if row and row["toll_fee"] == 146 and row["vehicle_class"] == "Class 3":
                ok("1d Matrix row persisted", f"fee={row['toll_fee']}, effective={row['effective_date'][:10]}")
            else:
                fail("1d Matrix row persisted", str(row))

        E2E_MARKER = "E2E_TEST_ automated toll workflow"
        QUOTE_PICKUP = "Warehouse San Fernando Pampanga"
        QUOTE_DROPOFF = "San Simon Exit Luzon"

        # ── Step 2: Customer booking quote + create ──
        r = client.post(
            "/api/customer/route-quote",
            json={
                "pickup_location": QUOTE_PICKUP,
                "dropoff_location": QUOTE_DROPOFF,
                "weight_tons": 10,
            },
            headers=customer_h,
        )
        if r.status_code != 200:
            fail("2a Route quote auto-match", r.text)
        else:
            q = r.json()
            if q.get("toll_matrix_matched") and q.get("toll_fees_php") == 146:
                ok("2a Route quote auto-match", f"toll={q['toll_fees_php']}, entry={q.get('toll_entry_point')}")
            else:
                fail("2a Route quote auto-match", str({k: q.get(k) for k in ("toll_matrix_matched", "toll_fees_php", "toll_estimate_message")}))

        sched = None
        slot_used = None
        for day_offset in range(21, 120, 7):
            candidate_date = (date.today() + timedelta(days=day_offset)).isoformat()
            avail = client.get(
                "/api/bookings/schedule-availability",
                params={"scheduled_date": candidate_date, "cargo_weight_tons": 10},
                headers=customer_h,
            )
            if avail.status_code != 200:
                continue
            for slot in ("08:00", "11:30", "14:00", "17:30"):
                if avail.json().get("slots", {}).get(slot):
                    sched = candidate_date
                    slot_used = slot
                    break
            if sched:
                break
        if not sched:
            fail("2b Create booking", "No open schedule slot found in the next ~4 months")
            booking_id = None
        else:
            r = client.post(
                "/api/bookings",
                json={
                    "pickup_location": QUOTE_PICKUP,
                    "dropoff_location": QUOTE_DROPOFF,
                    "service_type": "fixed",
                    "scheduled_date": sched,
                    "scheduled_time_slot": slot_used,
                    "cargo_weight_tons": 10,
                    "cargo_description": E2E_MARKER,
                },
                headers=customer_h,
            )
            booking_id = None
            if r.status_code not in (200, 201):
                fail("2b Create booking", r.text)
            else:
                booking_id = r.json()["id"]
                b = r.json()
                toll_budget = b.get("estimated_toll_budget_php")
                matched = b.get("toll_matrix_matched")
                if matched and toll_budget == 146:
                    ok("2b Create booking with toll", f"booking #{booking_id}, toll budget={toll_budget}")
                else:
                    fail("2b Create booking with toll", f"matched={matched}, budget={toll_budget}, keys={list(b.keys())}")

        # Manual toll fallback
        r = client.post(
            "/api/customer/route-quote",
            json={
                "pickup_location": "Unknown Origin XYZ",
                "dropoff_location": "Unknown Destination ABC",
                "weight_tons": 5,
                "toll_entry_point": "San Fernando",
                "toll_exit_point": "San Simon",
            },
            headers=customer_h,
        )
        if r.status_code == 200 and r.json().get("toll_matrix_matched") and r.json().get("toll_fees_php") == 146:
            q = r.json()
            if q.get("distance_confirmed") is False and q.get("distance_warning"):
                ok("2c Manual toll selection quote", f"toll={q['toll_fees_php']}, distance pending")
            else:
                fail("2c Manual toll selection quote", f"expected unverified distance, got {q.get('distance_confirmed')}")
        else:
            fail("2c Manual toll selection quote", r.text[:300] if r.status_code != 200 else str(r.json()))

        r = client.post(
            "/api/customer/route-quote",
            json={
                "pickup_location": "Unknown Origin XYZ",
                "dropoff_location": "Unknown Destination ABC",
                "weight_tons": 5,
                "toll_entry_point": "San Fernando",
                "toll_exit_point": "San Simon",
                "distance_km_override": 95,
            },
            headers=customer_h,
        )
        if r.status_code == 200 and r.json().get("distance_confirmed") and r.json().get("distance_km") == 95:
            ok("2d Manual distance override", f"km={r.json()['distance_km']}")
        else:
            fail("2d Manual distance override", r.text[:300] if r.status_code != 200 else str(r.json()))

        if not booking_id:
            print("\nAborting — booking not created.")
            return 1

        # ── Step 3: Admin review ──
        r = client.get(f"/api/bookings/{booking_id}", headers=admin_h)
        if r.status_code != 200:
            fail("3 Admin booking details", r.text)
        else:
            b = r.json()
            if b.get("estimated_toll_budget_php") == 146 and b.get("toll_entry_point"):
                ok("3 Admin sees estimated toll", f"entry={b.get('toll_entry_point')}, exit={b.get('toll_exit_point')}")
            else:
                fail("3 Admin sees estimated toll", f"budget={b.get('estimated_toll_budget_php')}, keys={[k for k in b if 'toll' in k]}")

        # Prepare for dispatch (simulate payment verified — not testing payment flow)
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        booking.status = BookingStatus.PAYMENT_VERIFIED
        db.commit()

        # ── Step 4: Dispatcher assignment ──
        db.refresh(booking)
        truck, driver = pick_crew_for_booking(db, booking)
        if not truck or not driver:
            fail("4 Dispatch setup", "No available truck/driver in DB")
        else:
            toll_before = booking.estimated_toll_budget_php
            r = client.post(
                f"/api/dispatch/{booking_id}/assign",
                json={"truck_id": truck.id, "driver_id": driver.id},
                headers=dispatcher_h,
            )
            if r.status_code != 200:
                fail("4 Dispatcher assign", r.text)
            else:
                db = reload_session(db)
                trip_id = r.json().get("trip_id") or (r.json().get("trip_ids") or [None])[0]
                trip = db.query(Trip).filter(Trip.id == trip_id).first()
                if trip is None:
                    trip = (
                        db.query(Trip)
                        .filter(Trip.booking_id == booking_id)
                        .order_by(Trip.id.desc())
                        .first()
                    )
                    trip_id = trip.id if trip else trip_id
                if trip and float(trip.estimated_toll_budget or 0) == 146:
                    ok("4 Dispatch assign", f"trip #{trip_id}, estimated_toll_budget={trip.estimated_toll_budget}")
                else:
                    fail("4 Dispatch assign", f"trip toll budget={getattr(trip, 'estimated_toll_budget', None)}")
                booking = db.query(Booking).filter(Booking.id == booking_id).first()
                if booking.estimated_toll_budget_php == toll_before:
                    ok("4 Toll unchanged after dispatch")
                else:
                    fail("4 Toll unchanged after dispatch", f"before={toll_before}, after={booking.estimated_toll_budget_php}")

        db = reload_session(db)
        trip = (
            db.query(Trip)
            .filter(Trip.booking_id == booking_id, Trip.status != TripStatus.COMPLETED)
            .order_by(Trip.id.desc())
            .first()
        )
        if not trip:
            fail("5-7 Trip for driver/completion", "No trip found")
            return 1

        trip_id = trip.id
        assigned_driver = db.query(User).filter(User.id == trip.driver_id).first()
        if not assigned_driver:
            fail("5-7 Trip for driver/completion", f"No driver on trip #{trip.id}")
            return 1
        driver_h = {"Authorization": f"Bearer {login(client, assigned_driver.email)}"}

        # ── Step 5: Driver additional toll ──
        r = client.post(
            f"/api/trips/{trip_id}/additional-toll",
            json={"amount": 0, "reason": "test"},
            headers=driver_h,
        )
        if r.status_code == 422:
            ok("5a Reject zero amount")
        else:
            fail("5a Reject zero amount", f"status={r.status_code}")

        r = client.post(
            f"/api/trips/{trip_id}/additional-toll",
            json={"amount": 25, "reason": "NLEX additional gate"},
            headers=driver_h,
        )
        if r.status_code == 200:
            ok("5b Additional toll entry", "PHP 25")
        else:
            fail("5b Additional toll entry", r.text)

        # ── Step 6: Trip completion + historical record ──
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        trip.receiving_document_path = "test/receiving.pdf"
        trip.receiving_document_uploaded_at = datetime.utcnow()
        trip.receiving_qr_verified_at = datetime.utcnow()
        trip.digital_signature_path = "test/sig.png"
        trip.digital_signature_uploaded_at = datetime.utcnow()
        trip.status = TripStatus.IN_DELIVERY
        db.commit()
        db = reload_session(db)
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        booking = db.query(Booking).filter(Booking.id == booking_id).first()

        r = client.post(
            f"/api/workflow/job/{trip_id}/complete",
            json={"proof_url": "https://example.com/pod.jpg", "notes": "Delivered"},
            headers=driver_h,
        )
        if r.status_code != 200:
            fail("6a Complete delivery API", r.text)
        else:
            ok("6a Complete delivery API")

        db = reload_session(db)
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        expected_actual = 146 + 25
        if float(trip.toll_actual_total or 0) == expected_actual:
            ok("6b Actual toll", f"{trip.toll_actual_total}")
        else:
            fail("6b Actual toll", f"expected {expected_actual}, got {trip.toll_actual_total}")

        if float(trip.toll_variance or 0) == 25:
            ok("6c Toll variance", f"{trip.toll_variance}")
        else:
            fail("6c Toll variance", f"expected 25, got {trip.toll_variance}")

        hist = db.query(HistoricalTollRecord).filter(HistoricalTollRecord.trip_id == trip_id).first()
        if hist and hist.estimated_toll == 146 and hist.actual_toll == expected_actual:
            ok("6d Historical record", f"est={hist.estimated_toll}, act={hist.actual_toll}")
        else:
            fail("6d Historical record", str(hist))

        # ── Step 7: Analytics ──
        analytics = build_toll_analytics(db)
        if analytics.get("empty"):
            fail("7 Analytics", analytics.get("message", "empty"))
        else:
            summary = analytics["summary"]
            if summary["estimated_toll_total_php"] >= 146 and summary["actual_toll_total_php"] >= expected_actual:
                ok("7a Analytics totals", f"est={summary['estimated_toll_total_php']}, act={summary['actual_toll_total_php']}")
            else:
                fail("7a Analytics totals", str(summary))

            stats = analytics.get("statistics")
            actuals = [float(h.actual_toll) for h in db.query(HistoricalTollRecord).all()]
            expected_stats = compute_statistics(actuals, min_samples=1)
            if stats and stats.get("average") == expected_stats.get("average"):
                ok("7b Statistics", f"avg={stats.get('average')}, min={stats.get('minimum')}, max={stats.get('maximum')}")
            else:
                fail("7b Statistics", f"got={stats}, expected_avg={expected_stats}")

            if analytics.get("drilldown") and not any("mock" in str(x).lower() for x in analytics["drilldown"]):
                ok("7c Real drilldown records", f"{len(analytics['drilldown'])} rows")
            else:
                fail("7c Real drilldown records", "missing or mock")

        r = client.get("/api/admin/analytics", headers=admin_h)
        if r.status_code == 200 and r.json().get("toll_analytics") and not r.json()["toll_analytics"].get("empty"):
            ok("7d Admin analytics payload includes toll_analytics")
            suff = r.json()["toll_analytics"].get("data_sufficiency")
            if suff and isinstance(suff.get("messages"), list):
                ok("7e Analytics data sufficiency messages", f"{len(suff['messages'])} note(s)")
            else:
                fail("7e Analytics data sufficiency messages", "missing data_sufficiency")
        else:
            fail("7d Admin analytics payload", r.text[:200] if r.status_code != 200 else "missing toll_analytics")

    finally:
        db.close()

    print(f"\n{'=' * 60}")
    print(f"Passed: {len(PASSED)}  Failed: {len(FAILED)}")
    for f in FAILED:
        print(f"  • {f}")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
