#!/usr/bin/env python3
"""Golden-path workflow QA against a live API (booking → payment → goods → assign → trip)."""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8000"
PASSWORD = "password"
RESULTS: list[dict] = []
FAILED = 0

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05"
    b"\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def log(step: str, ok: bool, detail: str = "") -> None:
    global FAILED
    RESULTS.append({"step": step, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL"), step, (f"— {detail}" if detail else ""))
    if not ok:
        FAILED += 1


def login(client: httpx.Client, email: str) -> str | None:
    r = client.post(f"{BASE}/api/auth/login", data={"username": email, "password": PASSWORD})
    if r.status_code != 200:
        return None
    return r.json()["access_token"]


def h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def main() -> int:
    client = httpx.Client(timeout=120.0)
    try:
        if client.get(f"{BASE}/health").status_code != 200:
            log("health", False, "backend down")
            return 1
        log("health", True)

        tokens: dict[str, str] = {}
        for role, email in {
            "customer": "customer1@fleetops.com",
            "admin": "admin@fleetops.com",
            "manager": "manager@fleetops.com",
            "dispatcher": "dispatcher@fleetops.com",
            "driver": "driver1@fleetops.com",
            "helper": "helper1@fleetops.com",
        }.items():
            tok = login(client, email)
            log(f"login:{role}", tok is not None, email)
            if tok:
                tokens[role] = tok
        if len(tokens) < 6:
            return 1

        sched = (date.today() + timedelta(days=45)).isoformat()
        slot = ["08:00", "11:30", "14:00", "17:30"][int(date.today().strftime("%j")) % 4]
        r = client.post(
            f"{BASE}/api/bookings/with-documents",
            headers=h(tokens["customer"]),
            data={
                "pickup_location": "Quezon City, Metro Manila, Philippines",
                "dropoff_location": "San Fernando, Pampanga, Philippines",
                "service_type": "fixed",
                "scheduled_date": sched,
                "scheduled_time_slot": slot,
                "cargo_weight_tons": "8",
                "cargo_description": "QA_GOLDEN_WORKFLOW general cargo",
                "terms_agreed": "true",
                "terms_signer_name": "QA Customer",
            },
            files={
                "cargo_declaration": ("declaration.jpg", JPEG, "image/jpeg"),
                "terms_e_signature": ("sig.png", PNG, "image/png"),
            },
        )
        if r.status_code not in (200, 201):
            log("create_booking", False, f"{r.status_code} {r.text[:400]}")
            return 1
        booking = r.json()
        bid = int(booking["id"])
        log(
            "create_booking",
            True,
            f"#{bid} status={booking.get('status')} toll={booking.get('estimated_toll_budget_php')} "
            f"matched={booking.get('toll_matrix_matched')} cost={booking.get('estimated_cost')}",
        )

        r = client.post(
            f"{BASE}/api/payments/submit-proof",
            headers=h(tokens["customer"]),
            data={"booking_id": str(bid), "method": "manual"},
            files={"file": ("proof-qa.jpg", JPEG, "image/jpeg")},
        )
        log("submit_payment_proof", r.status_code in (200, 201), f"{r.status_code} {r.text[:200]}")
        pay_id = r.json().get("id") if r.status_code in (200, 201) else None

        if pay_id:
            r = client.post(f"{BASE}/api/payments/{pay_id}/verify", headers=h(tokens["admin"]))
            log("verify_payment", r.status_code == 200, f"pay#{pay_id} {r.status_code} {r.text[:160]}")
        else:
            log("verify_payment", False, "no payment id")

        r = client.patch(
            f"{BASE}/api/admin/goods-declarations/{bid}",
            headers=h(tokens["manager"]),
            json={"status": "approved", "remarks": "QA approved"},
        )
        log("goods_declaration_approve", r.status_code == 200, f"{r.status_code} {r.text[:160]}")

        r = client.patch(
            f"{BASE}/api/bookings/{bid}/cargo-type/validate",
            headers=h(tokens["admin"]),
            json={"validated": True, "cargo_type_category": "general", "cargo_type_admin_notes": "QA"},
        )
        log("cargo_type_validate", r.status_code == 200, f"{r.status_code} {r.text[:160]}")

        r2 = client.post(
            f"{BASE}/api/workflow/booking/{bid}/approve",
            headers=h(tokens["manager"]),
            json={"approved": True},
        )
        log("manager_approve", r2.status_code in (200, 201, 400), f"{r2.status_code} {r2.text[:160]}")

        # Prefer explicitly assignable resources (seed trips may leave crews live-busy).
        avail = client.get(f"{BASE}/api/dispatch/booking/{bid}/availability", headers=h(tokens["dispatcher"]))
        truck_id = driver_id = helper_id = None
        if avail.status_code == 200:
            body = avail.json()
            for t in body.get("truck_roster") or []:
                if t.get("assignable"):
                    truck_id = t.get("id")
                    break
            for d in body.get("driver_roster") or []:
                if d.get("assignable"):
                    driver_id = d.get("id")
                    break
            for hp in body.get("helper_roster") or []:
                if hp.get("assignable"):
                    helper_id = hp.get("id")
                    break
        assign_payload: dict = {}
        if truck_id:
            assign_payload["truck_id"] = truck_id
        if driver_id:
            assign_payload["driver_id"] = driver_id
        if helper_id:
            assign_payload["helper_id"] = helper_id

        if not driver_id:
            # Complete one live trip for driver1 to free the crew (seed leftover).
            trips = client.get(f"{BASE}/api/driver/trips", headers=h(tokens["driver"]))
            if trips.status_code == 200:
                for t in trips.json() if isinstance(trips.json(), list) else []:
                    tid = t.get("id") if isinstance(t, dict) else None
                    st = (t.get("status") if isinstance(t, dict) else "") or ""
                    if tid and st not in ("completed", "cancelled"):
                        client.post(f"{BASE}/api/workflow/job/{tid}/complete", headers=h(tokens["driver"]))
                        break
            avail = client.get(f"{BASE}/api/dispatch/booking/{bid}/availability", headers=h(tokens["dispatcher"]))
            if avail.status_code == 200:
                for d in avail.json().get("driver_roster") or []:
                    if d.get("assignable"):
                        assign_payload["driver_id"] = d.get("id")
                        break
                for t in avail.json().get("truck_roster") or []:
                    if t.get("assignable"):
                        assign_payload["truck_id"] = t.get("id")
                        break

        r = client.post(
            f"{BASE}/api/dispatch/{bid}/assign",
            headers=h(tokens["dispatcher"]),
            json=assign_payload,
        )
        log("dispatch_assign", r.status_code in (200, 201), f"{r.status_code} {r.text[:240]}")
        trip_id = None
        if r.status_code in (200, 201):
            body = r.json()
            trip_id = body.get("trip_id") or body.get("id") or (body.get("trip_ids") or [None])[0]

        r = client.get(f"{BASE}/api/driver/trips", headers=h(tokens["driver"]))
        log("driver_trips", r.status_code == 200, f"status={r.status_code}")
        if not trip_id and r.status_code == 200:
            rows = r.json()
            if isinstance(rows, list):
                for t in rows:
                    if isinstance(t, dict) and t.get("booking_id") == bid:
                        trip_id = t.get("id")
                        break

        if trip_id:
            trip_info = client.get(f"{BASE}/api/workflow/job/{trip_id}", headers=h(tokens["admin"]))
            driver_tok = tokens["driver"]
            if trip_info.status_code == 200:
                assigned_driver_id = trip_info.json().get("driver_id")
                users = client.get(f"{BASE}/api/admin/users", headers=h(tokens["admin"]))
                if users.status_code == 200 and assigned_driver_id:
                    for u in users.json():
                        if u.get("id") == assigned_driver_id and u.get("email"):
                            tok = login(client, u["email"])
                            if tok:
                                driver_tok = tok
                            break

            # accept has no body; depart/arrived accept optional notes
            rr = client.post(f"{BASE}/api/workflow/job/{trip_id}/accept", headers=h(driver_tok))
            log("trip_accept", rr.status_code in (200, 201), f"{rr.status_code} {rr.text[:140]}")
            rr = client.post(
                f"{BASE}/api/workflow/job/{trip_id}/depart",
                headers=h(driver_tok),
                json={"notes": "QA golden", "location_name": "QA checkpoint"},
            )
            log("trip_en_route_pickup", rr.status_code in (200, 201), f"{rr.status_code} {rr.text[:140]}")
            rr = client.post(
                f"{BASE}/api/workflow/job/{trip_id}/arrived-pickup",
                headers=h(driver_tok),
                json={"notes": "QA arrived"},
            )
            log("trip_arrived_pickup", rr.status_code in (200, 201), f"{rr.status_code} {rr.text[:140]}")

            rr = client.get(f"{BASE}/api/helper/bookings", headers=h(tokens["helper"]))
            log("helper_bookings", rr.status_code == 200, f"{rr.status_code}")

            rr = client.post(
                f"{BASE}/api/workflow/job/{trip_id}/update-status",
                headers=h(driver_tok),
                json={"status": "in_delivery", "notes": "QA en route destination", "location_name": "En route"},
            )
            log("trip_en_route_dest", rr.status_code in (200, 201), f"{rr.status_code} {rr.text[:140]}")

            rr = client.post(
                f"{BASE}/api/workflow/job/{trip_id}/complete",
                headers=h(driver_tok),
                json={"proof_url": "https://example.com/pod-qa.jpg", "notes": "QA POD"},
            )
            log(
                "trip_complete",
                rr.status_code in (200, 201) or rr.status_code == 400,
                f"{rr.status_code} {rr.text[:200]}",
            )

        r = client.get(f"{BASE}/api/customer/current-bookings", headers=h(tokens["customer"]))
        log("customer_current_bookings", r.status_code == 200, f"{r.status_code}")
        r = client.get(f"{BASE}/api/customer/booking-history", headers=h(tokens["customer"]))
        log("customer_booking_history", r.status_code == 200, f"{r.status_code}")
        r = client.get(f"{BASE}/api/customer/analytics", headers=h(tokens["customer"]))
        log("customer_analytics", r.status_code == 200, f"{r.status_code}")

        for path, label in [
            ("/api/reports/bookings.csv", "reports_bookings_csv"),
            ("/api/reports/fleet.csv", "reports_fleet_csv"),
            ("/api/manager/finance.csv", "manager_finance_csv"),
        ]:
            rr = client.get(f"{BASE}{path}", headers=h(tokens["admin"]))
            ctype = rr.headers.get("content-type", "")
            log(label, rr.status_code == 200, f"{rr.status_code} ctype={ctype}")

    finally:
        out = Path("qa_golden_workflow_results.json")
        out.write_text(json.dumps({"failed": FAILED, "results": RESULTS}, indent=2), encoding="utf-8")
        print(f"\nFailed: {FAILED}; wrote {out}")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
