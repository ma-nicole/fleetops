"""Executive overview and comparative analytics from real DB records."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

from app.services.admin_analytics import AnalyticsFilters, _activity_month, _collect_expense_records, _verified_revenue_rows


def _growth_pct(current: float, previous: float | None) -> float | None:
    if previous is None:
        return None
    if previous == 0:
        return round(100.0, 1) if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


def _trend(change_pct: float | None) -> str:
    if change_pct is None:
        return "flat"
    if change_pct > 0.5:
        return "up"
    if change_pct < -0.5:
        return "down"
    return "flat"


def _period_key(dt: date | datetime, granularity: str) -> str | None:
    if dt is None:
        return None
    d = dt.date() if isinstance(dt, datetime) else dt
    if granularity == "yearly":
        return str(d.year)
    if granularity == "quarterly":
        return f"{d.year}-Q{(d.month - 1) // 3 + 1}"
    if granularity == "monthly":
        return d.strftime("%Y-%m")
    if granularity == "weekly":
        iso = d.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    return None


def _series_from_buckets(buckets: dict[str, float], granularity: str, limit: int = 24) -> list[dict[str, Any]]:
    keys = sorted(buckets.keys())
    if granularity == "quarterly":
        keys = sorted(keys, key=lambda k: (int(k.split("-Q")[0]), int(k.split("-Q")[1])))
    elif granularity == "weekly":
        keys = sorted(keys, key=lambda k: (int(k.split("-W")[0]), int(k.split("-W")[1])))
    return [{"period": k, "value": round(buckets[k], 2)} for k in keys[-limit:]]


def _build_comparisons(series: list[dict[str, Any]], *, comparison_type: str) -> list[dict[str, Any]]:
    if len(series) < 2:
        return []
    comparisons: list[dict[str, Any]] = []
    current = series[-1]
    previous = series[-2]
    change = _growth_pct(float(current["value"]), float(previous["value"]))
    comparisons.append(
        {
            "type": comparison_type,
            "label": f"{current['period']} vs {previous['period']}",
            "current_period": current["period"],
            "previous_period": previous["period"],
            "current_value": current["value"],
            "previous_value": previous["value"],
            "change_pct": change,
            "trend": _trend(change),
        }
    )
    if comparison_type == "yearly" and len(series) >= 2:
        by_period = {s["period"]: s for s in series}
        cur_year = current["period"]
        try:
            prev_year = str(int(cur_year) - 1)
            if prev_year in by_period:
                prev = by_period[prev_year]
                yoy = _growth_pct(float(current["value"]), float(prev["value"]))
                comparisons.append(
                    {
                        "type": "year_over_year",
                        "label": f"{cur_year} vs {prev_year}",
                        "current_period": cur_year,
                        "previous_period": prev_year,
                        "current_value": current["value"],
                        "previous_value": prev["value"],
                        "change_pct": yoy,
                        "trend": _trend(yoy),
                    }
                )
        except ValueError:
            pass
    return comparisons


def _aggregate_revenue(ctx: dict, f: AnalyticsFilters) -> dict[str, dict[str, float]]:
    buckets: dict[str, dict[str, float]] = {
        "yearly": defaultdict(float),
        "quarterly": defaultdict(float),
        "monthly": defaultdict(float),
        "weekly": defaultdict(float),
    }
    for pay, _booking, _trip in _verified_revenue_rows(ctx, f):
        dt = pay.paid_at or pay.created_at
        amt = float(pay.amount or 0)
        for gran in buckets:
            key = _period_key(dt, gran) if dt else None
            if key:
                buckets[gran][key] += amt
    return buckets


def _aggregate_expenses(ctx: dict, f: AnalyticsFilters) -> dict[str, dict[str, float]]:
    buckets: dict[str, dict[str, float]] = {
        "yearly": defaultdict(float),
        "quarterly": defaultdict(float),
        "monthly": defaultdict(float),
        "weekly": defaultdict(float),
    }
    for rec in _collect_expense_records(ctx, f):
        raw = rec.get("expense_date")
        if not raw:
            continue
        try:
            d = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue
        amt = float(rec.get("amount_php") or 0)
        for gran in buckets:
            key = _period_key(d, gran)
            if key:
                buckets[gran][key] += amt
    return buckets


def _aggregate_deliveries(ctx: dict, f: AnalyticsFilters) -> dict[str, dict[str, float]]:
    from app.services.admin_analytics import _booking_in_filters, _primary_trip, _shipment_category

    buckets: dict[str, dict[str, float]] = {
        "yearly": defaultdict(float),
        "quarterly": defaultdict(float),
        "monthly": defaultdict(float),
        "weekly": defaultdict(float),
    }
    for booking in ctx["bookings"]:
        trip = _primary_trip(ctx, booking.id)
        if not _booking_in_filters(booking, trip, f):
            continue
        cat = _shipment_category(booking, trip, ctx["delay_logs"])
        if cat != "delivered":
            continue
        dt = booking.scheduled_date
        for gran in buckets:
            key = _period_key(dt, gran)
            if key:
                buckets[gran][key] += 1
    return buckets


def _metric_comparative(buckets: dict[str, dict[str, float]], *, value_format: str) -> dict[str, Any]:
    series_by_gran: dict[str, list[dict[str, Any]]] = {}
    comparisons_by_gran: dict[str, list[dict[str, Any]]] = {}
    for gran in ("weekly", "monthly", "quarterly", "yearly"):
        series = _series_from_buckets(buckets[gran], gran)
        series_by_gran[gran] = series
        comp_type = "year_over_year" if gran == "yearly" else "period_over_period"
        comparisons_by_gran[gran] = _build_comparisons(series, comparison_type=comp_type)
    return {
        "value_format": value_format,
        "granularity_options": ["weekly", "monthly", "quarterly", "yearly"],
        "series": series_by_gran,
        "comparisons": comparisons_by_gran,
    }


def build_comparative_analytics(ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    revenue_buckets = _aggregate_revenue(ctx, f)
    expense_buckets = _aggregate_expenses(ctx, f)
    delivery_buckets = _aggregate_deliveries(ctx, f)
    return {
        "revenue": _metric_comparative(revenue_buckets, value_format="php"),
        "expenses": _metric_comparative(expense_buckets, value_format="php"),
        "deliveries": _metric_comparative(delivery_buckets, value_format="count"),
    }


def build_executive_overview(
    ctx: dict,
    f: AnalyticsFilters,
    *,
    shipments: dict[str, Any],
    expenses: dict[str, Any],
    fleet: dict[str, Any],
    financial: dict[str, Any] | None,
) -> dict[str, Any]:
    kpis: list[dict[str, Any]] = []

    if not shipments.get("empty"):
        summary = shipments["summary"]
        success = summary.get("delivery_success_rate_pct")
        kpis.append(
            {
                "key": "delivery_success",
                "label": "Delivery Success",
                "value": success,
                "format": "percent",
                "subtitle": f"{summary.get('delivered', 0)} of {summary.get('total_shipments', 0)} delivered",
            }
        )

    if not fleet.get("empty"):
        util = fleet["summary"].get("fleet_utilization_rate_pct")
        kpis.append(
            {
                "key": "fleet_utilization",
                "label": "Fleet Utilization",
                "value": util,
                "format": "percent",
                "subtitle": f"{fleet['summary'].get('total_trips', 0)} trips across fleet",
            }
        )

    if not expenses.get("empty"):
        exp_summary = expenses["summary"]
        total_exp = float(exp_summary.get("total_operational_cost_php") or 0)
        fuel = float(exp_summary.get("fuel_expenses_php") or 0)
        fuel_pct = round((fuel / total_exp) * 100, 1) if total_exp > 0 else None
        kpis.append(
            {
                "key": "fuel_cost_share",
                "label": "Fuel Cost Share",
                "value": fuel_pct,
                "format": "percent",
                "subtitle": f"Fuel ₱{fuel:,.2f} of ₱{total_exp:,.2f} total",
            }
        )

    revenue_yearly = _series_from_buckets(_aggregate_revenue(ctx, f)["yearly"], "yearly")
    if revenue_yearly:
        current_rev = float(revenue_yearly[-1]["value"])
        prev_rev = float(revenue_yearly[-2]["value"]) if len(revenue_yearly) >= 2 else None
        rev_growth = _growth_pct(current_rev, prev_rev)
        kpis.insert(
            0,
            {
                "key": "revenue",
                "label": "Revenue",
                "value": round(current_rev, 2),
                "format": "php",
                "growth_pct": rev_growth,
                "trend": _trend(rev_growth),
                "subtitle": revenue_yearly[-1]["period"],
            },
        )

    if financial and not financial.get("empty"):
        profit = financial["summary"].get("profit_estimate_php")
        kpis.append(
            {
                "key": "profit_estimate",
                "label": "Profit Estimate",
                "value": profit,
                "format": "php",
                "subtitle": "Revenue minus operational expenses",
            }
        )

    return {"kpis": kpis}


def build_section_percentages(module: dict[str, Any], module_key: str) -> list[dict[str, Any]] | None:
    """Derive percentage breakdowns from existing module chart data."""
    if module.get("empty"):
        return None
    items: list[dict[str, Any]] = []
    if module_key == "shipments":
        dist = module.get("status_distribution") or []
        total = sum(int(x.get("count") or 0) for x in dist)
        if total <= 0:
            return None
        for row in dist:
            count = int(row.get("count") or 0)
            items.append(
                {
                    "label": str(row.get("status", "")).replace("_", " ").title(),
                    "value": count,
                    "percentage": round((count / total) * 100, 1),
                }
            )
    elif module_key == "expenses":
        breakdown = module.get("expense_breakdown") or []
        total = sum(float(x.get("amount_php") or 0) for x in breakdown)
        if total <= 0:
            return None
        for row in breakdown:
            amt = float(row.get("amount_php") or 0)
            items.append(
                {
                    "label": row.get("label") or row.get("key"),
                    "value": round(amt, 2),
                    "percentage": round((amt / total) * 100, 1),
                }
            )
    elif module_key == "financial":
        summary = module.get("category_summary") or []
        total_rev = float(module["summary"].get("total_revenue_php") or 0)
        for row in summary:
            amt = float(row.get("amount_php") or 0)
            pct = round((amt / total_rev) * 100, 1) if total_rev > 0 and row.get("category") != "expenses" else None
            if row.get("category") == "expenses" and total_rev > 0:
                pct = round((amt / total_rev) * 100, 1)
            items.append({"label": row.get("label"), "value": amt, "percentage": pct})
    return items or None
