"""Table 10 — Manager/Admin role analytics (Planning through Performance Monitoring + Risk Management)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
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
from app.services.time_bucket import advance_period, period_chart_row, period_key, sort_period_keys
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
        for key in (
            "issue_type",
            "severity",
            "report_type",
            "priority_level",
            "service_type",
            "truck_code",
            "driver_name",
            "route",
            "status",
            "category",
        ):
            if key in sample:
                counts: dict[str, int] = defaultdict(int)
                for r in rows:
                    counts[str(r.get(key) or "unknown")] += 1
                return [{key: k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])[:12]]

        # 2) Time trend chart using first numeric value by period/month.
        time_key = next((k for k in ("period", "month", "date", "delivery_date", "scheduled_date") if k in sample), None)
        numeric_keys = [k for k in keys if isinstance(sample.get(k), (int, float))]
        if time_key and numeric_keys:
            value_key = next((k for k in numeric_keys if any(token in k for token in ("cost", "amount", "hours", "liters", "count"))), numeric_keys[0])
            buckets: dict[str, float] = defaultdict(float)
            for r in rows:
                raw_time = r.get(time_key)
                if raw_time in (None, "", "—"):
                    continue
                t = str(raw_time) if time_key == "period" else str(raw_time)[:7]
                val = r.get(value_key)
                if isinstance(val, (int, float)):
                    buckets[t] += float(val)
            if buckets:
                axis = "period" if time_key == "period" else time_key
                return [{axis: k, value_key: round(v, 2), **({"month": k} if axis == "period" and len(k) == 7 else {})} for k, v in sorted(buckets.items())[-24:]]

        # 3) Categorical + numeric aggregation.
        label_key = next(
            (k for k in ("truck_code", "driver_name", "route", "issue_type", "service_type", "client_name") + tuple(keys) if k in sample and isinstance(sample.get(k), str)),
            None,
        )
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


def _min_series_points(f: AnalyticsFilters, default: int = 3) -> int:
    return 2 if f.granularity in ("yearly", "quarterly") else default


def _period_series(values: list[tuple[str, float]], min_points: int = 3) -> pd.Series | None:
    if len(values) < min_points:
        return None
    frame = pd.DataFrame(values, columns=["period", "value"])
    return frame.groupby("period")["value"].sum().sort_index()


def _monthly_series(values: list[tuple[str, float]], min_points: int = 3) -> pd.Series | None:
    """Backward-compatible alias for period series built from monthly keys."""
    return _period_series(values, min_points=min_points)


def _forecast_series(
    series: pd.Series,
    periods: int = 3,
    *,
    granularity: str = "monthly",
) -> list[dict[str, float | str]] | None:
    if series is None or len(series) < 3:
        return None
    try:
        model = ExponentialSmoothing(series.values, trend="add").fit()
        prediction = model.forecast(periods)
    except Exception:
        avg = float(series.tail(3).mean())
        prediction = [avg] * periods
    def _safe_float(value: Any, fallback: float) -> float:
        try:
            number = float(value)
        except Exception:
            return round(fallback, 2)
        if not math.isfinite(number):
            return round(fallback, 2)
        return round(number, 2)

    last_period = str(series.index[-1] if len(series.index) else "")
    fallback = float(series.tail(3).mean())
    points: list[dict[str, float | str]] = []
    for idx, pred in enumerate(prediction):
        period_label = advance_period(last_period, granularity, idx + 1) if last_period else str(idx + 1)
        points.append(
            {
                "period": period_label,
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


def _monthly_fuel_actuals(ctx: dict, f: AnalyticsFilters) -> list[tuple[str, float]]:
    filtered_ids = {t.id for t in _filtered_trips(ctx, f) if t.completed_at}
    buckets: dict[str, float] = defaultdict(float)
    for trip in ctx["trips"]:
        if trip.id not in filtered_ids:
            continue
        ref = _activity_date(trip.completed_at)
        if not ref:
            continue
        p = period_key(ref, f.granularity)
        if p:
            buckets[p] += _trip_fuel(trip, ctx["fuel_by_trip"])
    return sorted(buckets.items())


def _combine_forecast_chart(
    actuals: list[tuple[str, float]],
    forecast: list[dict[str, float | str]] | None,
    *,
    actual_key: str,
    forecast_key: str,
) -> list[dict[str, Any]]:
    chart: list[dict[str, Any]] = []
    for period, value in actuals:
        row: dict[str, Any] = {
            "period": period,
            actual_key: round(float(value), 2),
            "series_type": "actual",
        }
        if len(period) == 7 and period[4] == "-":
            row["month"] = period
        chart.append(row)
    if forecast:
        for pt in forecast:
            period = str(pt["period"])
            row = {
                "period": period,
                forecast_key: pt["value"],
                "series_type": "forecast",
            }
            if len(period) == 7 and period[4] == "-":
                row["month"] = period
            chart.append(row)
    return chart


def _row_reference_date(row: dict[str, Any]) -> date | None:
    for key in ("date", "delivery_date", "scheduled_month"):
        raw = row.get(key)
        if not raw or raw == "—":
            continue
        token = str(raw).strip()
        if len(token) >= 10:
            try:
                return date.fromisoformat(token[:10])
            except ValueError:
                continue
        if len(token) == 7 and token[4] == "-":
            try:
                return date.fromisoformat(f"{token}-01")
            except ValueError:
                continue
    return None


def _delivery_success_rate_over_time(shipments: dict, f: AnalyticsFilters, *, limit: int | None = None) -> list[dict[str, Any]]:
    """Aggregate delivered / total shipments per time bucket for line-chart performance reporting."""
    if shipments.get("empty"):
        return []
    drilldown = shipments.get("drilldown") or []
    period_total: dict[str, int] = defaultdict(int)
    period_delivered: dict[str, int] = defaultdict(int)
    for row in drilldown:
        ref = _row_reference_date(row)
        bucket = period_key(ref, f.granularity)
        if not bucket:
            continue
        period_total[bucket] += 1
        if str(row.get("delivery_status") or "").lower() == "delivered":
            period_delivered[bucket] += 1
    history_limit = limit or {"daily": 120, "weekly": 52, "monthly": 24, "quarterly": 12, "yearly": 8}.get(
        f.granularity,
        36,
    )
    keys = sort_period_keys(list(period_total.keys()), f.granularity)[-history_limit:]
    chart: list[dict[str, Any]] = []
    for bucket in keys:
        total = period_total[bucket]
        delivered = period_delivered[bucket]
        rate = round(delivered / total, 3) if total > 0 else 0.0
        chart.append(
            period_chart_row(
                bucket,
                delivery_success_rate=rate,
                delivered=delivered,
                total=total,
            )
        )
    return chart


def _performance_reports_block(shipments: dict, f: AnalyticsFilters) -> dict[str, Any]:
    """Descriptive performance report: delivery success rate trend by selected time granularity."""
    chart = _delivery_success_rate_over_time(shipments, f)
    if not chart:
        return _empty(shipments.get("message", "No data available yet."))
    ship_summary = shipments.get("summary") or {}
    latest = chart[-1]
    overall_pct = ship_summary.get("delivery_success_rate_pct")
    avg_rate = round(sum(float(r["delivery_success_rate"]) for r in chart) / len(chart), 3)
    gran = f.granularity.replace("_", " ")
    return _block(
        kpis=[
            {
                "label": "Overall success rate",
                "value": f"{float(overall_pct):.1f}%" if overall_pct is not None else f"{latest['delivery_success_rate'] * 100:.1f}%",
            },
            {"label": f"Latest period ({latest['period']})", "value": f"{latest['delivery_success_rate'] * 100:.1f}%"},
            {"label": "Average rate (periods shown)", "value": f"{avg_rate * 100:.1f}%"},
        ],
        chart=chart,
        drilldown=(shipments.get("drilldown") or [])[:80],
        note=(
            "Delivery Success Rate Over Time. Raw shipment outcomes are aggregated into the selected "
            f"({gran}) time bucket so the chart reflects daily, weekly, monthly, quarterly, or yearly performance views."
        ),
    )


def _delivery_success_reports_block(shipments: dict, f: AnalyticsFilters) -> dict[str, Any]:
    """Performance Monitoring descriptive report: delivery success rate trend (1.0 = 100%)."""
    chart = _delivery_success_rate_over_time(shipments, f)
    if not chart:
        return _empty(shipments.get("message", "No data available yet."))
    rates = [float(row["delivery_success_rate"]) for row in chart]
    latest = chart[-1]
    floor = min(rates)
    peak = max(rates)
    avg_rate = round(sum(rates) / len(rates), 3)
    ship_summary = shipments.get("summary") or {}
    overall_pct = ship_summary.get("delivery_success_rate_pct")
    gran = f.granularity.replace("_", " ")
    return _block(
        kpis=[
            {
                "label": "Overall success rate",
                "value": f"{float(overall_pct):.1f}%" if overall_pct is not None else f"{latest['delivery_success_rate'] * 100:.1f}%",
            },
            {"label": "Peak period rate", "value": f"{peak * 100:.1f}%"},
            {"label": "Floor period rate", "value": f"{floor * 100:.1f}%"},
        ],
        chart=chart,
        drilldown=(shipments.get("drilldown") or [])[:80],
        note=(
            "Delivery Success Rate Over Time. Descriptive timeline of delivery performance from "
            f"{gran} shipment outcomes, showing volatility between operational floor (~{floor * 100:.0f}%) "
            f"and peak efficiency (~{peak * 100:.0f}%). Average across periods shown: {avg_rate * 100:.1f}%."
        ),
    )


def _fleet_performance_trend_block(shipments: dict, f: AnalyticsFilters, *, forecast_periods: int | None = None) -> dict[str, Any]:
    """Predictive fleet performance: volatile historical delivery success rate plus smoothed forecast."""
    chart_hist = _delivery_success_rate_over_time(shipments, f)
    if len(chart_hist) < 2:
        return _empty(shipments.get("message", "Insufficient data."))

    actuals = [(str(row["period"]), round(float(row["delivery_success_rate"]), 3)) for row in chart_hist]
    periods_map = {"daily": 30, "weekly": 8, "monthly": 6, "quarterly": 4, "yearly": 3}
    n_forecast = forecast_periods or periods_map.get(f.granularity, 14)

    series = _period_series(actuals, min_points=_min_series_points(f))
    forecast = _forecast_series(series, n_forecast, granularity=f.granularity)
    if not forecast:
        stabilized = round(sum(v for _, v in actuals) / len(actuals), 3)
        last_period = actuals[-1][0]
        forecast = [
            {"period": advance_period(last_period, f.granularity, step), "value": stabilized}
            for step in range(1, n_forecast + 1)
        ]

    actual_key = "actual_delivery_success_rate"
    forecast_key = "forecast_delivery_success_rate"
    chart = _combine_forecast_chart(actuals, forecast, actual_key=actual_key, forecast_key=forecast_key)
    for row in chart:
        for key in (actual_key, forecast_key):
            if row.get(key) is not None:
                row[key] = round(float(row[key]), 3)

    last_period = actuals[-1][0]
    for row in chart:
        if row.get("period") == last_period and row.get(actual_key) is not None:
            row[forecast_key] = row[actual_key]
            break

    forecast_values = [
        float(row[forecast_key]) for row in chart if row.get(forecast_key) is not None and row.get("series_type") == "forecast"
    ]
    if not forecast_values:
        forecast_values = [float(row[forecast_key]) for row in chart if row.get(forecast_key) is not None]
    latest_forecast = forecast_values[-1] if forecast_values else None
    gran = f.granularity.replace("_", " ")

    return _block(
        kpis=[
            {"label": "Latest historical rate", "value": f"{actuals[-1][1] * 100:.1f}%"},
            {
                "label": "Forecast endpoint",
                "value": f"{latest_forecast * 100:.1f}%" if latest_forecast is not None else "Insufficient data",
            },
            {"label": "Historical periods", "value": len(actuals)},
        ],
        chart=chart,
        drilldown=(shipments.get("drilldown") or [])[:80],
        note=(
            "Fleet Performance Trend Prediction (Delivery Success Rate). Historical data captures day-to-day "
            "operational volatility on a 0–1.0 scale; the dashed forecast filters noise to project a stabilized "
            f"baseline for the next {n_forecast} {gran} buckets."
        ),
    )


def _normalize_maintenance_risk_score(raw: float) -> float:
    if raw <= 0:
        return 1.0
    scaled = raw * 10 if raw <= 1 else raw
    return max(1.0, min(10.0, round(scaled, 1)))


def _maintenance_record_risk_score(rec: Any) -> float:
    raw = float(getattr(rec, "predicted_risk_score", 0) or 0)
    if raw > 0:
        return _normalize_maintenance_risk_score(raw)
    severity = str(getattr(rec, "severity", "") or "").lower()
    if "high" in severity or "critical" in severity:
        return 9.5
    if "medium" in severity or "moderate" in severity:
        return 6.0
    return 2.5


def _maintenance_risk_date_bounds(f: AnalyticsFilters, records: list[Any]) -> tuple[date, date]:
    if f.date_from and f.date_to:
        return f.date_from, f.date_to
    refs = [_activity_date(rec.created_at) for rec in records if _activity_date(rec.created_at)]
    if not refs:
        today = date.today()
        return today - timedelta(days=90), today
    return min(refs), max(refs)


def _maintenance_risk_score_over_time(ctx: dict, f: AnalyticsFilters, *, limit: int = 120) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Fleet maintenance risk score trend (1–10 scale) by selected time bucket."""
    records = [rec for rec in ctx["maintenance"] if _maintenance_in_filters(rec, f)]
    drilldown: list[dict[str, Any]] = []
    for rec in records:
        ref = _activity_date(rec.created_at)
        drilldown.append(
            {
                "maintenance_id": rec.id,
                "truck_id": rec.truck_id,
                "date": ref.isoformat() if ref else "—",
                "reported_issue": rec.reported_issue,
                "severity": rec.severity,
                "maintenance_risk_score": _maintenance_record_risk_score(rec),
                "status": _status_str(rec.status),
            }
        )
    drilldown.sort(key=lambda row: row["date"], reverse=True)

    if not records:
        return [], drilldown

    chart: list[dict[str, Any]] = []
    if f.granularity == "daily":
        start, end = _maintenance_risk_date_bounds(f, records)
        day = start
        while day <= end and len(chart) < limit:
            open_scores = []
            for rec in records:
                created = _activity_date(rec.created_at)
                if not created or created > day:
                    continue
                resolved = rec.resolved_at.date() if rec.resolved_at else None
                if resolved and resolved < day:
                    continue
                open_scores.append(_maintenance_record_risk_score(rec))
            score = round(max(open_scores), 1) if open_scores else 1.0
            chart.append(period_chart_row(day.isoformat(), maintenance_risk_score=score))
            day += timedelta(days=1)
    else:
        period_scores: dict[str, list[float]] = defaultdict(list)
        for rec in records:
            ref = _activity_date(rec.created_at)
            bucket = period_key(ref, f.granularity)
            if not bucket:
                continue
            period_scores[bucket].append(_maintenance_record_risk_score(rec))
        keys = sort_period_keys(list(period_scores.keys()), f.granularity)[-limit:]
        for bucket in keys:
            chart.append(
                period_chart_row(
                    bucket,
                    maintenance_risk_score=round(max(period_scores[bucket]), 1),
                )
            )
    return chart, drilldown


def _maintenance_risk_prediction_block(db: Session, ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    chart, drilldown = _maintenance_risk_score_over_time(ctx, f)
    if not chart:
        return _empty_predict("Insufficient maintenance history for risk scoring.")
    latest = chart[-1]
    peak = max(chart, key=lambda row: float(row.get("maintenance_risk_score") or 0))
    avg_score = round(sum(float(row["maintenance_risk_score"]) for row in chart) / len(chart), 1)
    gran = f.granularity.replace("_", " ")
    return _block(
        kpis=[
            {"label": "Latest risk score", "value": latest["maintenance_risk_score"]},
            {"label": f"Peak score ({peak['period']})", "value": peak["maintenance_risk_score"]},
            {"label": "Average score (periods shown)", "value": avg_score},
        ],
        chart=chart,
        drilldown=drilldown[:80],
        note=(
            "Maintenance Risk Score Over Time. Tracks fleet maintenance risk on a 1–10 scale, "
            f"aggregated into the selected ({gran}) time bucket from open maintenance records and predicted risk scores."
        ),
    )


def _truck_risk_on_day(
    truck_id: int,
    day: date,
    records: list[Any],
    daily_breakdown: dict[tuple[int, str], int],
) -> float:
    open_scores: list[float] = []
    for rec in records:
        created = _activity_date(rec.created_at)
        if not created or created > day:
            continue
        resolved = rec.resolved_at.date() if rec.resolved_at else None
        if resolved and resolved < day:
            continue
        open_scores.append(_maintenance_record_risk_score(rec))
    if open_scores:
        return round(max(open_scores), 1)

    day_scores = [
        _maintenance_record_risk_score(rec)
        for rec in records
        if _activity_date(rec.created_at) == day
    ]
    if day_scores:
        return round(max(day_scores), 1)

    breakdowns = daily_breakdown.get((truck_id, day.isoformat()), 0)
    if breakdowns:
        return round(min(10.0, 5.0 + breakdowns * 2.0), 1)
    return 1.0


def _maintenance_failure_prediction_block(
    ctx: dict,
    f: AnalyticsFilters,
    breakdown_rows: list[dict],
    breakdown_by_truck: dict[int, int],
) -> dict[str, Any]:
    """Per-vehicle maintenance risk score trends (1–10) over the selected timeline."""
    truck_map = {t.id: t.code for t in ctx["trucks"]}
    code_to_id = {t.code: t.id for t in ctx["trucks"]}

    maint_by_truck: dict[int, list] = defaultdict(list)
    for rec in ctx["maintenance"]:
        if _maintenance_in_filters(rec, f):
            maint_by_truck[rec.truck_id].append(rec)

    daily_breakdown: dict[tuple[int, str], int] = defaultdict(int)
    for row in breakdown_rows:
        truck_code = str(row.get("truck") or "")
        truck_id = code_to_id.get(truck_code)
        day = str(row.get("date") or "")[:10]
        if truck_id and len(day) == 10:
            daily_breakdown[(truck_id, day)] += 1

    truck_activity: list[tuple[int, int, str]] = []
    for truck in ctx["trucks"]:
        if f.truck_id and truck.id != f.truck_id:
            continue
        activity = len(maint_by_truck[truck.id]) + breakdown_by_truck.get(truck.id, 0)
        truck_activity.append((activity, truck.id, truck.code))
    truck_activity.sort(key=lambda item: (-item[0], item[2]))
    truck_ids = [tid for _, tid, _ in truck_activity[:4]]
    if not truck_ids:
        truck_ids = [t.id for t in ctx["trucks"][:4]]
    if not truck_ids:
        return _empty_predict()

    all_records = [rec for tid in truck_ids for rec in maint_by_truck[tid]]
    date_refs: list[date] = [
        ref for rec in all_records if (ref := _activity_date(rec.created_at)) is not None
    ]
    for row in breakdown_rows:
        day = str(row.get("date") or "")[:10]
        if len(day) == 10:
            try:
                date_refs.append(date.fromisoformat(day))
            except ValueError:
                continue
    if f.date_from and f.date_to:
        start, end = f.date_from, f.date_to
    elif date_refs:
        start, end = min(date_refs), max(date_refs)
    else:
        today = date.today()
        start, end = today - timedelta(days=90), today

    history_limit = _ACTUAL_HISTORY_LIMIT.get(f.granularity, 120)
    chart: list[dict[str, Any]] = []

    if f.granularity == "daily":
        day = start
        while day <= end and len(chart) < history_limit:
            row: dict[str, Any] = {"period": day.isoformat()}
            for truck_id in truck_ids:
                code = truck_map[truck_id]
                row[code] = _truck_risk_on_day(truck_id, day, maint_by_truck[truck_id], daily_breakdown)
            chart.append(row)
            day += timedelta(days=1)
    else:
        period_scores: dict[str, dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))
        for truck_id in truck_ids:
            for rec in maint_by_truck[truck_id]:
                ref = _activity_date(rec.created_at)
                bucket = period_key(ref, f.granularity)
                if bucket:
                    period_scores[bucket][truck_id].append(_maintenance_record_risk_score(rec))
        for (truck_id, day), count in daily_breakdown.items():
            if truck_id not in truck_ids:
                continue
            try:
                bucket = period_key(date.fromisoformat(day), f.granularity)
            except ValueError:
                continue
            if bucket:
                period_scores[bucket][truck_id].append(min(10.0, 5.0 + count * 2.0))
        keys = sort_period_keys(list(period_scores.keys()), f.granularity)[-history_limit:]
        for bucket in keys:
            row = {"period": bucket}
            for truck_id in truck_ids:
                code = truck_map[truck_id]
                scores = period_scores[bucket].get(truck_id, [])
                row[code] = round(max(scores), 1) if scores else 1.0
            chart.append(row)

    if len(chart) < 2:
        return _empty_predict("Insufficient maintenance history for vehicle risk trends.")

    failure_rows: list[dict] = []
    for truck_id in truck_ids:
        truck = next((t for t in ctx["trucks"] if t.id == truck_id), None)
        if not truck:
            continue
        maint_count = len(maint_by_truck[truck_id])
        bd_count = breakdown_by_truck.get(truck_id, 0)
        trip_count = sum(1 for trip in ctx["trips"] if trip.truck_id == truck_id)
        recurring = maint_count >= 2 or bd_count >= 2
        base_cost = (
            sum(float(r.estimated_cost or r.actual_cost or 0) for r in maint_by_truck[truck_id]) / maint_count
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
        truck_scores = [
            float(row[truck.code])
            for row in chart
            if row.get(truck.code) is not None
        ]
        failure_rows.append(
            {
                "truck": truck.code,
                "trip_count": trip_count,
                "maintenance_records": maint_count,
                "breakdown_reports": bd_count,
                "risk_score": pred.risk_score,
                "peak_period_score": round(max(truck_scores), 1) if truck_scores else pred.risk_score,
                "priority": pred.priority_level,
                "next_service_days": pred.next_service_in_days,
                "estimated_cost_php": pred.estimated_cost,
                "status": pred.priority_level,
            }
        )
    failure_rows.sort(key=lambda r: float(r.get("peak_period_score") or r["risk_score"]), reverse=True)

    series_codes = [truck_map[tid] for tid in truck_ids]
    all_scores = [
        float(row[code])
        for row in chart
        for code in series_codes
        if row.get(code) is not None
    ]
    peak_truck = max(
        ((code, max(float(row.get(code) or 0) for row in chart)) for code in series_codes),
        key=lambda item: item[1],
    )
    gran = f.granularity.replace("_", " ")

    return _block(
        kpis=[
            {"label": "Vehicles tracked", "value": len(truck_ids)},
            {"label": "Peak vehicle score", "value": f"{peak_truck[0]} ({peak_truck[1]:.1f})"},
            {"label": "Fleet avg score", "value": round(sum(all_scores) / len(all_scores), 1) if all_scores else "—"},
        ],
        chart=chart,
        drilldown=failure_rows[:50],
        note=(
            "Maintenance Risk Score Trends by Vehicle (1–10 scale). Each colored line tracks daily or "
            f"bucketed risk for an individual truck across the selected ({gran}) timeline, highlighting "
            "staggered spikes that indicate asset-specific maintenance failure patterns."
        ),
    )


_FORECAST_HORIZON = {"daily": 14, "weekly": 8, "monthly": 6, "quarterly": 4, "yearly": 2}
_ACTUAL_HISTORY_LIMIT = {"daily": 120, "weekly": 52, "monthly": 24, "quarterly": 12, "yearly": 8}


def _operational_cost_actual_series(expenses: dict, f: AnalyticsFilters) -> list[tuple[str, float]]:
    if expenses.get("empty"):
        return []
    records = (expenses.get("drilldown") or {}).get("records") or []
    buckets: dict[str, float] = defaultdict(float)
    for rec in records:
        raw = rec.get("expense_date")
        if not raw:
            continue
        try:
            ref = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue
        bucket = period_key(ref, f.granularity)
        if bucket:
            buckets[bucket] += float(rec.get("amount_php") or 0)
    if not buckets:
        for row in expenses.get("monthly_totals") or []:
            period = str(row.get("period") or row.get("month") or "")
            total = float(row.get("total") or 0)
            if period and total > 0:
                buckets[period] += total
    return sorted((key, round(value, 2)) for key, value in buckets.items())


def _daily_operational_cost_series(expenses: dict) -> list[tuple[str, float]]:
    if expenses.get("empty"):
        return []
    records = (expenses.get("drilldown") or {}).get("records") or []
    buckets: dict[str, float] = defaultdict(float)
    for rec in records:
        raw = rec.get("expense_date")
        if not raw:
            continue
        day = str(raw)[:10]
        if len(day) < 10:
            continue
        buckets[day] += float(rec.get("amount_php") or 0)
    return sorted((day, round(total, 2)) for day, total in buckets.items())


def _cost_fluctuation_analysis_block(expenses: dict, f: AnalyticsFilters) -> dict[str, Any]:
    """Operational cost timeline with rolling mean and rolling std-dev band (PHP)."""
    if expenses.get("empty"):
        return _empty(expenses.get("message", "No data available yet."))

    if f.granularity == "daily":
        actuals = _daily_operational_cost_series(expenses)
        window = 7
        min_points = 7
    else:
        actuals = _operational_cost_actual_series(expenses, f)
        window = 7
        min_points = 3

    if len(actuals) < min_points:
        return _empty(expenses.get("message", "Insufficient data."))

    history_limit = _ACTUAL_HISTORY_LIMIT.get(f.granularity, 120)
    trimmed = actuals[-history_limit:]
    periods = [period for period, _ in trimmed]
    values = pd.Series([value for _, value in trimmed], index=periods, dtype=float)
    rolling_mean = values.rolling(window=window, min_periods=1).mean()
    rolling_std = values.rolling(window=window, min_periods=2).std().fillna(0.0)

    chart: list[dict[str, Any]] = []
    for period in periods:
        daily = round(float(values[period]), 2)
        mean = round(float(rolling_mean[period]), 2)
        std = float(rolling_std[period]) if math.isfinite(float(rolling_std[period])) else 0.0
        chart.append(
            period_chart_row(
                period,
                daily_operational_cost_php=daily,
                rolling_mean_7d_php=mean,
                rolling_std_upper_php=round(mean + std, 2),
                rolling_std_lower_php=round(max(0.0, mean - std), 2),
            )
        )

    latest = chart[-1]
    costs = [float(row["daily_operational_cost_php"]) for row in chart]
    floor = min(costs)
    peak = max(costs)
    gran = f.granularity.replace("_", " ")
    window_label = f"{window}-day" if f.granularity == "daily" else f"{window}-period"
    return _block(
        kpis=[
            {"label": "Latest daily cost (₱)", "value": latest["daily_operational_cost_php"]},
            {"label": f"Latest {window_label} avg (₱)", "value": latest["rolling_mean_7d_php"]},
            {"label": "Peak / floor (₱)", "value": f"{peak:,.0f} / {floor:,.0f}"},
        ],
        chart=chart,
        drilldown=[
            {
                "booking_id": rec.get("booking_id"),
                "trip_id": rec.get("trip_id"),
                "truck": rec.get("truck_code") or "—",
                "date": rec.get("expense_date"),
                "cost_php": rec.get("amount_php"),
                "category": rec.get("category"),
                "status": rec.get("source_type"),
            }
            for rec in ((expenses.get("drilldown") or {}).get("records") or [])[:50]
        ],
        note=(
            "Operational Cost Fluctuation Analysis (PHP). Blue line shows volatile operational spend; "
            f"the red dashed line is the {window_label} rolling mean and the pink band is rolling "
            f"standard deviation for the selected ({gran}) timeline."
        ),
    )


def _cost_overrun_prediction_block(
    expenses: dict,
    f: AnalyticsFilters,
    overrun_drilldown: list[dict[str, Any]],
) -> dict[str, Any]:
    """Historical daily operational cost with smoothed forecast and 95% confidence band (PHP)."""
    actuals = _operational_cost_actual_series(expenses, f)
    if len(actuals) < 2:
        return _empty_predict("Insufficient operational cost history for overrun forecasting.")
    gran = f.granularity
    series = _period_series(actuals, min_points=_min_series_points(f, default=2))
    horizon = _FORECAST_HORIZON.get(gran, 6)
    forecast = _forecast_series(series, periods=horizon, granularity=gran)
    if not forecast:
        return _empty_predict("Insufficient data for cost overrun forecast.")

    values = [float(value) for _, value in actuals]
    std = float(pd.Series(values).std()) if len(values) > 1 else max(abs(values[-1]) * 0.08, 1.0)
    if not math.isfinite(std) or std <= 0:
        std = max(abs(values[-1]) * 0.08, 1.0)
    margin = round(1.96 * std, 2)

    history_limit = _ACTUAL_HISTORY_LIMIT.get(gran, 36)
    chart: list[dict[str, Any]] = []
    for period, value in actuals[-history_limit:]:
        chart.append(period_chart_row(period, actual_daily_cost_php=round(float(value), 2)))
    if chart:
        chart[-1]["predicted_daily_cost_php"] = chart[-1]["actual_daily_cost_php"]

    for pt in forecast:
        predicted = float(pt["value"])
        chart.append(
            period_chart_row(
                str(pt["period"]),
                predicted_daily_cost_php=round(predicted, 2),
                confidence_lower_php=round(max(0.0, predicted - margin), 2),
                confidence_upper_php=round(predicted + margin, 2),
                series_type="forecast",
            )
        )

    latest_actual = float(actuals[-1][1])
    latest_pred = float(forecast[0]["value"])
    change_pct = round(((latest_pred - latest_actual) / latest_actual) * 100, 1) if latest_actual > 0 else 0.0
    expense_records = (expenses.get("drilldown") or {}).get("records") or []
    drilldown = overrun_drilldown[:50] if overrun_drilldown else expense_records[:50]
    return _block(
        kpis=[
            {"label": "Latest actual cost", "value": f"₱{latest_actual:,.2f}"},
            {"label": "Next period forecast", "value": f"₱{latest_pred:,.2f}"},
            {"label": "Projected change", "value": f"{change_pct:+.1f}%"},
        ],
        chart=chart,
        drilldown=drilldown,
        note=(
            "Daily Operational Cost Prediction with Overrun (PHP). Historical actual spend is shown as a volatile "
            "blue series; the red dashed line forecasts the next periods with a 95% confidence band."
        ),
    )


_DISRUPTION_STATUS_WEIGHTS = {
    "delay": 0.40,
    "breakdown": 0.90,
    "cancelled": 0.70,
}


def _disruption_risk_actual_series(
    disruption_sources: list[dict[str, Any]],
    f: AnalyticsFilters,
) -> list[tuple[str, float]]:
    period_events: dict[str, list[str]] = defaultdict(list)
    for src in disruption_sources:
        d = src.get("date")
        if not d or d == "—":
            continue
        try:
            ref = date.fromisoformat(str(d)[:10])
        except ValueError:
            continue
        bucket = period_key(ref, f.granularity)
        if bucket:
            period_events[bucket].append(str(src.get("status") or "delay"))
    if not period_events:
        return []
    keys = sort_period_keys(list(period_events.keys()), f.granularity)
    actuals: list[tuple[str, float]] = []
    for bucket in keys:
        statuses = period_events[bucket]
        raw = sum(_DISRUPTION_STATUS_WEIGHTS.get(s, 0.5) for s in statuses)
        score = round(min(1.0, raw / max(1.0, len(statuses) * 0.55)), 3)
        actuals.append((bucket, score))
    return actuals


def _operational_disruption_prediction_block(
    disruption_sources: list[dict[str, Any]],
    f: AnalyticsFilters,
    drilldown: list[dict[str, Any]],
) -> dict[str, Any]:
    """Historical disruption risk (0–1) with stabilized forecast and confidence band."""
    actuals = _disruption_risk_actual_series(disruption_sources, f)
    if len(actuals) < 2:
        return _empty_predict("Insufficient disruption history for operational risk forecasting.")
    gran = f.granularity
    values = [float(v) for _, v in actuals]
    std = float(pd.Series(values).std()) if len(values) > 1 else 0.05
    if not math.isfinite(std) or std <= 0:
        std = 0.05
    margin = round(min(0.08, max(0.04, std * 0.35)), 3)

    series = _period_series(actuals, min_points=_min_series_points(f, default=2))
    horizon = _FORECAST_HORIZON.get(gran, 14)
    forecast_raw = _forecast_series(series, periods=horizon, granularity=gran)
    stabilized = round(sum(values) / len(values), 3)
    forecast = (
        [{"period": str(pt["period"]), "value": stabilized} for pt in forecast_raw]
        if forecast_raw
        else [
            {"period": advance_period(actuals[-1][0], gran, step), "value": stabilized}
            for step in range(1, horizon + 1)
        ]
    )

    history_limit = _ACTUAL_HISTORY_LIMIT.get(gran, 36)
    chart: list[dict[str, Any]] = []
    for period, value in actuals[-history_limit:]:
        chart.append(period_chart_row(period, historical_disruption_risk=round(float(value), 3)))
    if chart:
        chart[-1]["forecast_disruption_risk"] = chart[-1]["historical_disruption_risk"]

    for pt in forecast:
        predicted = round(min(1.0, max(0.0, float(pt["value"]))), 3)
        chart.append(
            period_chart_row(
                str(pt["period"]),
                forecast_disruption_risk=predicted,
                confidence_lower_risk=round(max(0.0, predicted - margin), 3),
                confidence_upper_risk=round(min(1.0, predicted + margin), 3),
                series_type="forecast",
            )
        )

    latest_actual = float(actuals[-1][1])
    latest_pred = float(forecast[0]["value"])
    gran_label = gran.replace("_", " ")
    return _block(
        kpis=[
            {"label": "Latest historical risk", "value": f"{latest_actual:.3f}"},
            {"label": "Next period forecast", "value": f"{latest_pred:.3f}"},
            {"label": "Average risk (period)", "value": f"{stabilized:.3f}"},
        ],
        chart=chart,
        drilldown=drilldown[:50],
        note=(
            "Operational Disruption Risk Forecast. Blue solid line tracks volatile historical disruption "
            f"risk on a 0–1.0 scale; the red dashed line forecasts a stabilized baseline for upcoming "
            f"({gran_label}) periods with a narrow confidence band."
        ),
    )


def _fuel_efficiency_analysis_block(eff_rows: list[dict], f: AnalyticsFilters) -> dict[str, Any]:
    """Descriptive fuel efficiency trend: average km/L over selected time buckets."""
    if not eff_rows:
        return _empty("Insufficient data.")
    period_values: dict[str, list[float]] = defaultdict(list)
    for row in eff_rows:
        dt = row.get("date")
        if not dt or dt == "—":
            continue
        try:
            ref = date.fromisoformat(str(dt)[:10])
        except ValueError:
            continue
        bucket = period_key(ref, f.granularity)
        if bucket:
            period_values[bucket].append(float(row["km_per_liter"]))
    if not period_values:
        return _empty("Insufficient data.")
    history_limit = {"daily": 120, "weekly": 52, "monthly": 24, "quarterly": 12, "yearly": 8}.get(
        f.granularity,
        36,
    )
    keys = sort_period_keys(list(period_values.keys()), f.granularity)[-history_limit:]
    chart: list[dict[str, Any]] = []
    for bucket in keys:
        samples = period_values[bucket]
        chart.append(
            period_chart_row(
                bucket,
                avg_km_per_liter=round(sum(samples) / len(samples), 2),
                sample_count=len(samples),
            )
        )
    if len(chart) < 2:
        return _empty("Insufficient data.")
    values = [float(row["avg_km_per_liter"]) for row in chart]
    latest = chart[-1]
    gran = f.granularity.replace("_", " ")
    return _block(
        kpis=[
            {"label": "Fleet average (km/L)", "value": round(sum(values) / len(values), 2)},
            {"label": f"Latest period ({latest['period']})", "value": latest["avg_km_per_liter"]},
            {"label": "Peak / floor (km/L)", "value": f"{max(values):.2f} / {min(values):.2f}"},
        ],
        chart=chart,
        drilldown=eff_rows[:80],
        statistics=compute_statistics(values, min_samples=1),
        note=(
            "Average Daily Fuel Efficiency (Km per Liter) Over Time. Aggregates fuel-log samples into "
            f"the selected ({gran}) timeline to show fleet km/L volatility and day-to-day efficiency swings."
        ),
    )


def _maintenance_frequency_block(db: Session, ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    """Histogram of how many fleet vehicles experienced 0, 1, 2, … breakdown events."""
    trucks = ctx.get("trucks") or []
    if not trucks:
        return _empty("No data available yet.")

    truck_map = {t.id: t.code for t in trucks}
    trip_by_id = {t.id: t for t in ctx["trips"]}
    filtered_trip_ids = {t.id for t in _filtered_trips(ctx, f)}
    breakdown_by_truck: dict[int, int] = defaultdict(int)
    drilldown: list[dict] = []

    for vir in db.query(VehicleIssueReport).order_by(VehicleIssueReport.created_at.desc()).all():
        if vir.trip_id not in filtered_trip_ids:
            continue
        if not _is_breakdown_issue(vir.issue_type):
            continue
        breakdown_by_truck[vir.truck_id] += 1
        ref = _activity_date(vir.created_at)
        drilldown.append(
            {
                "source": "vehicle_issue_report",
                "truck": truck_map.get(vir.truck_id, "—"),
                "date": ref.isoformat() if ref else "—",
                "issue_type": vir.issue_type,
                "status": _status_str(vir.status),
            }
        )

    for issue in db.query(TripIssue).order_by(TripIssue.created_at.desc()).all():
        if issue.trip_id not in filtered_trip_ids:
            continue
        if not _is_breakdown_issue(issue.issue_type):
            continue
        trip = trip_by_id.get(issue.trip_id)
        if trip and trip.truck_id:
            breakdown_by_truck[trip.truck_id] += 1
        ref = _activity_date(issue.created_at)
        drilldown.append(
            {
                "source": "trip_issue",
                "truck": trip.truck.code if trip and trip.truck else "—",
                "date": ref.isoformat() if ref else "—",
                "issue_type": issue.issue_type,
                "status": "resolved" if issue.resolved else "open",
            }
        )

    drilldown.sort(key=lambda r: r["date"], reverse=True)
    per_truck = [
        {
            "truck": truck.code,
            "breakdown_count": breakdown_by_truck.get(truck.id, 0),
        }
        for truck in trucks
    ]
    histogram: dict[int, int] = defaultdict(int)
    for truck in trucks:
        histogram[breakdown_by_truck.get(truck.id, 0)] += 1

    chart = [
        {"breakdown_count": count, "frequency": freq}
        for count, freq in sorted(histogram.items())
    ]
    if not chart:
        return _empty("No data available yet.")

    freq_values = [int(row["frequency"]) for row in chart]
    zero_bucket = next((row for row in chart if row["breakdown_count"] == 0), None)
    total_events = sum(breakdown_by_truck.values())

    return _block(
        kpis=[
            {"label": "Fleet vehicles", "value": len(trucks)},
            {"label": "Total breakdown events", "value": total_events},
            {
                "label": "Zero-breakdown vehicles",
                "value": zero_bucket["frequency"] if zero_bucket else 0,
            },
        ],
        chart=chart,
        drilldown=per_truck + drilldown[:50],
        statistics=compute_statistics(freq_values, min_samples=1),
        note=(
            "Distribution of Breakdown Count. Shows how many vehicles logged 0, 1, or 2+ breakdown events "
            "in the selected period. A U-shaped pattern suggests many reliable units alongside compounding "
            "failures once a first breakdown occurs. Hover any bar for the exact frequency."
        ),
    )


def _efficiency_improvement_block(
    eff_rows: list[dict],
    f: AnalyticsFilters,
    *,
    forecast_periods: int | None = None,
) -> dict[str, Any]:
    """Historical km/L volatility plus flat stabilized fleet-average forecast (km per liter)."""
    if not eff_rows:
        return _empty("Insufficient data.")
    period_values: dict[str, list[float]] = defaultdict(list)
    for row in eff_rows:
        dt = row.get("date")
        if not dt or dt == "—":
            continue
        try:
            ref = date.fromisoformat(str(dt)[:10])
        except ValueError:
            continue
        bucket = period_key(ref, f.granularity)
        if bucket:
            period_values[bucket].append(float(row["km_per_liter"]))
    if not period_values:
        return _empty("Insufficient data.")

    history_limit = {"daily": 120, "weekly": 52, "monthly": 24, "quarterly": 12, "yearly": 8}.get(
        f.granularity,
        36,
    )
    forecast_map = {"daily": 30, "weekly": 8, "monthly": 6, "quarterly": 4, "yearly": 3}
    n_forecast = forecast_periods or forecast_map.get(f.granularity, 14)
    keys = sort_period_keys(list(period_values.keys()), f.granularity)[-history_limit:]
    actuals = [
        (bucket, round(sum(period_values[bucket]) / len(period_values[bucket]), 2))
        for bucket in keys
    ]
    if len(actuals) < 2:
        return _empty("Insufficient data.")

    values = [value for _, value in actuals]
    stabilized = round(sum(values) / len(values), 2)
    floor = min(values)
    peak = max(values)
    last_period = actuals[-1][0]
    forecast = [
        {"period": advance_period(last_period, f.granularity, step), "value": stabilized}
        for step in range(1, n_forecast + 1)
    ]
    actual_key = "actual_avg_km_per_liter"
    forecast_key = "forecast_avg_km_per_liter"
    chart = _combine_forecast_chart(actuals, forecast, actual_key=actual_key, forecast_key=forecast_key)
    for row in chart:
        if row.get("period") == last_period and row.get(actual_key) is not None:
            row[forecast_key] = row[actual_key]
            break

    gran = f.granularity.replace("_", " ")
    return _block(
        kpis=[
            {"label": "Stabilized forecast (km/L)", "value": stabilized},
            {"label": "Peak / floor (km/L)", "value": f"{peak:.2f} / {floor:.2f}"},
            {"label": "Fuel log samples", "value": len(eff_rows)},
        ],
        chart=chart,
        drilldown=eff_rows[:80],
        note=(
            "Efficiency Improvement Forecasting (Average Fuel Efficiency in Km per Liter). "
            f"Historical {gran} averages capture day-to-day volatility; the green dashed forecast "
            "projects a flat stabilized fleet baseline rather than predicting specific spikes or drops."
        ),
    )


def _empty_predict(message: str = "Insufficient data for prediction.") -> dict[str, Any]:
    return {"empty": True, "message": message}


def _is_breakdown_issue(issue_type: str | None) -> bool:
    token = (issue_type or "").lower().strip()
    return token in BREAKDOWN_ISSUE_TYPES or "breakdown" in token


MAINTENANCE_ISSUE_CATEGORY_RULES: tuple[tuple[str, str], ...] = (
    ("engine", "Engine Malfunction"),
    ("malfunction", "Engine Malfunction"),
    ("misfire", "Engine Malfunction"),
    ("overheat", "Engine Malfunction"),
    ("stall", "Engine Malfunction"),
    ("knock", "Engine Malfunction"),
    ("oil", "Engine Malfunction"),
    ("mechanical", "Engine Malfunction"),
    ("tire", "Tire Puncture"),
    ("puncture", "Tire Puncture"),
    ("blowout", "Tire Puncture"),
    ("flat", "Tire Puncture"),
    ("brake", "Brake Failure"),
    ("electrical", "Electrical Issue"),
    ("battery", "Electrical Issue"),
    ("warning_light", "Electrical Issue"),
    ("wiring", "Electrical Issue"),
    ("suspension", "Suspension Problem"),
    ("fluid", "Fluid Leak"),
    ("leak", "Fluid Leak"),
    ("coolant", "Fluid Leak"),
    ("hydraulic", "Fluid Leak"),
)

ISSUE_TYPE_PARETO_LABELS: dict[str, str] = {
    "mechanical": "Engine Malfunction",
    "breakdown": "Engine Malfunction",
    "vehicle": "Engine Malfunction",
    "engine": "Engine Malfunction",
    "warning_light": "Electrical Issue",
    "weather": "Suspension Problem",
}

NON_MAINTENANCE_PARETO_TYPES = frozenset({"traffic", "customs", "loading_delay"})


def _normalize_maintenance_issue(reported_issue: str | None) -> str:
    text = (reported_issue or "").strip()
    if not text:
        return "Unknown Issue"
    lower = text.lower().replace("_", " ")
    for token, label in MAINTENANCE_ISSUE_CATEGORY_RULES:
        if token in lower:
            return label
    return text.title()


def _pareto_issue_label_from_row(row: dict) -> str | None:
    issue_type = str(row.get("issue_type") or "").lower().strip()
    if issue_type in NON_MAINTENANCE_PARETO_TYPES:
        return None
    if issue_type in ISSUE_TYPE_PARETO_LABELS:
        return ISSUE_TYPE_PARETO_LABELS[issue_type]
    reported = str(row.get("reported_issue") or row.get("description") or "").strip()
    if not reported:
        return None
    return _normalize_maintenance_issue(reported)


def _maintenance_pareto_source_rows(
    maint_rows: list[dict],
    db: Session,
    filtered_trip_ids: set[int],
) -> list[dict]:
    sources = [{"reported_issue": row.get("reported_issue")} for row in maint_rows]
    for issue in db.query(TripIssue).all():
        if issue.trip_id not in filtered_trip_ids:
            continue
        sources.append(
            {
                "issue_type": issue.issue_type,
                "reported_issue": issue.description,
            }
        )
    for vir in db.query(VehicleIssueReport).all():
        if vir.trip_id not in filtered_trip_ids:
            continue
        sources.append(
            {
                "issue_type": vir.issue_type,
                "reported_issue": vir.description,
            }
        )
    return sources


def _maintenance_issue_pareto_chart(source_rows: list[dict]) -> list[dict[str, Any]]:
    """Frequency + cumulative % for maintenance issues, sorted descending (Pareto)."""
    counts: dict[str, int] = defaultdict(int)
    for row in source_rows:
        label = _pareto_issue_label_from_row(row)
        if not label or label == "Unknown Issue":
            continue
        counts[label] += 1
    sorted_items = sorted(counts.items(), key=lambda x: (-x[1], x[0]))[:12]
    total = sum(freq for _, freq in sorted_items)
    if total <= 0:
        return []
    running = 0
    chart: list[dict[str, Any]] = []
    for issue_type, frequency in sorted_items:
        running += frequency
        chart.append(
            {
                "issue_type": issue_type,
                "frequency": frequency,
                "cumulative_percent": round(running / total * 100, 1),
            }
        )
    return chart


def _breakdown_per_vehicle_chart(
    breakdown_by_truck: dict[int, int],
    truck_map: dict[int, str],
) -> list[dict[str, Any]]:
    if not breakdown_by_truck:
        return []
    return [
        {
            "vehicle_id": truck_map.get(truck_id, f"TRK-{truck_id}"),
            "total_breakdowns": count,
        }
        for truck_id, count in sorted(
            breakdown_by_truck.items(),
            key=lambda item: (-item[1], truck_map.get(item[0], "")),
        )
    ]


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
    pareto_sources = _maintenance_pareto_source_rows(maint_rows, db, filtered_trip_ids)
    pareto_chart = _maintenance_issue_pareto_chart(pareto_sources)
    top_two_pct = (
        pareto_chart[1]["cumulative_percent"]
        if len(pareto_chart) >= 2
        else (pareto_chart[0]["cumulative_percent"] if pareto_chart else 0)
    )
    risk_desc_maint_logs = (
        _empty("No data available yet.")
        if not pareto_chart
        else _block(
            kpis=[
                {"label": "Issue reports", "value": len(pareto_sources)},
                {"label": "Issue categories", "value": len(pareto_chart)},
                {"label": "Top 2 categories (cum. %)", "value": f"{top_two_pct:.1f}%"},
            ],
            chart=pareto_chart,
            drilldown=maint_rows[:50],
            note=(
                "Pareto Chart of Maintenance Issues. Bars show issue frequency ordered highest to lowest; "
                f"the dashed cumulative line highlights the 80/20 rule. Top two categories account for "
                f"{top_two_pct:.1f}% of all recorded issues."
            ),
        )
    )

    # --- Descriptive: breakdown reports (vehicle issue reports + trip breakdown issues) ---
    breakdown_rows: list[dict] = []
    breakdown_by_truck: dict[int, int] = defaultdict(int)
    vehicle_reports = db.query(VehicleIssueReport).order_by(VehicleIssueReport.created_at.desc()).all()
    for vir in vehicle_reports:
        if vir.trip_id not in filtered_trip_ids:
            continue
        if not _is_breakdown_issue(vir.issue_type):
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
    vehicle_breakdown_chart = _breakdown_per_vehicle_chart(breakdown_by_truck, truck_map)
    highest = vehicle_breakdown_chart[0] if vehicle_breakdown_chart else None
    lowest = vehicle_breakdown_chart[-1] if vehicle_breakdown_chart else None
    fleet_avg = (
        round(sum(row["total_breakdowns"] for row in vehicle_breakdown_chart) / len(vehicle_breakdown_chart), 1)
        if vehicle_breakdown_chart
        else None
    )
    risk_desc_breakdown = (
        _empty("No data available yet.")
        if not vehicle_breakdown_chart
        else _block(
            kpis=[
                {
                    "label": "Highest disruptions",
                    "value": f"{highest['vehicle_id']} ({highest['total_breakdowns']})" if highest else "—",
                },
                {
                    "label": "Most reliable",
                    "value": f"{lowest['vehicle_id']} ({lowest['total_breakdowns']})" if lowest else "—",
                },
                {
                    "label": "Fleet average",
                    "value": fleet_avg if fleet_avg is not None else "Insufficient data",
                },
            ],
            chart=vehicle_breakdown_chart,
            drilldown=breakdown_rows[:50],
            note=(
                "Total Breakdown Count per Vehicle. Compares operational disruption load across fleet units; "
                "hover any bar for the exact breakdown total. Large gaps between highest and lowest trucks "
                "may indicate route difficulty or maintenance quality differences."
            ),
        )
    )

    # --- Descriptive: cost fluctuation ---
    risk_desc_cost_fluct = _cost_fluctuation_analysis_block(expenses, f)

    # --- Predictive: maintenance failure ---
    risk_pred_failure = _maintenance_failure_prediction_block(ctx, f, breakdown_rows, breakdown_by_truck)

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

    has_disruption_data = bool(disruption_sources or route_issue_rows)
    risk_pred_disruption = (
        _empty_predict()
        if not has_disruption_data
        else _operational_disruption_prediction_block(
            disruption_sources,
            f,
            drilldown=(disruption_sources[:40] + route_issue_rows[:10])[:50],
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
    cost_actuals: list[tuple[str, float]] = []
    cost_period_buckets: dict[str, float] = defaultdict(float)
    for t in ctx["trips"]:
        if not t.completed_at:
            continue
        p = period_key(t.completed_at, f.granularity)
        if p:
            cost_period_buckets[p] += float((t.fuel_cost or 0) + (t.toll_cost or 0) + (t.labor_cost or 0))
    cost_actuals = sorted(cost_period_buckets.items())
    cost_forecast_points: list[dict[str, float | str]] = []
    if f.granularity == "monthly" and cost_forecast_resp.points:
        cost_forecast_points = [{"period": p.period, "value": p.value} for p in cost_forecast_resp.points]
    if not cost_forecast_points and cost_actuals:
        cost_series = _period_series(cost_actuals, min_points=_min_series_points(f))
        cost_forecast_points = (
            _forecast_series(cost_series, 3, granularity=f.granularity) if cost_series is not None else []
        )
    planning_pred_cost = (
        _empty("Insufficient data.")
        if not cost_actuals and not cost_forecast_points
        else _block(
            kpis=[
                {
                    "label": "Next horizon",
                    "value": cost_forecast_points[0]["period"] if cost_forecast_points else "—",
                }
            ],
            chart=_combine_forecast_chart(
                cost_actuals,
                cost_forecast_points or None,
                actual_key="actual_cost_php",
                forecast_key="forecast_cost_php",
            ),
            drilldown=[],
            statistics=compute_statistics([float(v) for _, v in cost_actuals], min_samples=1) if cost_actuals else None,
            note="Forecast from completed trip cost time series (Holt-Winters).",
        )
    )

    fuel_actuals = _monthly_fuel_actuals(ctx, f)
    fuel_series = _period_series(fuel_actuals, min_points=_min_series_points(f))
    fuel_forecast = _forecast_series(fuel_series, 3, granularity=f.granularity) if fuel_series is not None else None
    completed = [t for t in _filtered_trips(ctx, f) if t.status == TripStatus.COMPLETED and (t.distance_km or 0) > 0]
    if fuel_actuals or completed:
        avg_dist = (
            sum(float(t.distance_km or 0) for t in completed) / len(completed)
            if completed
            else None
        )
        avg_load = 5.0
        sample_truck = next((t.truck for t in completed if t.truck and t.truck.fuel_efficiency_kmpl), None) if completed else None
        pred = (
            predict_fuel_consumption(
                FuelPredictRequest(
                    distance_km=avg_dist,
                    cargo_weight_tons=avg_load,
                    avg_speed_kmh=45,
                    road_condition="highway",
                    vehicle_fuel_efficiency_kmpl=float(sample_truck.fuel_efficiency_kmpl) if sample_truck else 4.0,
                )
            )
            if avg_dist is not None
            else None
        )
        fuel_chart = (
            _combine_forecast_chart(
                fuel_actuals,
                fuel_forecast,
                actual_key="actual_fuel_php",
                forecast_key="forecast_fuel_php",
            )
            if fuel_actuals
            else []
        )
        planning_pred_fuel = _block(
            kpis=[
                {"label": "Sample distance (km)", "value": round(avg_dist, 1) if avg_dist is not None else "—"},
                {
                    "label": "Predicted liters",
                    "value": round(pred.fuel_liters, 2) if pred else (fuel_forecast[0]["value"] if fuel_forecast else "—"),
                },
                {
                    "label": "Predicted fuel cost (₱)",
                    "value": round(pred.fuel_cost, 2) if pred else (fuel_actuals[-1][1] if fuel_actuals else "—"),
                },
            ],
            chart=fuel_chart,
            drilldown=fuel_rows[:50],
            statistics=compute_statistics([float(v) for _, v in fuel_actuals], min_samples=1) if fuel_actuals else None,
            note="Historical fuel spend by month with Holt-Winters forecast; sample liters from fleet average trip profile.",
        )
    else:
        planning_pred_fuel = _empty("Insufficient data.")

    completed_trips = [t for t in ctx["trips"] if t.completed_at]
    trip_month_counts: list[tuple[str, float]] = []
    period_buckets: dict[str, int] = defaultdict(int)
    for t in completed_trips:
        p = period_key(t.completed_at, f.granularity)
        if p:
            period_buckets[p] += 1
    trip_month_counts = sorted(period_buckets.items())
    demand_series = _period_series([(m, float(c)) for m, c in trip_month_counts], min_points=_min_series_points(f))
    demand_forecast = _forecast_series(demand_series, 3, granularity=f.granularity) if demand_series is not None else None
    planning_pred_demand = (
        _empty("Insufficient data.")
        if not demand_forecast
        else _block(
            kpis=[{"label": "Next period trips (est.)", "value": demand_forecast[0]["value"]}],
            chart=_combine_forecast_chart(
                [(m, float(c)) for m, c in trip_month_counts],
                demand_forecast,
                actual_key="actual_trips",
                forecast_key="forecast_trips",
            ),
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
        chart=[
            {"category": "Pending assignments", "count": pending_bookings},
            {"category": "Available trucks", "count": available_trucks},
        ],
        drilldown=[],
        note="Use Job assignment module for full recommend-assignment scoring.",
    )

    driver_month: dict[str, set[int]] = defaultdict(set)
    for trip in _filtered_trips(ctx, f):
        if trip.driver_id and trip.completed_at:
            p = period_key(trip.completed_at, f.granularity)
            if p:
                driver_month[p].add(trip.driver_id)
    workforce_counts = sorted((m, len(d)) for m, d in driver_month.items())
    workforce_series = _period_series([(m, float(c)) for m, c in workforce_counts], min_points=_min_series_points(f))
    workforce_forecast = (
        _forecast_series(workforce_series, 3, granularity=f.granularity) if workforce_series is not None else None
    )
    organizing_pred_workforce = (
        _empty("Insufficient data.")
        if not workforce_forecast
        else _block(
            kpis=[{"label": "Drivers needed (est.)", "value": workforce_forecast[0]["value"]}],
            chart=_combine_forecast_chart(
                [(m, float(c)) for m, c in workforce_counts],
                workforce_forecast,
                actual_key="actual_drivers",
                forecast_key="forecast_drivers",
            ),
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
    delay_month: dict[str, int] = defaultdict(int)
    for row in delay_candidates:
        if row.get("date") and row["date"] != "—":
            delay_month[str(row["date"])[:7]] += 1
    delay_chart = [{"period": m, "delay_count": c} for m, c in sorted(delay_month.items())[-12:]]
    execution_pred_delay = (
        _empty("Insufficient data.")
        if not delay_candidates and delay_rate is None
        else _block(
            kpis=[
                {"label": "At-risk / delayed trips", "value": len(delay_candidates)},
                {"label": "Historical delay rate %", "value": delay_rate if delay_rate is not None else "Insufficient data"},
            ],
            chart=delay_chart or [{"status": "at_risk", "delay_count": len(delay_candidates)}],
            drilldown=delay_candidates[:50],
            statistics=compute_statistics([float(c) for c in delay_month.values()], min_samples=1) if delay_month else None,
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
    controlling_desc_performance = _performance_reports_block(shipments, f)

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
                {
                    "label": "Total operational cost",
                    "value": f"₱{float(expenses.get('summary', {}).get('total_operational_cost_php') or 0):,.2f}",
                },
            ],
            chart=[
                {
                    "category": row["label"],
                    "amount_php": round(float(row.get("amount_php") or 0), 2),
                }
                for row in (expenses.get("expense_breakdown") or [])
                if float(row.get("amount_php") or 0) > 0
            ]
            or [
                {
                    "category": "Total Operational Cost",
                    "amount_php": round(
                        float(expenses.get("summary", {}).get("total_operational_cost_php") or 0),
                        2,
                    ),
                }
            ],
            drilldown=(expenses.get("drilldown") or {}).get("records") or [],
            note=(
                "Operational cost breakdown by category (fuel, toll, maintenance, allowances). "
                "Aggregates trip and maintenance expenses into a readable category view (PHP)."
            ),
        )
    )

    controlling_pred_maint = _maintenance_risk_prediction_block(db, ctx, f)

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
    controlling_pred_overrun = _cost_overrun_prediction_block(expenses, f, overrun_rows)

    # --- PERFORMANCE MONITORING ---
    perf_desc_success = _delivery_success_reports_block(shipments, f)

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
    perf_desc_fuel_eff = _fuel_efficiency_analysis_block(eff_rows, f)

    perf_desc_maint_freq = _maintenance_frequency_block(db, ctx, f)

    perf_pred_trend = _fleet_performance_trend_block(shipments, f)

    perf_pred_efficiency = _efficiency_improvement_block(eff_rows, f)

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
