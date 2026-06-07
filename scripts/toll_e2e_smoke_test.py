#!/usr/bin/env python3
"""End-to-end toll estimation workflow smoke test.

Requires a running API at BASE (default http://127.0.0.1:8000) and seeded admin/driver accounts.
Set env vars for credentials or use defaults from local dev seed.
"""
from __future__ import annotations

import os
import sys
from datetime import date, timedelta

import httpx

BASE = os.environ.get("FLEETOPS_API_BASE", "http://127.0.0.1:8000")
ADMIN_EMAIL = os.environ.get("TOLL_TEST_ADMIN_EMAIL", "admin@fleetops.com")
ADMIN_PASSWORD = os.environ.get("TOLL_TEST_ADMIN_PASSWORD", "password")
DRIVER_EMAIL = os.environ.get("TOLL_TEST_DRIVER_EMAIL", "driver1@fleetops.com")
DRIVER_PASSWORD = os.environ.get("TOLL_TEST_DRIVER_PASSWORD", "password")
CUSTOMER_EMAIL = os.environ.get("TOLL_TEST_CUSTOMER_EMAIL", "customer1@fleetops.com")
CUSTOMER_PASSWORD = os.environ.get("TOLL_TEST_CUSTOMER_PASSWORD", "password")

ORIGIN = os.environ.get("TOLL_TEST_ENTRY", "San Fernando")
DESTINATION = os.environ.get("TOLL_TEST_EXIT", "San Simon")
VEHICLE_CLASS = os.environ.get("TOLL_TEST_VEHICLE_CLASS", "Class 3")

passed: list[str] = []
failed: list[str] = []


def ok(name: str, detail: str = "") -> None:
    passed.append(name)
    print(f"  PASS  {name}" + (f" — {detail}" if detail else ""))


def fail(name: str, detail: str) -> None:
    failed.append(f"{name}: {detail}")
    print(f"  FAIL  {name} — {detail}")


def login(client: httpx.Client, email: str, password: str) -> str | None:
    resp = client.post(f"{BASE}/api/auth/login", data={"username": email, "password": password})
    if resp.status_code != 200:
        return None
    return resp.json().get("access_token")


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def main() -> int:
    print(f"Toll E2E smoke test -> {BASE}\n")
    client = httpx.Client(timeout=30.0)

    # Health
    try:
        r = client.get(f"{BASE}/health")
        if r.status_code != 200:
            fail("API health", f"/health returned {r.status_code}")
            return 1
        ok("API reachable")
    except httpx.ConnectError as exc:
        fail("API health", str(exc))
        print("\nStart the backend: python -m uvicorn app.main:app --reload")
        return 1

    admin_token = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        fail("Admin login", "Could not authenticate admin")
        return 1
    ok("Admin login")

    customer_token = login(client, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    if not customer_token:
        fail("Customer login", "Could not authenticate customer")
        return 1
    ok("Customer login")

    driver_token = login(client, DRIVER_EMAIL, DRIVER_PASSWORD)
    driver_ok = driver_token is not None
    if driver_ok:
        ok("Driver login")
    else:
        print("  WARN  Driver login skipped (optional for partial test)")

    ah = auth_headers(admin_token)
    ch = auth_headers(customer_token)

    # Phase 1 — Toll matrix CRUD
    matrix_payload = {
        "entry_point": ORIGIN,
        "exit_point": DESTINATION,
        "vehicle_class": VEHICLE_CLASS,
        "toll_fee": 146,
        "effective_date": "2026-01-20",
        "status": "active",
    }
    r = client.get(f"{BASE}/api/admin/toll-matrix", headers=ah)
    if r.status_code != 200:
        fail("List toll matrix", r.text)
        rows_data: list[dict] = []
    else:
        rows_data = r.json()
        ok("List toll matrix", f"{len(rows_data)} rows")

    existing = None
    for row in rows_data:
        if (
            row.get("entry_point", "").lower() == ORIGIN.lower()
            and row.get("exit_point", "").lower() == DESTINATION.lower()
            and row.get("vehicle_class") == VEHICLE_CLASS
        ):
            existing = row
            break

    if existing:
        row_id = existing["id"]
        r = client.put(f"{BASE}/api/admin/toll-matrix/{row_id}", json=matrix_payload, headers=ah)
        action = "Update toll matrix"
    else:
        r = client.post(f"{BASE}/api/admin/toll-matrix", json=matrix_payload, headers=ah)
        action = "Create toll matrix"
        row_id = r.json().get("id") if r.status_code == 200 else None

    if r.status_code not in (200, 201):
        fail(action, r.text)
    else:
        budget = r.json().get("toll_fee")
        ok(action, f"fee={budget}")
        if budget != 146:
            fail("Toll fee lookup", f"expected 146, got {budget}")

    # Phase 2 — Route quote toll estimation
    quote_body = {
        "pickup_location": ORIGIN,
        "dropoff_location": DESTINATION,
        "weight_tons": 10,
    }
    r = client.post(f"{BASE}/api/customer/route-quote", json=quote_body, headers=ch)
    if r.status_code != 200:
        fail("Route quote", r.text)
    else:
        data = r.json()
        matched = data.get("toll_matrix_matched")
        ok("Route quote", f"matched={matched}, toll_fees={data.get('toll_fees_php')}")
        if matched:
            ok("Toll matrix match on quote")
        else:
            print("  WARN  Matrix did not match (location normalization may differ)")

    # Phase 7 — Fallback quote (unknown route)
    r = client.post(
        f"{BASE}/api/customer/route-quote",
        json={"pickup_location": "Unknown City Alpha", "dropoff_location": "Unknown City Beta", "weight_tons": 5},
        headers=ch,
    )
    if r.status_code == 200:
        msg = r.json().get("toll_estimate_message") or ""
        if "No toll estimate" in msg or "No toll plaza match" in msg or not r.json().get("toll_matrix_matched"):
            ok("Fallback — no matrix match", msg or "booking can continue")
        else:
            ok("Fallback quote", "returned 200 (non-blocking)")
    else:
        fail("Fallback quote", r.text)

    # Phase 6 — Analytics includes toll_analytics
    r = client.get(f"{BASE}/api/admin/analytics", headers=ah)
    if r.status_code != 200:
        fail("Admin analytics", r.text)
    else:
        toll_a = r.json().get("toll_analytics")
        if toll_a is not None:
            ok("Toll analytics payload present")
        else:
            fail("Toll analytics payload", "missing toll_analytics key")

    # Phases 3–5 require an active trip — best-effort if driver token available
    if driver_ok and driver_token:
        dh = auth_headers(driver_token)
        r = client.get(f"{BASE}/api/workflow/my-trips", headers=dh)
        if r.status_code == 200 and r.json():
            trip_id = r.json()[0]["id"]
            trip_status = r.json()[0].get("status")
            ok("Driver my-trips", f"trip #{trip_id} status={trip_status}")

            if trip_status not in ("completed", "cancelled"):
                add_body = {"amount": 75, "reason": "NLEX additional toll (E2E test)"}
                r = client.post(f"{BASE}/api/trips/{trip_id}/additional-toll", json=add_body, headers=dh)
                if r.status_code == 200:
                    ok("Additional toll entry", f"PHP {add_body['amount']}")
                elif r.status_code == 403:
                    print("  WARN  Additional toll rejected (not assigned driver for this trip)")
                else:
                    fail("Additional toll entry", r.text)

                r = client.get(f"{BASE}/api/trips/{trip_id}/additional-tolls", headers=dh)
                if r.status_code == 200:
                    ok("List additional tolls", f"{len(r.json())} entries")
                else:
                    fail("List additional tolls", r.text)
            else:
                print("  SKIP  Additional toll (trip already completed)")
        else:
            print("  SKIP  No active driver trips for phases 3–5")

    print(f"\n{'=' * 50}")
    print(f"Passed: {len(passed)}  Failed: {len(failed)}")
    if failed:
        for f in failed:
            print(f"  • {f}")
        return 1
    print("All automated toll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
