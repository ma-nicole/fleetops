"""Cross-check admin analytics payload against drill-down and source totals."""
from __future__ import annotations

from typing import Any


def _sum_chart(items: list[dict], key: str) -> float:
    return round(sum(float(x.get(key) or 0) for x in items), 2)


def _sum_int(items: list[dict], key: str) -> int:
    return sum(int(x.get(key) or 0) for x in items)


def validate_admin_analytics(payload: dict[str, Any]) -> dict[str, Any]:
    """Return validation report; mismatches indicate calculation bugs."""
    checks: list[dict[str, Any]] = []
    ok = True

    def record(name: str, passed: bool, detail: str, expected: Any = None, actual: Any = None) -> None:
        nonlocal ok
        if not passed:
            ok = False
        checks.append(
            {
                "check": name,
                "passed": passed,
                "detail": detail,
                "expected": expected,
                "actual": actual,
            }
        )

    shipments = payload.get("shipments") or {}
    if not shipments.get("empty"):
        summary = shipments.get("summary") or {}
        dist = shipments.get("status_distribution") or []
        drill = shipments.get("drilldown") or []
        dist_sum = _sum_int(dist, "count")
        total = int(summary.get("total_shipments") or 0)
        record(
            "shipments_status_distribution_sum",
            dist_sum == total,
            "Status distribution counts must equal total shipments.",
            total,
            dist_sum,
        )
        record(
            "shipments_drilldown_count",
            len(drill) == total or len(drill) == min(total, 200),
            "Drill-down row count must match filtered shipments (capped at 200).",
            min(total, 200),
            len(drill),
        )
        parts = (
            int(summary.get("delivered") or 0)
            + int(summary.get("delayed") or 0)
            + int(summary.get("cancelled") or 0)
            + int(summary.get("in_transit") or 0)
            + int(summary.get("pending") or 0)
        )
        record(
            "shipments_category_parts_sum",
            parts == total,
            "Delivered + delayed + cancelled + in_transit + pending must equal total.",
            total,
            parts,
        )
        if total > 0 and summary.get("delivery_success_rate_pct") is not None:
            expected_rate = round((int(summary.get("delivered") or 0) / total) * 100, 1)
            actual_rate = float(summary.get("delivery_success_rate_pct"))
            record(
                "shipments_success_rate",
                abs(expected_rate - actual_rate) < 0.05,
                "Success rate must be delivered / total * 100.",
                expected_rate,
                actual_rate,
            )

    expenses = payload.get("expenses") or {}
    if not expenses.get("empty"):
        summary = expenses.get("summary") or {}
        breakdown = expenses.get("expense_breakdown") or []
        breakdown_sum = _sum_chart(breakdown, "amount_php")
        total_op = float(summary.get("total_operational_cost_php") or 0)
        record(
            "expenses_breakdown_total",
            abs(breakdown_sum - total_op) < 0.02,
            "Expense breakdown must sum to total operational cost.",
            total_op,
            breakdown_sum,
        )
        fuel_chart = _sum_chart(expenses.get("fuel_by_truck") or [], "fuel_php")
        fuel_summary = float(summary.get("fuel_expenses_php") or 0)
        record(
            "expenses_fuel_chart_vs_summary",
            abs(fuel_chart - fuel_summary) < 0.02,
            "Fuel-by-truck chart must match fuel summary.",
            fuel_summary,
            fuel_chart,
        )

    financial = payload.get("financial")
    clients = payload.get("clients")
    if financial and not financial.get("empty"):
        fin_rev = float(financial.get("summary", {}).get("total_revenue_php") or 0)
        trend_rev = _sum_chart(financial.get("revenue_trend") or [], "revenue_php")
        undated_rev = float(financial.get("summary", {}).get("undated_revenue_php") or 0)
        record(
            "financial_revenue_trend_total",
            abs(fin_rev - trend_rev - undated_rev) < 0.02,
            "Revenue trend plus undated revenue must equal total revenue.",
            fin_rev,
            round(trend_rev + undated_rev, 2),
        )
        if clients and not clients.get("empty"):
            client_rev = float(clients.get("summary", {}).get("total_revenue_php") or 0)
            record(
                "financial_client_revenue_consistency",
                abs(fin_rev - client_rev) < 0.02,
                "Financial total revenue must match client module revenue.",
                fin_rev,
                client_rev,
            )

    fleet = payload.get("fleet") or {}
    if not fleet.get("empty"):
        usage = fleet.get("truck_usage") or []
        usage_trips = _sum_int(usage, "trip_count")
        summary_trips = int(fleet.get("summary", {}).get("total_trips") or 0)
        record(
            "fleet_trip_count_consistency",
            usage_trips == summary_trips,
            "Fleet truck usage trip counts must sum to total trips.",
            summary_trips,
            usage_trips,
        )

    drivers = payload.get("drivers") or {}
    if not drivers.get("empty"):
        drill = drivers.get("drilldown") or []
        summary_completed = int(drivers.get("summary", {}).get("total_completed") or 0)
        drill_completed = _sum_int(drill, "deliveries_completed")
        record(
            "drivers_completed_consistency",
            drill_completed == summary_completed,
            "Driver drill-down completed deliveries must match summary.",
            summary_completed,
            drill_completed,
        )

    return {"valid": ok, "checks": checks}
