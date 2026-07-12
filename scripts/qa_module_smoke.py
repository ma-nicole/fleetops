#!/usr/bin/env python3
"""Role-based API module smoke for FleetOps QA audit.

Logs in as each seeded role and hits representative endpoints.
Writes qa_module_smoke_results.json for the QA report.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8000"
PASSWORD = "password"

ROLES = {
    "admin": "admin@fleetops.com",
    "manager": "manager@fleetops.com",
    "dispatcher": "dispatcher@fleetops.com",
    "driver": "driver1@fleetops.com",
    "helper": "helper1@fleetops.com",
    "customer": "customer1@fleetops.com",
}

# (role, method, path, expect_ok_statuses, note)
CHECKS: list[tuple[str, str, str, set[int], str]] = [
    ("admin", "GET", "/api/auth/me", {200}, "auth me"),
    ("admin", "GET", "/api/admin/users", {200}, "admin users"),
    ("admin", "GET", "/api/admin/trucks", {200}, "admin trucks"),
    ("admin", "GET", "/api/admin/analytics", {200}, "admin analytics"),
    ("admin", "GET", "/api/admin/toll-matrix", {200}, "toll matrix"),
    ("admin", "GET", "/api/admin/toll-plazas", {200}, "toll plazas"),
    ("admin", "GET", "/api/payments", {200}, "payments list"),
    ("admin", "GET", "/api/reports/bookings", {200}, "bookings report"),
    ("admin", "GET", "/api/reports/fleet", {200}, "fleet report"),
    ("manager", "GET", "/api/manager/dashboard", {200, 404}, "manager dashboard"),
    ("manager", "GET", "/api/manager/finance-report", {200}, "finance report"),
    ("manager", "GET", "/api/manager/maintenance-report", {200}, "maintenance report"),
    ("manager", "GET", "/api/admin/analytics", {200}, "manager analytics"),
    ("dispatcher", "GET", "/api/dispatch/dashboard", {200, 404}, "dispatch dashboard"),
    ("dispatcher", "GET", "/api/schedule/timeline", {200, 404, 422}, "schedule timeline"),
    ("dispatcher", "GET", "/api/workflow/pending-assignments", {200, 404}, "pending assignments"),
    ("driver", "GET", "/api/driver/dashboard", {200, 404}, "driver dashboard"),
    ("driver", "GET", "/api/driver/trips", {200}, "driver my trips"),
    ("helper", "GET", "/api/helper/bookings", {200, 404}, "helper bookings"),
    ("helper", "GET", "/api/helper/bookings", {200}, "helper assigned bookings"),
    ("customer", "GET", "/api/customer/current-bookings", {200, 404}, "customer current bookings"),
    ("customer", "GET", "/api/customer/analytics", {200, 404}, "customer analytics"),
    ("customer", "GET", "/api/bookings", {200}, "customer bookings list"),
    # Cross-role denial probes
    ("customer", "GET", "/api/admin/users", {403}, "customer denied admin users"),
    ("driver", "GET", "/api/admin/users", {403}, "driver denied admin users"),
    ("helper", "GET", "/api/admin/analytics", {403}, "helper denied admin analytics"),
]


def login(client: httpx.Client, email: str) -> str | None:
    r = client.post(f"{BASE}/api/auth/login", data={"username": email, "password": PASSWORD})
    if r.status_code != 200:
        return None
    return r.json().get("access_token")


def main() -> int:
    results: list[dict] = []
    failed = 0
    client = httpx.Client(timeout=60.0)
    tokens: dict[str, str] = {}

    # Health
    try:
        h = client.get(f"{BASE}/health")
        results.append({"check": "health", "status": h.status_code, "ok": h.status_code == 200})
        if h.status_code != 200:
            failed += 1
    except Exception as exc:
        results.append({"check": "health", "ok": False, "error": str(exc)})
        print("Backend unreachable:", exc)
        Path("qa_module_smoke_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
        return 1

    for role, email in ROLES.items():
        tok = login(client, email)
        if not tok:
            results.append({"check": f"login:{role}", "ok": False, "email": email})
            failed += 1
            print(f"FAIL login {role}")
            continue
        tokens[role] = tok
        results.append({"check": f"login:{role}", "ok": True})
        print(f"PASS login {role}")

    for role, method, path, expect, note in CHECKS:
        tok = tokens.get(role)
        if not tok:
            results.append({"check": note, "role": role, "path": path, "ok": False, "error": "no token"})
            failed += 1
            continue
        headers = {"Authorization": f"Bearer {tok}"}
        try:
            r = client.request(method, f"{BASE}{path}", headers=headers)
            ok = r.status_code in expect
            entry = {
                "check": note,
                "role": role,
                "method": method,
                "path": path,
                "status": r.status_code,
                "expect": sorted(expect),
                "ok": ok,
            }
            if not ok:
                entry["body_snip"] = (r.text or "")[:240]
                failed += 1
                print(f"FAIL {note} {method} {path} -> {r.status_code}")
            else:
                print(f"PASS {note} -> {r.status_code}")
            results.append(entry)
        except Exception as exc:
            failed += 1
            results.append({"check": note, "role": role, "path": path, "ok": False, "error": str(exc)})
            print(f"FAIL {note} exception {exc}")

    # Frontend page reachability (HTML 200, no auth)
    pages = [
        "/login",
        "/register",
        "/dashboard/customer",
        "/dashboard/dispatcher",
        "/dashboard/driver",
        "/dashboard/helper",
        "/dashboard/manager",
        "/dashboard/admin",
        "/dispatcher/week-board",
        "/dispatcher/job-assignments",
        "/helper/bookings",
        "/modules/operations/trips",
        "/modules/analytics/predictions",
        "/modules/administration/tolls",
        "/modules/administration/vehicles",
        "/reports/generate",
        "/booking/create",
    ]
    fe = "http://127.0.0.1:3000"
    for page in pages:
        try:
            r = client.get(f"{fe}{page}", follow_redirects=True)
            ok = r.status_code == 200
            results.append({"check": f"fe:{page}", "status": r.status_code, "ok": ok})
            print(("PASS" if ok else "FAIL"), f"fe {page} -> {r.status_code}")
            if not ok:
                failed += 1
        except Exception as exc:
            failed += 1
            results.append({"check": f"fe:{page}", "ok": False, "error": str(exc)})
            print(f"FAIL fe {page} {exc}")

    out = Path("qa_module_smoke_results.json")
    out.write_text(json.dumps({"failed": failed, "results": results}, indent=2), encoding="utf-8")
    print(f"\nFailed checks: {failed}")
    print(f"Wrote {out}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
