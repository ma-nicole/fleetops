#!/usr/bin/env python3
"""Analytics Center E2E (in-process TestClient)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db import SessionLocal, apply_runtime_schema_fixes  # noqa: E402
from app.main import app  # noqa: E402
from app.models.entities import User, UserRole  # noqa: E402

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


def module_state(payload: dict, key: str) -> str:
    mod = payload.get(key)
    if mod is None:
        return "null"
    if isinstance(mod, dict) and mod.get("empty"):
        return "empty"
    return "ok"


def validate_feature_block(block: object, *, path: str) -> str | None:
    if not isinstance(block, dict):
        return f"{path}: not an object"
    if block.get("empty"):
        if "message" not in block:
            return f"{path}: empty block missing message"
        return None
    if "chart" not in block:
        return f"{path}: missing chart key"
    chart = block.get("chart")
    if chart is not None and not isinstance(chart, list):
        return f"{path}: chart is not a list"
    if chart is None:
        return f"{path}: chart is null"
    return None


def audit_role_analytics_tree(payload: dict, root_key: str) -> tuple[int, list[str]]:
    """Walk pillar -> descriptive|predictive -> feature blocks."""
    errors: list[str] = []
    count = 0
    root = payload.get(root_key)
    if root is None:
        return 0, [f"{root_key} is null"]
    if not isinstance(root, dict):
        return 0, [f"{root_key} is not an object"]
    for pillar, sections in root.items():
        if not isinstance(sections, dict):
            errors.append(f"{root_key}.{pillar}: not an object")
            continue
        for section, features in sections.items():
            if not isinstance(features, dict):
                errors.append(f"{root_key}.{pillar}.{section}: not an object")
                continue
            for feature_key, block in features.items():
                count += 1
                err = validate_feature_block(block, path=f"{root_key}.{pillar}.{section}.{feature_key}")
                if err:
                    errors.append(err)
    return count, errors


def main() -> int:
    print("Analytics Center E2E test\n")
    apply_runtime_schema_fixes()
    with SessionLocal() as db:
        dispatcher_user = db.query(User).filter(User.email == "dispatcher@fleetops.com").first()
        if dispatcher_user and dispatcher_user.role != UserRole.DISPATCHER:
            dispatcher_user.role = UserRole.DISPATCHER
            db.commit()
    client = TestClient(app)

    # ── Auth guards ──
    r = client.get("/api/admin/analytics")
    if r.status_code != 401:
        fail("0 Unauthenticated blocked", f"status={r.status_code}")
    else:
        ok("0 Unauthenticated blocked")

    admin_h = {"Authorization": f"Bearer {login(client, 'admin@fleetops.com')}"}
    manager_h = {"Authorization": f"Bearer {login(client, 'manager@fleetops.com')}"}
    dispatcher_h = {"Authorization": f"Bearer {login(client, 'dispatcher@fleetops.com')}"}
    customer_h = {"Authorization": f"Bearer {login(client, 'customer1@fleetops.com')}"}
    driver_h = {"Authorization": f"Bearer {login(client, 'driver1@fleetops.com')}"}

    r = client.get("/api/admin/analytics", headers=customer_h)
    if r.status_code != 403:
        fail("1 Customer denied", f"status={r.status_code}")
    else:
        ok("1 Customer denied")

    # ── Admin full payload ──
    r = client.get("/api/admin/analytics", headers=admin_h)
    if r.status_code != 200:
        fail("2 Admin analytics", f"status={r.status_code} body={r.text[:400]}")
        print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
        return 1

    try:
        payload = r.json()
        json.dumps(payload)
    except Exception as exc:
        fail("2 Admin analytics JSON", str(exc))
        print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
        return 1

    ok("2 Admin analytics", f"keys={len(payload)}")

    modules = [
        "shipments",
        "expenses",
        "fleet",
        "drivers",
        "routes",
        "financial",
        "clients",
        "toll_analytics",
        "role_analytics",
        "executive_overview",
        "comparative_analytics",
    ]
    states = {m: module_state(payload, m) for m in modules}
    ok("3 Module audit", ", ".join(f"{k}={v}" for k, v in states.items()))

    for m in modules:
        if states[m] == "fail":
            fail(f"3.{m}", "module missing or invalid")

    # ── Filters ──
    r = client.get(
        "/api/admin/analytics",
        headers=admin_h,
        params={"date_from": "2020-01-01", "date_to": "2030-12-31", "shipment_status": "delivered"},
    )
    if r.status_code != 200:
        fail("4 Filtered analytics", f"status={r.status_code}")
    else:
        ok("4 Filtered analytics")

    r = client.get(
        "/api/admin/analytics",
        headers=admin_h,
        params={"date_from": "2030-01-01", "date_to": "2020-01-01"},
    )
    if r.status_code != 400:
        fail("5 Invalid date range", f"status={r.status_code}")
    else:
        ok("5 Invalid date range rejected")

    for gran in ("daily", "weekly", "monthly", "quarterly", "yearly"):
        r = client.get("/api/admin/analytics", headers=admin_h, params={"granularity": gran})
        if r.status_code != 200:
            fail(f"5b Granularity {gran}", f"status={r.status_code}")
            continue
        ship = r.json().get("shipments") or {}
        deliveries = ship.get("monthly_deliveries") or []
        if deliveries and "period" not in deliveries[0]:
            fail(f"5b Granularity {gran}", "monthly_deliveries missing period key")
        else:
            ok(f"5b Granularity {gran}", f"deliveries={len(deliveries)}")

    role = payload.get("role_analytics") or {}
    planning = (role.get("planning") or {}).get("predictive") or {}
    cost_forecast = planning.get("cost_forecasting") or {}
    fuel_prediction = planning.get("fuel_prediction") or {}
    if cost_forecast.get("empty"):
        fail("5c Manager predictive", "cost_forecasting still empty after seed")
    elif not cost_forecast.get("chart"):
        fail("5c Manager predictive", "cost_forecasting has no chart rows")
    elif fuel_prediction.get("empty"):
        fail("5c Manager predictive", "fuel_prediction still empty after seed")
    elif not fuel_prediction.get("chart"):
        fail("5c Manager predictive", "fuel_prediction has no chart rows")
    else:
        ok(
            "5c Manager predictive",
            f"cost={len(cost_forecast.get('chart') or [])} fuel={len(fuel_prediction.get('chart') or [])}",
        )

    # ── Dispatcher subset ──
    r = client.get("/api/admin/analytics", headers=dispatcher_h)
    if r.status_code != 200:
        fail("6 Dispatcher analytics", f"status={r.status_code} body={r.text[:400]}")
    else:
        d = r.json()
        if d.get("financial") is not None or d.get("clients") is not None:
            fail("6 Dispatcher analytics", "financial/clients should be null")
        elif d.get("dispatcher_role_analytics") is None:
            fail("6 Dispatcher analytics", "dispatcher_role_analytics should be populated")
        else:
            ok("6 Dispatcher analytics", "financial/clients excluded, dispatcher_role_analytics present")
        disp_count, disp_errors = audit_role_analytics_tree(d, "dispatcher_role_analytics")
        if disp_errors:
            fail("6b Dispatcher role blocks", disp_errors[0])
        else:
            ok("6b Dispatcher role blocks", f"features={disp_count}")
        conflict_block = (
            (d.get("dispatcher_role_analytics") or {})
            .get("operational_support", {})
            .get("predictive", {})
            .get("schedule_conflict_prediction")
        )
        if isinstance(conflict_block, dict) and conflict_block.get("empty"):
            fail("6d Schedule conflict prediction", "still empty_predict")
        elif isinstance(conflict_block, dict) and not conflict_block.get("chart"):
            fail("6d Schedule conflict prediction", "missing chart rows")
        else:
            ok("6d Schedule conflict prediction", "chart populated")

    # ── Manager role_analytics block audit ──
    mgr_count, mgr_errors = audit_role_analytics_tree(payload, "role_analytics")
    if mgr_errors:
        fail("6c Manager role blocks", mgr_errors[0])
    else:
        ok("6c Manager role blocks", f"features={mgr_count}")

    # ── Driver analytics ──
    r = client.get("/api/driver/analytics", headers=driver_h)
    if r.status_code != 200:
        fail("9 Driver analytics", f"status={r.status_code} body={r.text[:400]}")
    else:
        try:
            driver_payload = r.json()
            json.dumps(driver_payload)
        except Exception as exc:
            fail("9 Driver analytics JSON", str(exc))
        else:
            drv_count, drv_errors = audit_role_analytics_tree(driver_payload, "driver_role_analytics")
            if drv_errors:
                fail("9 Driver role blocks", drv_errors[0])
            else:
                ok("9 Driver analytics", f"features={drv_count}")
            priority = (
                (driver_payload.get("driver_role_analytics") or {})
                .get("delivery_reporting", {})
                .get("predictive", {})
                .get("completion_time_prediction")
            )
            if isinstance(priority, dict) and not priority.get("empty") and not priority.get("chart"):
                fail("9b Driver completion_time_prediction", "block has no chart rows")
            else:
                ok("9b Driver completion_time_prediction", "chart ok or empty")

    r = client.get("/api/driver/analytics", headers=customer_h)
    if r.status_code != 403:
        fail("9c Driver denied for customer", f"status={r.status_code}")
    else:
        ok("9c Driver denied for customer")

    # ── Customer analytics ──
    r = client.get("/api/customer/analytics", headers=customer_h)
    if r.status_code != 200:
        fail("10 Customer analytics", f"status={r.status_code} body={r.text[:400]}")
    else:
        try:
            customer_payload = r.json()
            json.dumps(customer_payload)
        except Exception as exc:
            fail("10 Customer analytics JSON", str(exc))
        else:
            cust_count, cust_errors = audit_role_analytics_tree(customer_payload, "customer_role_analytics")
            if cust_errors:
                fail("10 Customer role blocks", cust_errors[0])
            else:
                ok("10 Customer analytics", f"features={cust_count}")

    r = client.get("/api/customer/analytics", headers=driver_h)
    if r.status_code != 403:
        fail("10b Customer denied for driver", f"status={r.status_code}")
    else:
        ok("10b Customer denied for driver")

    # ── AI interpretation endpoints ──
    r = client.post(
        "/api/admin/analytics/chart-interpretation",
        headers=admin_h,
        json={
            "section_title": "Shipments",
            "selection_label": "All",
            "chart_type": "bar",
            "items": [{"label": "delivered", "count": 1}],
            "record_count": 1,
        },
    )
    if r.status_code != 200 or not r.json().get("interpretation"):
        fail("7 Chart interpretation", f"status={r.status_code} body={r.text[:200]}")
    else:
        ok("7 Chart interpretation")

    expense_body = {
        "context_year": 2026,
        "quarter": 1,
        "quarter_label": "Q1 2026",
        "total_php": 1000.0,
        "categories": [{"key": "fuel", "label": "Fuel", "amount_php": 1000.0, "percentage": 100.0}],
        "largest": {"key": "fuel", "label": "Fuel", "amount_php": 1000.0, "percentage": 100.0},
        "smallest": {"key": "fuel", "label": "Fuel", "amount_php": 1000.0, "percentage": 100.0},
        "concentration": "Fuel dominates this quarter.",
    }
    r = client.post("/api/admin/analytics/expense-interpretation", headers=admin_h, json=expense_body)
    if r.status_code != 200 or not r.json().get("interpretation"):
        fail("8 Expense interpretation", f"status={r.status_code} body={r.text[:200]}")
    else:
        ok("8 Expense interpretation")

    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    raise SystemExit(main())
