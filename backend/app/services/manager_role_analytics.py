"""Table 10 — Manager/Admin role analytics (Planning through Performance Monitoring + Risk Management)."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
import math
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from app.models.entities import (
    BookingStatus,
    GeneralOperationalReport,
    OperationalLog,
    Trip,
    TripIssue,
    TripStatus,
    VehicleIssueReport,
)
from app.services.admin_analytics import (
    AnalyticsFilters,
    _activity_date,
    _delivery_hours,
    _filtered_trips,
    _maintenance_in_filters,
    _route_key,
    _shipment_category,
    _status_str,
    _trip_fuel,
    _trip_toll,
)
from app.services.analytics_stats import compute_statistics, empty_module
from app.services.analytics import maintenance_risk_snapshot
from app.services.predictive.demand_model import forecast_monthly_cost
from app.services.predictive.fuel_model import predict_fuel_consumption
from app.services.predictive.maintenance_model import predict_maintenance
from app.schemas.predict import FuelPredictRequest, MaintenancePredictRequest

BREAKDOWN_ISSUE_TYPES = frozenset({"breakdown", "mechanical", "accident", "vehicle", "engine"})

ACTIVE_TRIP = frozenset(
    {
        TripStatus.ASSIGNED,
        TripStatus.ACCEPTED,
        TripStatus.DEPARTED,
        TripStatus.LOADING,
        TripStatus.IN_DELIVERY,
    }
)


def _empty(message: str = "No data available yet.") -> dict[str, Any]:
    return {"empty": True, "message": message}


def _block(
    *,
    kpis: list[dict[str, str | float | int]],
    chart: list[dict] | None = None,
    drilldown: list[dict] | None = None,
    statistics: dict | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    drill_rows = drilldown or []

    def _auto_chart(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not rows:
            return []

        sample = rows[0]
        keys = list(sample.keys())
        if not keys:
            return []

        # 1) Status/category frequency chart.
        for key in ("status", "category", "severity", "issue_type"):
            if key in sample:
                counts: dict[str, int] = defaultdict(int)
                for r in rows:
                    counts[str(r.get(key) or "unknown")] += 1
                return [{key: k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])[:12]]

        # 2) Time trend chart using first numeric value by month.
        time_key = next((k for k in ("month", "date", "delivery_date", "scheduled_date", "period") if k in sample), None)
        numeric_keys = [k for k in keys if isinstance(sample.get(k), (int, float))]
        if time_key and numeric_keys:
            value_key = next((k for k in numeric_keys if any(token in k for token in ("cost", "amount", "hours", "liters", "count"))), numeric_keys[0])
            buckets: dict[str, float] = defaultdict(float)
            for r in rows:
                raw_time = r.get(time_key)
                if raw_time in (None, "", "—"):
                    continue
                t = str(raw_time)[:7] if time_key != "period" else str(raw_time)
                val = r.get(value_key)
                if isinstance(val, (int, float)):
                    buckets[t] += float(val)
            if buckets:
                return [{time_key: k, value_key: round(v, 2)} for k, v in sorted(buckets.items())[-12:]]

        # 3) Categorical + numeric aggregation.
        label_key = next((k for k in keys if isinstance(sample.get(k), str) and k not in {"route", "details"}), None)
        value_key = next((k for k in keys if isinstance(sample.get(k), (int, float))), None)
        if label_key and value_key:
            sums: dict[str, float] = defaultdict(float)
            for r in rows:
                label = str(r.get(label_key) or "unknown")
                val = r.get(value_key)
                if isinstance(val, (int, float)):
                    sums[label] += float(val)
            if sums:
                return [{label_key: k, value_key: round(v, 2)} for k, v in sorted(sums.items(), key=lambda x: -x[1])[:12]]

        # 4) Final fallback: count by first string key.
        fallback_label = next((k for k in keys if isinstance(sample.get(k), str)), None)
        if fallback_label:
            counts: dict[str, int] = defaultdict(int)
            for r in rows:
                counts[str(r.get(fallback_label) or "unknown")] += 1
            return [{fallback_label: k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])[:12]]

        return []

    resolved_chart = chart or _auto_chart(drill_rows)
    out: dict[str, Any] = {"kpis": kpis, "chart": resolved_chart, "drilldown": drill_rows}
    if statistics:
        out["statistics"] = statistics
    if note:
        out["note"] = note
    return out


def _trip_cost_rows(ctx: dict, f: AnalyticsFilters, limit: int = 50) -> list[dict]:
    rows: list[dict] = []
    for trip in _filtered_trips(ctx, f):
        if trip.status == TripStatus.CANCELLED:
            continue
        booking = trip.booking
        if not booking:
            continue
        fuel = _trip_fuel(trip, ctx["fuel_by_trip"])
        toll = _trip_toll(trip, ctx["toll_by_trip"])
        cost = (
            fuel
            + toll
            + float(trip.labor_cost or 0)
            + float(getattr(trip, "driver_allowance_php", 0) or 0)
            + float(getattr(trip, "helper_allowance_php", 0) or 0)
            + float(trip.maintenance_cost or 0)
        )
        ref = _activity_date(trip.completed_at or trip.assigned_at)
        rows.append(
            {
                "booking_id": booking.id,
                "trip_id": trip.id,
                "truck": trip.truck.code if trip.truck else "—",
                "driver": trip.driver.full_name if trip.driver else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location),
                "date": ref.isoformat() if ref else "—",
                "cost_php": round(cost, 2),
                "status": _status_str(trip.status),
            }
        )
    rows.sort(key=lambda r: (r["date"], r["trip_id"]), reverse=True)
    return rows[:limit]


def _monthly_series(values: list[tuple[str, float]], min_points: int = 3) -> pd.Series | None:
    if len(values) < min_points:
        return None
    frame = pd.DataFrame(values, columns=["month", "value"])
    return frame.groupby("month")["value"].sum().sort_index()


def _forecast_series(series: pd.Series, periods: int = 3) -> list[dict[str, float | str]] | None:
    if series is None or len(series) < 3:
        return None
    try:
        model = ExponentialSmoothing(series.values, trend="add").fit()
        prediction = model.forecast(periods)
    except Exception:
        avg = float(series.tail(3).mean())
        prediction = [avg] * periods
    # Avoid pandas out-of-bounds timestamps from malformed/future month labels.
    def _parse_month(raw: Any) -> tuple[int, int]:
        token = str(raw or "").strip()[:7]
        try:
            year_s, month_s = token.split("-")
            year = int(year_s)
            month = int(month_s)
            if year >= 1 and 1 <= month <= 12:
                return year, month
        except Exception:
            pass
        now = datetime.utcnow()
        return now.year, now.month

    def _add_months(year: int, month: int, delta: int) -> tuple[int, int]:
        total = (year * 12 + (month - 1)) + delta
        return total // 12, total % 12 + 1

    def _safe_float(value: Any, fallback: float) -> float:
        try:
            number = float(value)
        except Exception:
            return round(fallback, 2)
        if not math.isfinite(number):
            return round(fallback, 2)
        return round(number, 2)

    base_year, base_month = _parse_month(series.index[-1] if len(series.index) else None)
    fallback = float(series.tail(3).mean())
    points: list[dict[str, float | str]] = []
    for idx, pred in enumerate(prediction):
        year, month = _add_months(base_year, base_month, idx + 1)
        points.append(
            {
                "period": f"{year:04d}-{month:02d}",
                "value": _safe_float(pred, fallback),
            }
        )
    return points


def _fuel_liters_rows(ctx: dict, f: AnalyticsFilters, limit: int = 50) -> list[dict]:
    trip_by_id = {t.id: t for t in ctx["trips"]}
    filtered_ids = {t.id for t in _filtered_trips(ctx, f) if t.status != TripStatus.CANCELLED}
    rows: list[dict] = []
    for fl in ctx["fuel_logs"]:
        trip = trip_by_id.get(fl.trip_id)
        if not trip or trip.id not in filtered_ids:
            continue
        ref = _activity_date(fl.recorded_at)
        booking = trip.booking
        rows.append(
            {
                "booking_id": trip.booking_id,
                "trip_id": trip.id,
                "truck": trip.truck.code if trip.truck else "—",
                "driver": trip.driver.full_name if trip.driver else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
                "date": ref.isoformat() if ref else "—",
                "liters": round(float(fl.liters or 0), 2),
                "cost_php": round(float(fl.cost or 0), 2),
                "status": _status_str(trip.status),
            }
        )
    rows.sort(key=lambda r: r["date"], reverse=True)
    return rows[:limit]


def _empty_predict(message: str = "Insufficient data for prediction.") -> dict[str, Any]:
    return {"empty": True, "message": message}


def _is_breakdown_issue(issue_type: str | None) -> bool:
    token = (issue_type or "").lower().strip()
    return token in BREAKDOWN_ISSUE_TYPES or "breakdown" in token


def _build_risk_management_analytics(
    db: Session,
    ctx: dict,
    f: AnalyticsFilters,
    expenses: dict,
    routes: dict,
) -> dict[str, Any]:
    truck_map = {t.id: t.code for t in ctx["trucks"]}
    trip_by_id = {t.id: t for t in ctx["trips"]}
    filtered_trip_ids = {t.id for t in _filtered_trips(ctx, f)}

    # --- Descriptive: maintenance issue logs ---
    maint_rows: list[dict] = []
    for rec in ctx["maintenance"]:
        if not _maintenance_in_filters(rec, f):
            continue
        ref = _activity_date(rec.created_at)
        cost = float(rec.actual_cost or rec.estimated_cost or 0)
        maint_rows.append(
            {
                "maintenance_id": rec.id,
                "truck": truck_map.get(rec.truck_id, f"Truck #{rec.truck_id}"),
                "reported_issue": rec.reported_issue,
                "severity": rec.severity,
                "date": ref.isoformat() if ref else "—",
                "cost_php": round(cost, 2),
                "status": _status_str(rec.status),
                "next_service_date": rec.next_service_date.isoformat() if rec.next_service_date else "—",
            }
        )
    maint_rows.sort(key=lambda r: r["date"], reverse=True)
    sev_chart: dict[str, int] = defaultdict(int)
    for row in maint_rows:
        sev_chart[str(row["severity"])] += 1
    risk_desc_maint_logs = (
        _empty("No data available yet.")
        if not maint_rows
        else _block(
            kpis=[
                {"label": "Maintenance records", "value": len(maint_rows)},
                {"label": "High severity", "value": sum(1 for r in maint_rows if str(r["severity"]).lower() == "high")},
                {
                    "label": "Open / pending",
                    "value": sum(
                        1
                        for r in maint_rows
                        if str(r["status"]).lower() not in {"ok", "resolved", "completed"}
                    ),
                },
            ],
            chart=[{"severity": k, "count": v} for k, v in sorted(sev_chart.items())],
            drilldown=maint_rows[:50],
        )
    )

    # --- Descriptive: breakdown reports (vehicle issue reports + trip breakdown issues) ---
    breakdown_rows: list[dict] = []
    breakdown_by_truck: dict[int, int] = defaultdict(int)
    vehicle_reports = db.query(VehicleIssueReport).order_by(VehicleIssueReport.created_at.desc()).all()
    for vir in vehicle_reports:
        if vir.trip_id not in filtered_trip_ids:
            continue
        breakdown_by_truck[vir.truck_id] += 1
        trip = trip_by_id.get(vir.trip_id)
        booking = trip.booking if trip else None
        ref = _activity_date(vir.created_at)
        breakdown_rows.append(
            {
                "source": "vehicle_issue_report",
                "report_id": vir.id,
                "booking_id": vir.booking_id,
                "trip_id": vir.trip_id,
                "truck": truck_map.get(vir.truck_id, "—"),
                "driver": trip.driver.full_name if trip and trip.driver else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
                "date": ref.isoformat() if ref else "—",
                "issue_type": vir.issue_type,
                "priority": vir.priority,
                "status": _status_str(vir.status),
            }
        )

    trip_issues = db.query(TripIssue).order_by(TripIssue.created_at.desc()).all()
    for issue in trip_issues:
        if issue.trip_id not in filtered_trip_ids:
            continue
        if not _is_breakdown_issue(issue.issue_type):
            continue
        trip = trip_by_id.get(issue.trip_id)
        if trip and trip.truck_id:
            breakdown_by_truck[trip.truck_id] += 1
        booking = trip.booking if trip else None
        ref = _activity_date(issue.created_at)
        breakdown_rows.append(
            {
                "source": "trip_issue",
                "report_id": issue.id,
                "booking_id": trip.booking_id if trip else "—",
                "trip_id": issue.trip_id,
                "truck": trip.truck.code if trip and trip.truck else "—",
                "driver": trip.driver.full_name if trip and trip.driver else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
                "date": ref.isoformat() if ref else "—",
                "issue_type": issue.issue_type,
                "priority": issue.severity,
                "status": "resolved" if issue.resolved else "open",
            }
        )
    breakdown_rows.sort(key=lambda r: r["date"], reverse=True)
    type_chart: dict[str, int] = defaultdict(int)
    for row in breakdown_rows:
        type_chart[str(row["issue_type"])] += 1
    risk_desc_breakdown = (
        _empty("No data available yet.")
        if not breakdown_rows
        else _block(
            kpis=[
                {"label": "Breakdown reports", "value": len(breakdown_rows)},
                {"label": "Open issues", "value": sum(1 for r in breakdown_rows if str(r["status"]).lower() != "resolved")},
            ],
            chart=[{"issue_type": k, "count": v} for k, v in sorted(type_chart.items(), key=lambda x: -x[1])[:10]],
            drilldown=breakdown_rows[:50],
        )
    )

    # --- Descriptive: cost fluctuation ---
    monthly_trend = expenses.get("monthly_trend") or [] if not expenses.get("empty") else []
    fluctuation_chart: list[dict] = []
    fluctuation_vals: list[float] = []
    for i, bucket in enumerate(monthly_trend):
        total = float(bucket.get("total") or 0)
        prev = float(monthly_trend[i - 1].get("total") or 0) if i > 0 else None
        change_pct = round(((total - prev) / prev) * 100, 1) if prev and prev > 0 else None
        if change_pct is not None:
            fluctuation_vals.append(change_pct)
        fluctuation_chart.append(
            {
                "month": bucket["month"],
                "total_cost_php": round(total, 2),
                "change_pct": change_pct if change_pct is not None else 0,
            }
        )
    expense_records = ((expenses.get("drilldown") or {}).get("records") or []) if not expenses.get("empty") else []
    cost_drilldown = [
        {
            "booking_id": rec.get("booking_id"),
            "trip_id": rec.get("trip_id"),
            "truck": rec.get("truck_code") or "—",
            "date": rec.get("expense_date"),
            "cost_php": rec.get("amount_php"),
            "category": rec.get("category"),
            "status": rec.get("source_type"),
        }
        for rec in expense_records[:50]
    ]
    risk_desc_cost_fluct = (
        _empty("No data available yet.")
        if len(fluctuation_chart) < 2
        else _block(
            kpis=[
                {"label": "Months tracked", "value": len(fluctuation_chart)},
                {
                    "label": "Latest total (₱)",
                    "value": fluctuation_chart[-1]["total_cost_php"],
                },
                {
                    "label": "Latest change %",
                    "value": fluctuation_chart[-1]["change_pct"]
                    if len(fluctuation_chart) >= 2
                    else "Insufficient data",
                },
            ],
            chart=fluctuation_chart,
            drilldown=cost_drilldown,
            statistics=compute_statistics(fluctuation_vals, min_samples=2) if len(fluctuation_vals) >= 2 else None,
            note="Operational cost month-over-month from verified expense records.",
        )
    )

    # --- Predictive: maintenance failure ---
    maint_by_truck: dict[int, list] = defaultdict(list)
    for rec in ctx["maintenance"]:
        maint_by_truck[rec.truck_id].append(rec)
    trips_by_truck: dict[int, int] = defaultdict(int)
    for trip in ctx["trips"]:
        if trip.truck_id:
            trips_by_truck[trip.truck_id] += 1

    failure_rows: list[dict] = []
    for truck in ctx["trucks"]:
        if f.truck_id and truck.id != f.truck_id:
            continue
        maint_count = len(maint_by_truck[truck.id])
        breakdown_count = breakdown_by_truck[truck.id]
        trip_count = trips_by_truck[truck.id]
        if maint_count == 0 and breakdown_count == 0 and trip_count == 0:
            continue
        recurring = maint_count >= 2 or breakdown_count >= 2
        base_cost = (
            sum(float(r.estimated_cost or r.actual_cost or 0) for r in maint_by_truck[truck.id]) / maint_count
            if maint_count
            else 5000.0
        )
        pred = predict_maintenance(
            MaintenancePredictRequest(
                vehicle_id=truck.id,
                mileage_km=float(truck.odometer_km or 0),
                age_years=float(truck.age_years or 1),
                has_recurring_issue=recurring,
                base_maintenance_cost=float(base_cost),
            )
        )
        failure_rows.append(
            {
                "truck": truck.code,
                "trip_count": trip_count,
                "maintenance_records": maint_count,
                "breakdown_reports": breakdown_count,
                "risk_score": pred.risk_score,
                "priority": pred.priority_level,
                "next_service_days": pred.next_service_in_days,
                "estimated_cost_php": pred.estimated_cost,
                "status": pred.priority_level,
            }
        )
    failure_rows.sort(key=lambda r: float(r["risk_score"]), reverse=True)
    risk_pred_failure = (
        _empty_predict()
        if not failure_rows
        else _block(
            kpis=[
                {"label": "Vehicles scored", "value": len(failure_rows)},
                {"label": "High risk", "value": sum(1 for r in failure_rows if r["priority"] == "high_risk")},
            ],
            chart=[{"truck": r["truck"], "risk_score": r["risk_score"]} for r in failure_rows[:12]],
            drilldown=failure_rows[:50],
            note="Rule-based maintenance model using odometer, age, maintenance history, and breakdown frequency.",
        )
    )

    # --- Predictive: operational disruption ---
    disruption_sources: list[dict] = []
    for trip_id, reason in ctx["delay_logs"].items():
        if trip_id not in filtered_trip_ids:
            continue
        trip = trip_by_id.get(trip_id)
        if not trip:
            continue
        booking = trip.booking
        ref = _activity_date(trip.estimated_delivery_time or trip.completed_at or trip.assigned_at)
        disruption_sources.append(
            {
                "booking_id": trip.booking_id,
                "trip_id": trip.id,
                "truck": trip.truck.code if trip.truck else "—",
                "driver": trip.driver.full_name if trip.driver else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
                "date": ref.isoformat() if ref else "—",
                "cause": reason,
                "status": "delay",
            }
        )

    for trip in _filtered_trips(ctx, f):
        if trip.status != TripStatus.CANCELLED:
            continue
        booking = trip.booking
        ref = _activity_date(trip.completed_at or trip.assigned_at)
        disruption_sources.append(
            {
                "booking_id": trip.booking_id,
                "trip_id": trip.id,
                "truck": trip.truck.code if trip.truck else "—",
                "driver": trip.driver.full_name if trip.driver else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
                "date": ref.isoformat() if ref else "—",
                "cause": "Trip cancelled",
                "status": "cancelled",
            }
        )

    for row in breakdown_rows:
        disruption_sources.append(
            {
                "booking_id": row.get("booking_id"),
                "trip_id": row.get("trip_id"),
                "truck": row.get("truck"),
                "driver": row.get("driver"),
                "route": row.get("route"),
                "date": row.get("date"),
                "cause": f"Breakdown: {row.get('issue_type')}",
                "status": "breakdown",
            }
        )

    route_perf = routes.get("performance") or [] if not routes.get("empty") else []
    route_issue_rows: list[dict] = []
    for perf in route_perf:
        delayed = int(perf.get("delayed_count") or 0)
        if delayed <= 0:
            continue
        route_issue_rows.append(
            {
                "route": perf.get("route"),
                "deliveries": perf.get("deliveries"),
                "delayed_count": delayed,
                "total_cost_php": perf.get("total_cost_php"),
                "status": "route_delay_pattern",
            }
        )

    month_disruptions: dict[str, int] = defaultdict(int)
    for src in disruption_sources:
        d = src.get("date")
        if d and d != "—":
            month_disruptions[str(d)[:7]] += 1
    disruption_series = _monthly_series([(m, float(c)) for m, c in sorted(month_disruptions.items())], min_points=2)
    disruption_forecast = _forecast_series(disruption_series, 3) if disruption_series is not None else None

    route_risk_chart: list[dict] = []
    route_buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"delays": 0, "breakdowns": 0, "cancelled": 0})
    for src in disruption_sources:
        route = str(src.get("route") or "Unknown")
        status = str(src.get("status") or "")
        if status == "delay":
            route_buckets[route]["delays"] += 1
        elif status == "breakdown":
            route_buckets[route]["breakdowns"] += 1
        elif status == "cancelled":
            route_buckets[route]["cancelled"] += 1
    for route, stats in route_buckets.items():
        score = stats["delays"] + stats["breakdowns"] * 2 + stats["cancelled"]
        route_risk_chart.append(
            {
                "route": route[:48] + ("…" if len(route) > 48 else ""),
                "disruption_score": score,
                "delay_events": stats["delays"],
                "breakdown_events": stats["breakdowns"],
                "cancelled_trips": stats["cancelled"],
            }
        )
    route_risk_chart.sort(key=lambda r: r["disruption_score"], reverse=True)

    has_disruption_data = bool(disruption_sources or route_issue_rows)
    risk_pred_disruption = (
        _empty_predict()
        if not has_disruption_data
        else _block(
            kpis=[
                {"label": "Disruption events", "value": len(disruption_sources)},
                {"label": "Routes with delays", "value": len(route_issue_rows)},
                {
                    "label": "Next period events (est.)",
                    "value": disruption_forecast[0]["value"] if disruption_forecast else "Insufficient data",
                },
            ],
            chart=(disruption_forecast and [{"period": p["period"], "forecast_events": p["value"]} for p in disruption_forecast])
            or route_risk_chart[:12],
            drilldown=(disruption_sources[:40] + route_issue_rows[:10])[:50],
            note="Combines delay logs, cancelled trips, breakdown reports, and route delay patterns.",
        )
    )

    return {
        "descriptive": {
            "maintenance_issue_logs": risk_desc_maint_logs,
            "breakdown_reports": risk_desc_breakdown,
            "cost_fluctuation": risk_desc_cost_fluct,
        },
        "predictive": {
            "maintenance_failure": risk_pred_failure,
            "operational_disruption": risk_pred_disruption,
        },
    }


def build_manager_role_analytics(
    db: Session,
    ctx: dict,
    f: AnalyticsFilters,
    *,
    shipments: dict,
    expenses: dict,
    fleet: dict,
    drivers: dict,
    routes: dict,
) -> dict[str, Any]:
    trip_rows = _trip_cost_rows(ctx, f)
    cost_vals = [float(r["cost_php"]) for r in trip_rows if r["cost_php"]]

    # --- Monthly trip cost trend ---
    monthly_cost: dict[str, float] = defaultdict(float)
    for r in trip_rows:
        if r["date"] != "—":
            monthly_cost[r["date"][:7]] += float(r["cost_php"])
    cost_chart = [{"month": m, "total_cost_php": round(v, 2)} for m, v in sorted(monthly_cost.items())[-12:]]

    fuel_rows = _fuel_liters_rows(ctx, f)
    total_liters = sum(float(r["liters"]) for r in fuel_rows)
    fuel_spend = float(expenses.get("summary", {}).get("fuel_expenses_php", 0)) if not expenses.get("empty") else 0

    # --- PLANNING ---
    planning_desc_historical = (
        _empty("No data available yet.")
        if not trip_rows
        else _block(
            kpis=[
                {"label": "Trips in scope", "value": len(trip_rows)},
                {"label": "Total trip cost", "value": round(sum(cost_vals), 2)},
                {"label": "Avg cost / trip", "value": round(sum(cost_vals) / len(cost_vals), 2) if cost_vals else "Insufficient data"},
            ],
            chart=cost_chart,
            drilldown=trip_rows,
            statistics=compute_statistics(cost_vals, min_samples=1),
        )
    )

    planning_desc_fuel = (
        _empty("No data available yet.")
        if not fuel_rows and fuel_spend <= 0
        else _block(
            kpis=[
                {"label": "Fuel logs", "value": len(fuel_rows)},
                {"label": "Total liters", "value": round(total_liters, 2) if total_liters else "Insufficient data"},
                {"label": "Fuel spend (₱)", "value": round(fuel_spend, 2)},
            ],
            chart=[{"truck": r["truck"], "liters": r["liters"]} for r in fuel_rows[:12]],
            drilldown=fuel_rows,
            statistics=compute_statistics([float(r["liters"]) for r in fuel_rows if r["liters"] > 0], min_samples=1)
            if fuel_rows
            else None,
        )
    )

    fleet_summary = fleet.get("summary") or {}
    planning_desc_fleet = (
        _empty(fleet.get("message", "No data available yet."))
        if fleet.get("empty")
        else _block(
            kpis=[
                {"label": "Fleet size", "value": fleet_summary.get("fleet_size", "—")},
                {"label": "Utilization %", "value": fleet_summary.get("fleet_utilization_rate_pct", "—")},
                {"label": "Total trips", "value": fleet_summary.get("total_trips", "—")},
            ],
            chart=fleet.get("truck_usage") or [],
            drilldown=fleet.get("drilldown") or [],
            statistics=fleet.get("statistics"),
        )
    )

    cost_forecast_resp = forecast_monthly_cost(db, periods=6)
    planning_pred_cost = (
        {"empty": True, "message": "Insufficient data.", "chart": [], "drilldown": []}
        if not cost_forecast_resp.points
        else _block(
            kpis=[{"label": "Next horizon", "value": cost_forecast_resp.points[0].period if cost_forecast_resp.points else "—"}],
            chart=[{"period": p.period, "forecast_cost_php": p.value} for p in cost_forecast_resp.points],
            drilldown=[],
            note="Forecast from completed trip cost time series (Holt-Winters).",
        )
    )

    # Fuel prediction sample from fleet avg trip profile
    completed = [t for t in _filtered_trips(ctx, f) if t.status == TripStatus.COMPLETED and (t.distance_km or 0) > 0]
    if completed:
        avg_dist = sum(float(t.distance_km or 0) for t in completed) / len(completed)
        avg_load = 5.0
        sample_truck = next((t.truck for t in completed if t.truck and t.truck.fuel_efficiency_kmpl), None)
        pred = predict_fuel_consumption(
            FuelPredictRequest(
                distance_km=avg_dist,
                cargo_weight_tons=avg_load,
                avg_speed_kmh=45,
                road_condition="highway",
                vehicle_fuel_efficiency_kmpl=float(sample_truck.fuel_efficiency_kmpl) if sample_truck else 4.0,
            )
        )
        planning_pred_fuel = _block(
            kpis=[
                {"label": "Sample distance (km)", "value": round(avg_dist, 1)},
                {"label": "Predicted liters", "value": round(pred.fuel_liters, 2)},
                {"label": "Predicted fuel cost (₱)", "value": round(pred.fuel_cost, 2)},
            ],
            chart=[],
            drilldown=[],
            note="Rule-based fuel model using fleet average trip distance.",
        )
    else:
        planning_pred_fuel = _empty("Insufficient data.")

    completed_trips = [t for t in ctx["trips"] if t.completed_at]
    trip_month_counts: list[tuple[str, float]] = []
    month_buckets: dict[str, int] = defaultdict(int)
    for t in completed_trips:
        m = t.completed_at.strftime("%Y-%m")
        month_buckets[m] += 1
    trip_month_counts = sorted(month_buckets.items())
    demand_series = _monthly_series(trip_month_counts, min_points=3)
    demand_forecast = _forecast_series(demand_series, 3) if demand_series is not None else None
    planning_pred_demand = (
        _empty("Insufficient data.")
        if not demand_forecast
        else _block(
            kpis=[{"label": "Next period trips (est.)", "value": demand_forecast[0]["value"]}],
            chart=[{"period": p["period"], "forecast_trips": p["value"]} for p in demand_forecast],
            drilldown=[],
            note="Trip volume forecast from completed trip counts by month.",
        )
    )

    # --- ORGANIZING ---
    assignment_rows: list[dict] = []
    for trip in _filtered_trips(ctx, f):
        if not trip.driver_id:
            continue
        booking = trip.booking
        if not booking:
            continue
        ref = _activity_date(trip.assigned_at or trip.completed_at)
        assignment_rows.append(
            {
                "booking_id": booking.id,
                "trip_id": trip.id,
                "truck": trip.truck.code if trip.truck else "—",
                "driver": trip.driver.full_name if trip.driver else "—",
                "helper": trip.helper.full_name if trip.helper else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location),
                "date": ref.isoformat() if ref else "—",
                "status": _status_str(trip.status),
            }
        )
    assignment_rows.sort(key=lambda r: r["date"], reverse=True)

    organizing_desc_assignments = (
        _empty("No data available yet.")
        if not assignment_rows
        else _block(
            kpis=[{"label": "Assignments", "value": len(assignment_rows)}],
            chart=[],
            drilldown=assignment_rows[:50],
        )
    )

    organizing_desc_trucks = planning_desc_fleet

    route_summary = routes.get("summary") or {}
    organizing_desc_routes = (
        _empty(routes.get("message", "No data available yet."))
        if routes.get("empty")
        else _block(
            kpis=[
                {"label": "Routes tracked", "value": route_summary.get("route_count", len(routes.get("performance") or []))},
                {"label": "Total deliveries", "value": route_summary.get("total_deliveries", "—")},
            ],
            chart=routes.get("performance") or [],
            drilldown=routes.get("drilldown") or routes.get("performance") or [],
            statistics=routes.get("statistics"),
        )
    )

    pending_bookings = sum(
        1
        for b in ctx["bookings"]
        if _status_str(b.status) in {BookingStatus.APPROVED.value, BookingStatus.READY_FOR_ASSIGNMENT.value}
    )
    available_trucks = sum(1 for t in ctx["trucks"] if (t.status or "available") not in ("maintenance", "inactive"))
    organizing_pred_allocation = _block(
        kpis=[
            {"label": "Pending assignments", "value": pending_bookings},
            {"label": "Available trucks", "value": available_trucks},
            {"label": "Capacity gap", "value": max(0, pending_bookings - available_trucks)},
        ],
        chart=[],
        drilldown=[],
        note="Use Job assignment module for full recommend-assignment scoring.",
    )

    driver_month: dict[str, set[int]] = defaultdict(set)
    for trip in _filtered_trips(ctx, f):
        if trip.driver_id and trip.completed_at:
            driver_month[trip.completed_at.strftime("%Y-%m")].add(trip.driver_id)
    workforce_counts = sorted((m, len(d)) for m, d in driver_month.items())
    workforce_series = _monthly_series([(m, float(c)) for m, c in workforce_counts], min_points=3)
    workforce_forecast = _forecast_series(workforce_series, 3) if workforce_series is not None else None
    organizing_pred_workforce = (
        _empty("Insufficient data.")
        if not workforce_forecast
        else _block(
            kpis=[{"label": "Drivers needed (est.)", "value": workforce_forecast[0]["value"]}],
            chart=[{"period": p["period"], "forecast_drivers": p["value"]} for p in workforce_forecast],
            drilldown=[],
            note="Unique drivers per month trend extrapolation.",
        )
    )

    # --- EXECUTION ---
    active_rows: list[dict] = []
    filtered_trip_ids = {t.id for t in _filtered_trips(ctx, f)}
    for trip in ctx["trips"]:
        if trip.id not in filtered_trip_ids:
            continue
        if _status_str(trip.status) not in {s.value for s in ACTIVE_TRIP}:
            continue
        booking = trip.booking
        active_rows.append(
            {
                "booking_id": trip.booking_id,
                "trip_id": trip.id,
                "truck": trip.truck.code if trip.truck else "—",
                "driver": trip.driver.full_name if trip.driver else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
                "date": _activity_date(trip.assigned_at).isoformat() if _activity_date(trip.assigned_at) else "—",
                "status": _status_str(trip.status),
            }
        )

    execution_desc_active = (
        _empty("No data available yet.")
        if not active_rows
        else _block(
            kpis=[{"label": "Active trips", "value": len(active_rows)}],
            chart=[],
            drilldown=active_rows,
        )
    )

    ship_summary = shipments.get("summary") or {}
    execution_desc_delivery = (
        _empty(shipments.get("message", "No data available yet."))
        if shipments.get("empty")
        else _block(
            kpis=[
                {"label": "Total shipments", "value": ship_summary.get("total_shipments", "—")},
                {"label": "Delivered", "value": ship_summary.get("delivered", "—")},
                {"label": "In transit", "value": ship_summary.get("in_transit", "—")},
            ],
            chart=shipments.get("status_distribution") or [],
            drilldown=shipments.get("drilldown") or [],
            statistics=shipments.get("statistics"),
        )
    )

    log_rows: list[dict] = []
    for log in db.query(OperationalLog).order_by(OperationalLog.created_at.desc()).limit(50).all():
        log_rows.append(
            {
                "trip_id": log.trip_id,
                "report_type": log.report_type,
                "date": _activity_date(log.created_at).isoformat() if log.created_at else "—",
                "details": (log.operational_details or "")[:120],
                "status": "logged",
            }
        )
    for rep in db.query(GeneralOperationalReport).order_by(GeneralOperationalReport.created_at.desc()).limit(30).all():
        log_rows.append(
            {
                "trip_id": rep.trip_id,
                "report_type": rep.category,
                "date": _activity_date(rep.created_at).isoformat() if rep.created_at else "—",
                "details": (rep.description or "")[:120],
                "status": rep.status or "—",
            }
        )
    execution_desc_logs = (
        _empty("No data available yet.")
        if not log_rows
        else _block(
            kpis=[{"label": "Log entries", "value": len(log_rows)}],
            chart=[],
            drilldown=log_rows[:50],
        )
    )

    delay_candidates: list[dict] = []
    now = datetime.utcnow()
    for trip in ctx["trips"]:
        booking = trip.booking
        if not booking:
            continue
        reason = None
        if trip.estimated_delivery_time and trip.estimated_delivery_time < now and trip.status != TripStatus.COMPLETED:
            reason = "Past ETA (in progress)"
        elif trip.id in ctx["delay_logs"]:
            reason = ctx["delay_logs"][trip.id]
        if reason:
            delay_candidates.append(
                {
                    "booking_id": trip.booking_id,
                    "trip_id": trip.id,
                    "truck": trip.truck.code if trip.truck else "—",
                    "driver": trip.driver.full_name if trip.driver else "—",
                    "route": _route_key(booking.pickup_location, booking.dropoff_location),
                    "date": _activity_date(trip.estimated_delivery_time).isoformat() if trip.estimated_delivery_time else "—",
                    "status": reason,
                }
            )
    total_ship = int(ship_summary.get("total_shipments") or 0) if not shipments.get("empty") else 0
    delayed = int(ship_summary.get("delayed") or 0) if not shipments.get("empty") else 0
    delay_rate = round((delayed / total_ship) * 100, 1) if total_ship else None
    execution_pred_delay = (
        _empty("Insufficient data.")
        if not delay_candidates and delay_rate is None
        else _block(
            kpis=[
                {"label": "At-risk / delayed trips", "value": len(delay_candidates)},
                {"label": "Historical delay rate %", "value": delay_rate if delay_rate is not None else "Insufficient data"},
            ],
            chart=[],
            drilldown=delay_candidates[:50],
            note="Delay signals from ETA breach and operational delay logs.",
        )
    )

    route_eff_rows = []
    for r in (routes.get("performance") or []):
        dist = float(r.get("distance_km") or 0)
        cost = float(r.get("total_cost_php") or 0)
        route_eff_rows.append(
            {
                "route": r.get("route"),
                "cost_per_km": round(cost / dist, 2) if dist > 0 else None,
                "avg_delivery_hours": r.get("avg_delivery_hours"),
                "deliveries": r.get("deliveries"),
            }
        )
    execution_pred_route = (
        _empty("No data available yet.")
        if not route_eff_rows
        else _block(
            kpis=[
                {
                    "label": "Best cost/km route",
                    "value": min(
                        (x for x in route_eff_rows if x["cost_per_km"]),
                        key=lambda x: x["cost_per_km"],
                        default={"route": "—"},
                    ).get("route", "—"),
                }
            ],
            chart=route_eff_rows[:12],
            drilldown=route_eff_rows,
            note="Lower cost/km indicates higher route efficiency.",
        )
    )

    # --- CONTROLLING ---
    driver_summary = drivers.get("summary") or {}
    controlling_desc_performance = (
        _empty(drivers.get("message", "No data available yet."))
        if drivers.get("empty")
        else _block(
            kpis=[
                {"label": "Drivers tracked", "value": driver_summary.get("driver_count", "—")},
                {"label": "Completed deliveries", "value": driver_summary.get("total_completed", "—")},
                {"label": "Delayed", "value": driver_summary.get("total_delayed", "—")},
            ],
            chart=drivers.get("ranking") or [],
            drilldown=drivers.get("drilldown") or [],
            statistics=drivers.get("statistics"),
        )
    )

    maint_rows = maintenance_risk_snapshot(db)
    controlling_desc_maintenance = (
        _empty("No data available yet.")
        if not maint_rows
        else _block(
            kpis=[
                {"label": "Maintenance items", "value": len(maint_rows)},
                {"label": "High risk", "value": sum(1 for m in maint_rows if (m.get("severity") or "").lower() == "high")},
            ],
            chart=maint_rows[:10],
            drilldown=maint_rows,
        )
    )

    controlling_desc_costs = (
        _empty(expenses.get("message", "No data available yet."))
        if expenses.get("empty")
        else _block(
            kpis=[
                {"label": "Total operational cost", "value": expenses.get("summary", {}).get("total_operational_cost_php", "—")},
            ],
            chart=expenses.get("monthly_totals") or [],
            drilldown=(expenses.get("drilldown") or {}).get("records") or [],
        )
    )

    controlling_pred_maint = controlling_desc_maintenance

    overrun_rows: list[dict] = []
    for trip in ctx["trips"]:
        pred = float(trip.predicted_total_cost or 0)
        if pred <= 0 or trip.status != TripStatus.COMPLETED:
            continue
        actual = (
            _trip_fuel(trip, ctx["fuel_by_trip"])
            + _trip_toll(trip, ctx["toll_by_trip"])
            + float(trip.labor_cost or 0)
        )
        delta = actual - pred
        if abs(delta) < 1:
            continue
        booking = trip.booking
        overrun_rows.append(
            {
                "booking_id": trip.booking_id,
                "trip_id": trip.id,
                "truck": trip.truck.code if trip.truck else "—",
                "driver": trip.driver.full_name if trip.driver else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
                "date": _activity_date(trip.completed_at).isoformat() if trip.completed_at else "—",
                "predicted_php": round(pred, 2),
                "actual_php": round(actual, 2),
                "variance_php": round(delta, 2),
                "status": "overrun" if delta > 0 else "under",
            }
        )
    avg_overrun = (
        round(sum(float(r["variance_php"]) for r in overrun_rows) / len(overrun_rows), 2) if overrun_rows else None
    )
    controlling_pred_overrun = (
        _empty("Insufficient data.")
        if not overrun_rows
        else _block(
            kpis=[
                {"label": "Trips with variance", "value": len(overrun_rows)},
                {"label": "Avg variance (₱)", "value": avg_overrun},
            ],
            chart=[],
            drilldown=overrun_rows[:50],
            note="Predicted vs actual cost on completed trips with stored predictions.",
        )
    )

    # --- PERFORMANCE MONITORING ---
    success_rate = ship_summary.get("delivery_success_rate_pct") if not shipments.get("empty") else None
    perf_desc_success = execution_desc_delivery

    eff_rows: list[dict] = []
    trip_by_id = {t.id: t for t in ctx["trips"]}
    for fl in ctx["fuel_logs"]:
        trip = trip_by_id.get(fl.trip_id)
        if not trip or not (trip.distance_km and fl.liters and fl.liters > 0):
            continue
        kmpl = float(trip.distance_km) / float(fl.liters)
        eff_rows.append(
            {
                "trip_id": trip.id,
                "booking_id": trip.booking_id,
                "truck": trip.truck.code if trip.truck else "—",
                "driver": trip.driver.full_name if trip.driver else "—",
                "date": _activity_date(fl.recorded_at).isoformat() if fl.recorded_at else "—",
                "km_per_liter": round(kmpl, 2),
                "distance_km": round(float(trip.distance_km), 2),
                "liters": round(float(fl.liters), 2),
            }
        )
    perf_desc_fuel_eff = (
        _empty("Insufficient data.")
        if not eff_rows
        else _block(
            kpis=[
                {
                    "label": "Avg km/L",
                    "value": round(sum(r["km_per_liter"] for r in eff_rows) / len(eff_rows), 2),
                },
                {"label": "Samples", "value": len(eff_rows)},
            ],
            chart=eff_rows[:12],
            drilldown=eff_rows[:50],
            statistics=compute_statistics([r["km_per_liter"] for r in eff_rows], min_samples=1),
        )
    )

    perf_desc_maint_freq = controlling_desc_maintenance

    monthly_del = shipments.get("monthly_deliveries") or []
    fleet_util = fleet_summary.get("fleet_utilization_rate_pct") if not fleet.get("empty") else None
    perf_pred_trend = (
        _empty("Insufficient data.")
        if not monthly_del and fleet_util is None
        else _block(
            kpis=[
                {"label": "Fleet utilization %", "value": fleet_util if fleet_util is not None else "Insufficient data"},
            ],
            chart=monthly_del,
            drilldown=[],
            note="Monthly delivery trend and current fleet utilization.",
        )
    )

    kmpl_trend: dict[str, list[float]] = defaultdict(list)
    for r in eff_rows:
        if r["date"] != "—":
            kmpl_trend[r["date"][:7]].append(float(r["km_per_liter"]))
    eff_chart = [
        {"month": m, "avg_km_per_liter": round(sum(v) / len(v), 2)} for m, v in sorted(kmpl_trend.items())[-12:]
    ]
    perf_pred_efficiency = (
        _empty("Insufficient data.")
        if len(eff_chart) < 2
        else _block(
            kpis=[
                {
                    "label": "Latest km/L",
                    "value": eff_chart[-1]["avg_km_per_liter"],
                },
                {
                    "label": "Prior km/L",
                    "value": eff_chart[-2]["avg_km_per_liter"],
                },
            ],
            chart=eff_chart,
            drilldown=eff_rows[:50],
            note="Month-over-month fuel efficiency trend from fuel logs and trip distance.",
        )
    )

    risk_management = _build_risk_management_analytics(db, ctx, f, expenses, routes)

    return {
        "planning": {
            "descriptive": {
                "historical_trip_costs": planning_desc_historical,
                "fuel_consumption": planning_desc_fuel,
                "fleet_usage": planning_desc_fleet,
            },
            "predictive": {
                "cost_forecasting": planning_pred_cost,
                "fuel_prediction": planning_pred_fuel,
                "fleet_demand_forecasting": planning_pred_demand,
            },
        },
        "organizing": {
            "descriptive": {
                "driver_assignments": organizing_desc_assignments,
                "truck_utilization": organizing_desc_trucks,
                "route_histories": organizing_desc_routes,
            },
            "predictive": {
                "fleet_allocation": organizing_pred_allocation,
                "workforce_demand": organizing_pred_workforce,
            },
        },
        "execution": {
            "descriptive": {
                "active_trips": execution_desc_active,
                "delivery_status": execution_desc_delivery,
                "operational_logs": execution_desc_logs,
            },
            "predictive": {
                "delay_prediction": execution_pred_delay,
                "route_efficiency": execution_pred_route,
            },
        },
        "controlling": {
            "descriptive": {
                "performance_reports": controlling_desc_performance,
                "maintenance_records": controlling_desc_maintenance,
                "operational_costs": controlling_desc_costs,
            },
            "predictive": {
                "maintenance_risk": controlling_pred_maint,
                "cost_overrun": controlling_pred_overrun,
            },
        },
        "performance_monitoring": {
            "descriptive": {
                "delivery_success": perf_desc_success,
                "fuel_efficiency": perf_desc_fuel_eff,
                "maintenance_frequency": perf_desc_maint_freq,
            },
            "predictive": {
                "fleet_performance_trend": perf_pred_trend,
                "efficiency_improvement": perf_pred_efficiency,
            },
        },
        "risk_management": risk_management,
    }
