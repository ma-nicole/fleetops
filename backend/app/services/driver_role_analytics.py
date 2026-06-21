"""Driver role analytics — five pillars scoped to the authenticated driver (real DB only)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import (
    BookingStatus,
    GeneralOperationalReport,
    MaintenanceRecord,
    Trip,
    TripIssue,
    TripStatus,
    TripStatusUpdate,
    User,
    VehicleIssueReport,
)
from app.services.admin_analytics import (
    AnalyticsFilters,
    _activity_date,
    _delivery_hours,
    _filtered_trips,
    _route_key,
    _shipment_category,
    _status_str,
)
from app.services.analytics_stats import compute_statistics
from app.services.manager_role_analytics import (
    _block,
    _combine_forecast_chart,
    _empty,
    _empty_predict,
    _forecast_series,
    _is_breakdown_issue,
    _monthly_series,
)
from app.services.time_bucket import period_date_range, period_key, sort_period_keys
from app.services.predictive.maintenance_model import predict_maintenance
from app.schemas.predict import MaintenancePredictRequest

ACTIVE_TRIP = frozenset(
    {
        TripStatus.ASSIGNED,
        TripStatus.ACCEPTED,
        TripStatus.DEPARTED,
        TripStatus.LOADING,
        TripStatus.IN_DELIVERY,
    }
)


def _driver_trips(ctx: dict, f: AnalyticsFilters, driver_id: int) -> list[Trip]:
    return [t for t in _filtered_trips(ctx, f) if t.driver_id == driver_id]


def _trip_is_delayed(trip: Trip) -> bool:
    now = datetime.utcnow()
    if trip.status != TripStatus.COMPLETED:
        if trip.estimated_delivery_time and trip.estimated_delivery_time < now:
            return True
        return False
    actual_hours = _delivery_hours(trip)
    scheduled_hours = float(trip.predicted_duration_hours or trip.duration_hours or 0)
    if actual_hours is not None and scheduled_hours > 0 and actual_hours - scheduled_hours > 1.0:
        return True
    end = trip.completed_at or trip.arrival_delivery_time
    if end and trip.estimated_delivery_time and end > trip.estimated_delivery_time:
        return True
    return False


def _normalize_delay_cause(reason: str) -> str:
    text = str(reason or "").strip().lower()
    if not text or text in {"—", "-", "unknown"}:
        return "Other"
    if any(k in text for k in ("traffic", "congestion", "jam", "edsa", "gridlock")):
        return "Traffic"
    if any(k in text for k in ("loading", "load delay", "warehouse", "dock", "loading_delay")):
        return "Loading Delay"
    if any(k in text for k in ("breakdown", "mechanical", "engine", "vehicle", "flat tire", "accident")):
        return "Breakdown"
    if any(k in text for k in ("weather", "rain", "storm", "flood", "typhoon")):
        return "Weather"
    if any(k in text for k in ("driver", "operator", "crew")):
        return "Driver Issue"
    if any(k in text for k in ("customs", "clearance", "hold")):
        return "Customs / Clearance"
    return "Other"


def _delay_records_chart(delay_rows: list[dict], *, limit: int = 12) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for row in delay_rows:
        cause = str(row.get("delay_cause") or _normalize_delay_cause(str(row.get("cause") or "")))
        counts[cause] += 1
    return [
        {"delay_cause": label, "delay_count": value}
        for label, value in sorted(counts.items(), key=lambda item: -item[1])[:limit]
    ]


_TRIP_PROGRESS_STATUS_ORDER = (
    "For Pickup",
    "Pending",
    "Assigned",
    "Accepted",
    "Departed",
    "Loading",
    "Picked Up",
    "En Route",
    "In Delivery",
    "Delayed",
    "Dropped Off",
    "Completed",
    "Cancelled",
)


def _format_trip_progress_status(status: str) -> str:
    normalized = str(status or "").strip().lower().replace("-", "_")
    labels = {
        "pending": "Pending",
        "assigned": "Assigned",
        "accepted": "Accepted",
        "for_pickup": "For Pickup",
        "departed": "Departed",
        "loading": "Loading",
        "picked_up": "Picked Up",
        "in_delivery": "En Route",
        "en_route": "En Route",
        "dropped_off": "Dropped Off",
        "completed": "Completed",
        "cancelled": "Cancelled",
        "delayed": "Delayed",
    }
    return labels.get(normalized, normalized.replace("_", " ").title())


def _resolve_trip_progress_status(trip: Trip, ctx: dict) -> str:
    """Map each trip to a single progress bucket including Delayed and En Route."""
    if trip.id in ctx.get("delay_logs", {}):
        return "Delayed"
    active_values = {s.value for s in ACTIVE_TRIP}
    status_raw = _status_str(trip.status).lower().replace("-", "_")
    is_active = status_raw in active_values or status_raw == "pending"

    if is_active:
        if _trip_is_delayed(trip):
            return "Delayed"
        if status_raw in {"in_delivery", "departed", "loading", "accepted", "en_route"}:
            return "En Route"
        return _format_trip_progress_status(status_raw)

    if trip.status == TripStatus.COMPLETED:
        if _trip_is_delayed(trip):
            return "Delayed"
        return "Completed"
    if trip.status == TripStatus.CANCELLED:
        return "Cancelled"
    return _format_trip_progress_status(status_raw)


def _trip_progress_status_chart(progress_rows: list[dict]) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for row in progress_rows:
        status = _format_trip_progress_status(str(row.get("trip_status") or row.get("status") or "Unknown"))
        counts[status] += 1
    chart: list[dict] = []
    seen: set[str] = set()
    for label in _TRIP_PROGRESS_STATUS_ORDER:
        count = counts.get(label, 0)
        if count > 0:
            chart.append({"trip_status": label, "trip_count": count})
            seen.add(label)
    for label, count in sorted(counts.items(), key=lambda item: -item[1]):
        if label not in seen:
            chart.append({"trip_status": label, "trip_count": count})
    return chart


def _trip_progress_status_chart_from_trips(trips: list[Trip], ctx: dict) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for trip in trips:
        counts[_resolve_trip_progress_status(trip, ctx)] += 1
    chart: list[dict] = []
    seen: set[str] = set()
    for label in _TRIP_PROGRESS_STATUS_ORDER:
        count = counts.get(label, 0)
        if count > 0:
            chart.append({"trip_status": label, "trip_count": count})
            seen.add(label)
    for label, count in sorted(counts.items(), key=lambda item: -item[1]):
        if label not in seen:
            chart.append({"trip_status": label, "trip_count": count})
    return chart


def _trip_has_delay_signal(trip: Trip, ctx: dict, *, now: datetime) -> bool:
    if trip.id in ctx["delay_logs"]:
        return True
    if _trip_is_delayed(trip):
        return True
    if trip.status != TripStatus.COMPLETED:
        if trip.estimated_delivery_time and trip.estimated_delivery_time < now:
            return True
    return False


def _delay_likelihood_prediction_chart(
    trips: list[Trip],
    ctx: dict,
    f: AnalyticsFilters,
    *,
    fuel_liters_by_trip: dict[int, float],
) -> tuple[list[dict], list[dict], str]:
    """Historical vs forecast delay likelihood (% trips with delay signals) by time bucket."""
    today = date.today()
    now = datetime.utcnow()
    period_delayed: dict[str, int] = defaultdict(int)
    period_total: dict[str, int] = defaultdict(int)
    drilldown: list[dict] = []

    for trip in trips:
        booking = trip.booking
        ref = _activity_date(
            trip.completed_at
            or trip.assigned_at
            or (booking.scheduled_date if booking else None)
        )
        if not ref or ref > today:
            continue
        bucket = period_key(ref, f.granularity)
        if not bucket:
            continue
        if not _period_within_filters(bucket, f.granularity, f, today=today):
            continue
        period_total[bucket] += 1
        if _trip_has_delay_signal(trip, ctx, now=now):
            period_delayed[bucket] += 1
            drilldown.append(
                _trip_row(
                    trip,
                    ctx,
                    fuel_liters_by_trip=fuel_liters_by_trip,
                    extra={"delay_signal": "yes"},
                )
            )

    keys = sort_period_keys(list(period_total.keys()), f.granularity)
    actuals = [
        (key, round((period_delayed[key] / period_total[key]) * 100, 1))
        for key in keys
        if period_total[key] > 0
    ]

    gran_label = f.granularity.replace("_", " ")
    if len(actuals) >= 2:
        min_pts = 2 if f.granularity in ("yearly", "quarterly") else 3
        series = _monthly_series(actuals, min_points=min_pts)
        forecast = _forecast_series(series, 3, granularity=f.granularity) if series is not None else None
        chart = _combine_forecast_chart(
            actuals,
            forecast,
            actual_key="actual_delay_rate_pct",
            forecast_key="forecast_delay_rate_pct",
        )
        note = (
            f"Historical vs forecasted delay likelihood (% of trips with delay signals) by {gran_label}. "
            "Click any point to drill Year → Quarter → Month → Week → Day."
        )
    elif len(actuals) == 1:
        period, rate = actuals[0]
        chart = [{"period": period, "actual_delay_rate_pct": rate, "series_type": "actual"}]
        note = (
            f"Delay likelihood for the selected {gran_label} bucket. "
            "Broaden filters or drill down for more periods."
        )
    else:
        delayed = sum(1 for trip in trips if _trip_has_delay_signal(trip, ctx, now=now))
        on_time = max(len(trips) - delayed, 0)
        chart = []
        if delayed:
            chart.append({"trip_outcome": "Delayed / At Risk", "trip_count": delayed})
        if on_time:
            chart.append({"trip_outcome": "On Time", "trip_count": on_time})
        note = "Delay likelihood from delay logs, late completions, and active trips past estimated delivery time."

    if not drilldown:
        drilldown = [
            _trip_row(trip, ctx, fuel_liters_by_trip=fuel_liters_by_trip)
            for trip in trips
            if _trip_has_delay_signal(trip, ctx, now=now)
        ]
    if not drilldown:
        drilldown = [_trip_row(trip, ctx, fuel_liters_by_trip=fuel_liters_by_trip) for trip in trips[:50]]

    return chart, drilldown[:50], note


def _driver_trip_status_category(trip: Trip) -> str:
    if _status_str(trip.status) in {s.value for s in ACTIVE_TRIP}:
        return "Ongoing"
    if trip.status == TripStatus.COMPLETED:
        return "Delayed" if _trip_is_delayed(trip) else "Completed"
    if trip.status == TripStatus.CANCELLED:
        return "Delayed"
    return "Ongoing"


def _period_counts_from_log_rows(log_rows: list[dict], granularity: str) -> dict[str, int]:
    """Count trips per period using drilldown delivery_date when ORM activity dates are missing."""
    period_counts: dict[str, int] = defaultdict(int)
    for row in log_rows:
        raw = row.get("delivery_date")
        if not raw or raw == "—":
            continue
        try:
            ref = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue
        bucket = period_key(ref, granularity)
        if bucket:
            period_counts[bucket] += 1
    return period_counts


def _trip_logs_chart(
    trips: list[Trip],
    log_rows: list[dict],
    f: AnalyticsFilters,
    *,
    deliveries_only: bool = False,
) -> tuple[list[dict], str]:
    """Period buckets for time drill-down; routes on single-day view; status only when no dates exist."""
    status_order = ("Completed", "Delayed", "Ongoing")
    chart_trips = (
        [trip for trip in trips if trip.status == TripStatus.COMPLETED] if deliveries_only else trips
    )

    if f.granularity == "daily" and f.date_from and f.date_to and (f.date_to - f.date_from).days <= 0:
        route_counts: dict[str, int] = defaultdict(int)
        for row in log_rows:
            route_counts[str(row.get("route") or "Unknown")] += 1
        chart = [
            {"route": route, "trip_count": count}
            for route, count in sorted(route_counts.items(), key=lambda item: -item[1])[:12]
        ]
        subject = "Completed deliveries per route" if deliveries_only else "Trips per route"
        return (
            chart,
            f"{subject} for the selected day — final drill-down after Year → Quarter → Month → Week → Day.",
        )

    period_counts: dict[str, int] = defaultdict(int)
    for trip in chart_trips:
        booking = trip.booking
        ref = _activity_date(trip.completed_at or trip.assigned_at or (booking.scheduled_date if booking else None))
        if not ref:
            continue
        bucket = period_key(ref, f.granularity)
        if bucket:
            period_counts[bucket] += 1

    if not period_counts and log_rows:
        period_counts = _period_counts_from_log_rows(log_rows, f.granularity)

    if period_counts:
        keys = sort_period_keys(list(period_counts.keys()), f.granularity)
        if f.granularity == "yearly":
            if f.date_from and f.date_to:
                keys = [str(y) for y in range(f.date_from.year, f.date_to.year + 1)]
            elif keys:
                years = [int(k) for k in keys if str(k).isdigit()]
                if years:
                    keys = [str(y) for y in range(min(years), max(years) + 1)]
        gran_label = f.granularity.replace("_", " ")
        subject = "Completed deliveries" if deliveries_only else "Trips"
        return (
            [{"period": key, "trip_count": period_counts.get(key, 0)} for key in keys],
            f"{subject} by {gran_label}. Click any bar to drill Year → Quarter → Month → Week → Day → Route.",
        )

    status_counts: dict[str, int] = defaultdict(int)
    for trip in trips:
        if deliveries_only and trip.status != TripStatus.COMPLETED:
            if _status_str(trip.status) in {s.value for s in ACTIVE_TRIP}:
                status_counts["Ongoing"] += 1
            continue
        status_counts[_driver_trip_status_category(trip)] += 1
    chart = [
        {"trip_status": label, "trip_count": status_counts.get(label, 0)}
        for label in status_order
        if status_counts.get(label, 0) > 0
    ]
    if deliveries_only:
        note = (
            "Completed deliveries by status (Completed, Delayed, Ongoing). "
            "Use time granularity and click period bars to drill down to daily routes."
        )
    else:
        note = (
            "Trips by delivery status (Completed, Delayed, Ongoing). "
            "Select a time granularity and click period bars to drill down to daily routes."
        )
    return chart, note


LUZON_REGION_ORDER = ("North Luzon", "Metro Manila", "South Luzon")

_METRO_MANILA_KEYWORDS = (
    "manila",
    "qc",
    "quezon city",
    "makati",
    "pasig",
    "caloocan",
    "taguig",
    "paranaque",
    "muntinlupa",
    "marikina",
    "valenzuela",
    "malabon",
    "navotas",
    "san juan",
    "pasay",
    "ncr",
    "metro",
)
_SOUTH_LUZON_KEYWORDS = (
    "batangas",
    "laguna",
    "cavite",
    "lucena",
    "lipa",
    "san pablo",
    "calabarzon",
    "south luzon",
    "alabang",
    "binan",
    "cabuyao",
    "sta. rosa",
    "st. rosa",
)
_NORTH_LUZON_KEYWORDS = (
    "tarlac",
    "pampanga",
    "bulacan",
    "cabanatuan",
    "baguio",
    "pangasinan",
    "clark",
    "subic",
    "north luzon",
    "san fernando",
    "angeles",
    "nueva ecija",
)


def _location_luzon_region(location: str | None) -> str | None:
    text = str(location or "").lower().replace("_", " ").replace("-", " ")
    if any(keyword in text for keyword in _METRO_MANILA_KEYWORDS):
        return "Metro Manila"
    if any(keyword in text for keyword in _SOUTH_LUZON_KEYWORDS):
        return "South Luzon"
    if any(keyword in text for keyword in _NORTH_LUZON_KEYWORDS):
        return "North Luzon"
    return None


def _trip_luzon_region(trip: Trip) -> str:
    booking = trip.booking
    if not booking:
        return "North Luzon"
    pickup = _location_luzon_region(booking.pickup_location)
    dropoff = _location_luzon_region(booking.dropoff_location)
    for region in ("Metro Manila", "South Luzon", "North Luzon"):
        if pickup == region or dropoff == region:
            return region
    return "North Luzon"


def _shipment_records_chart(
    trips: list[Trip],
    log_rows: list[dict],
    f: AnalyticsFilters,
) -> tuple[list[dict], str]:
    """Shipments per time period for Year → Quarter → Month → Week → Day drill-down."""
    period_counts: dict[str, int] = defaultdict(int)
    for trip in trips:
        booking = trip.booking
        ref = _activity_date(trip.completed_at or trip.assigned_at or (booking.scheduled_date if booking else None))
        if not ref:
            continue
        bucket = period_key(ref, f.granularity)
        if bucket:
            period_counts[bucket] += 1

    if not period_counts and log_rows:
        period_counts = _period_counts_from_log_rows(log_rows, f.granularity)

    if not period_counts:
        return [], "No shipment records for the selected filters."

    keys = sort_period_keys(list(period_counts.keys()), f.granularity)
    if f.granularity == "yearly":
        if f.date_from and f.date_to:
            keys = [str(y) for y in range(f.date_from.year, f.date_to.year + 1)]
        elif keys:
            years = [int(k) for k in keys if str(k).isdigit()]
            if years:
                keys = [str(y) for y in range(min(years), max(years) + 1)]
    gran_label = f.granularity.replace("_", " ")
    chart = [{"period": key, "trip_count": period_counts.get(key, 0)} for key in keys]
    note = (
        f"Shipments by {gran_label}. Use Time rollup and click bars to drill "
        "Year → Quarter → Month → Week → Day → Location."
    )
    return chart, note


def _region_trip_count_chart(trips: list[Trip], *, subject: str) -> tuple[list[dict], str]:
    region_counts: dict[str, int] = defaultdict(int)
    for trip in trips:
        region_counts[_trip_luzon_region(trip)] += 1
    chart = [
        {"region": region, "trip_count": region_counts.get(region, 0)}
        for region in LUZON_REGION_ORDER
    ]
    note = (
        f"{subject} aggregated by Luzon region (North Luzon, Metro Manila, South Luzon). "
        "Click any bar to drill down to individual routes."
    )
    return chart, note


def _region_distance_chart(trips: list[Trip]) -> tuple[list[dict], str]:
    region_distance: dict[str, float] = defaultdict(float)
    for trip in trips:
        region_distance[_trip_luzon_region(trip)] += float(trip.distance_km or 0)
    chart = [
        {"region": region, "distance_km": round(region_distance.get(region, 0), 2)}
        for region in LUZON_REGION_ORDER
    ]
    note = (
        "Total distance (km) aggregated by Luzon region (North Luzon, Metro Manila, South Luzon). "
        "Click any bar to drill down to individual trips."
    )
    return chart, note


def _trip_rows_with_region(
    trips: list[Trip],
    ctx: dict,
    *,
    fuel_liters_by_trip: dict[int, float],
    extra: dict | None = None,
) -> list[dict]:
    rows: list[dict] = []
    for trip in trips:
        row = _trip_row(trip, ctx, fuel_liters_by_trip=fuel_liters_by_trip, extra=extra)
        row["region"] = _trip_luzon_region(trip)
        rows.append(row)
    rows.sort(key=lambda r: r["delivery_date"], reverse=True)
    return rows


_DELIVERY_CONFIRMATION_STATUS_ORDER = ("Delivered", "Pending", "Failed")


def _delivery_confirmation_outcome(trip: Trip) -> str:
    if trip.status == TripStatus.COMPLETED:
        return "Delivered"
    if trip.status == TripStatus.CANCELLED:
        return "Failed"
    return "Pending"


def _delivery_confirmation_chart(trips: list[Trip]) -> tuple[list[dict], str]:
    """Delivery outcomes for pie chart: Delivered, Pending, Failed."""
    counts: dict[str, int] = defaultdict(int)
    for trip in trips:
        counts[_delivery_confirmation_outcome(trip)] += 1
    chart = [
        {"confirmation_status": status, "count": counts.get(status, 0)}
        for status in _DELIVERY_CONFIRMATION_STATUS_ORDER
        if counts.get(status, 0) > 0
    ]
    note = (
        "Delivery confirmation breakdown (Delivered, Pending, Failed). "
        "Click a slice to drill down to matching trip records."
    )
    return chart, note


def _completion_time_prediction_chart(
    completed: list[Trip],
    f: AnalyticsFilters,
) -> tuple[list[dict], str]:
    """Actual vs predicted average completion hours per time bucket."""
    today = date.today()
    actual_by_period: dict[str, list[float]] = defaultdict(list)
    predicted_by_period: dict[str, list[float]] = defaultdict(list)
    for trip in completed:
        ref = _activity_date(trip.completed_at)
        actual = _delivery_hours(trip)
        if not ref or actual is None:
            continue
        if ref > today:
            continue
        bucket = period_key(ref, f.granularity)
        if not bucket:
            continue
        predicted = float(trip.predicted_duration_hours or trip.duration_hours or 0)
        if predicted <= 0:
            continue
        actual_by_period[bucket].append(float(actual))
        predicted_by_period[bucket].append(predicted)

    period_keys = list(set(actual_by_period.keys()) | set(predicted_by_period.keys()))
    keys = [
        key
        for key in sort_period_keys(period_keys, f.granularity)
        if _period_within_filters(key, f.granularity, f, today=today)
    ]
    chart: list[dict] = []
    for key in keys:
        actual_vals = actual_by_period.get(key, [])
        pred_vals = predicted_by_period.get(key, [])
        if not actual_vals and not pred_vals:
            continue
        row: dict[str, float | str] = {"period": key}
        if actual_vals:
            row["actual_completion_hours"] = round(sum(actual_vals) / len(actual_vals), 2)
        if pred_vals:
            row["predicted_completion_hours"] = round(sum(pred_vals) / len(pred_vals), 2)
        chart.append(row)
    gran_label = f.granularity.replace("_", " ")
    note = (
        f"Actual vs predicted completion time (hours) by {gran_label}. "
        "Click any point to drill Year → Quarter → Month → Week → Day."
    )
    return chart, note


def _period_within_filters(period: str, granularity: str, f: AnalyticsFilters, *, today: date) -> bool:
    bounds = period_date_range(period, granularity)
    if not bounds:
        return True
    period_start = date.fromisoformat(bounds[0])
    period_end = date.fromisoformat(bounds[1])
    if period_start > today:
        return False
    if f.date_from and period_end < f.date_from:
        return False
    if f.date_to and period_start > f.date_to:
        return False
    return True


def _travel_time_report_chart(travel_rows: list[dict], f: AnalyticsFilters) -> tuple[list[dict], str]:
    """Average travel hours per time bucket; respects selected granularity (yearly first)."""
    today = date.today()
    period_values: dict[str, list[float]] = defaultdict(list)
    for row in travel_rows:
        raw = row.get("delivery_date")
        if not raw or raw == "—":
            continue
        try:
            ref = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue
        if ref > today:
            continue
        bucket = period_key(ref, f.granularity)
        if bucket:
            period_values[bucket].append(float(row["travel_time_hours"]))

    keys = [
        key
        for key in sort_period_keys(list(period_values.keys()), f.granularity)
        if _period_within_filters(key, f.granularity, f, today=today)
    ]
    chart = [
        {
            "period": key,
            "avg_travel_hours": round(sum(period_values[key]) / len(period_values[key]), 2),
        }
        for key in keys
        if period_values[key]
    ]
    gran_label = f.granularity.replace("_", " ")
    note = (
        f"Average travel time (hours) by {gran_label}. "
        "Click any point to drill Year → Quarter → Month → Week → Day."
    )
    return chart, note


def _trip_fuel_liters(trip: Trip, fuel_liters_by_trip: dict[int, float]) -> float:
    logged = float(fuel_liters_by_trip.get(trip.id, 0))
    if logged > 0:
        return logged
    predicted = float(trip.predicted_fuel_liters or 0)
    if predicted > 0:
        return predicted
    return 0.0


def _linear_regression_line(
    points: list[tuple[float, float]],
    *,
    steps: int = 16,
    y_key: str = "predicted_fuel_liters",
) -> list[dict]:
    if not points:
        return []
    if len(points) == 1:
        x, y = points[0]
        return [{"distance_km": x, y_key: y, "series_type": "regression"}]
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    den = sum((x - mean_x) ** 2 for x in xs)
    slope = sum((x - mean_x) * (y - mean_y) for x, y in points) / den if den else 0.0
    intercept = mean_y - slope * mean_x
    min_x = min(xs)
    max_x = max(xs)
    if max_x - min_x < 1:
        max_x = min_x + 1
    line: list[dict] = []
    for i in range(steps):
        x = min_x + (max_x - min_x) * i / max(steps - 1, 1)
        line.append(
            {
                "distance_km": round(x, 1),
                y_key: round(max(0.0, slope * x + intercept), 2),
                "series_type": "regression",
            }
        )
    return line


def _regression_at_x(pairs: list[tuple[float, float]], x: float) -> float:
    if not pairs:
        return 0.0
    if len(pairs) == 1:
        return round(pairs[0][1], 2)
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    den = sum((px - mean_x) ** 2 for px in xs)
    slope = sum((px - mean_x) * (y - mean_y) for (px, y) in pairs) / den if den else 0.0
    intercept = mean_y - slope * mean_x
    return round(max(0.0, slope * x + intercept), 2)


def _fuel_usage_regression_chart(
    trips: list[Trip],
    fuel_liters_by_trip: dict[int, float],
) -> tuple[list[dict], list[tuple[float, float]]]:
    actual_points: list[dict] = []
    pairs: list[tuple[float, float]] = []
    for trip in trips:
        dist = float(trip.distance_km or 0)
        if dist <= 0:
            continue
        liters = _trip_fuel_liters(trip, fuel_liters_by_trip)
        if liters <= 0:
            continue
        dist_r = round(dist, 1)
        liters_r = round(liters, 2)
        actual_points.append(
            {
                "distance_km": dist_r,
                "fuel_liters": liters_r,
                "series_type": "actual",
                "trip_id": trip.id,
            }
        )
        pairs.append((dist_r, liters_r))
    regression = _linear_regression_line(pairs, y_key="predicted_fuel_liters")
    return actual_points + regression, pairs


def _travel_time_estimation_chart(trips: list[Trip]) -> tuple[list[dict], list[tuple[float, float]]]:
    actual_points: list[dict] = []
    pairs: list[tuple[float, float]] = []
    for trip in trips:
        dist = float(trip.distance_km or 0)
        if dist <= 0:
            continue
        hours = _delivery_hours(trip)
        if hours is None or hours <= 0:
            continue
        dist_r = round(dist, 1)
        minutes_r = round(hours * 60, 2)
        actual_points.append(
            {
                "distance_km": dist_r,
                "travel_duration_minutes": minutes_r,
                "series_type": "actual",
                "trip_id": trip.id,
            }
        )
        pairs.append((dist_r, minutes_r))
    regression = _linear_regression_line(pairs, y_key="predicted_travel_minutes")
    return actual_points + regression, pairs


def _priority_to_severity(priority: str) -> tuple[str, int]:
    normalized = str(priority or "").lower()
    if "high" in normalized:
        return "High", 3
    if "medium" in normalized:
        return "Medium", 2
    return "Low", 1


def _maintenance_need_prediction_chart(
    trips: list[Trip],
    ctx: dict,
) -> tuple[list[dict], list[dict]]:
    trucks_by_id: dict[int, Any] = {}
    for trip in trips:
        if trip.truck:
            trucks_by_id[trip.truck_id] = trip.truck

    chart: list[dict] = []
    drilldown: list[dict] = []
    for truck in sorted(trucks_by_id.values(), key=lambda t: str(t.code)):
        maint_for_truck = [r for r in ctx["maintenance"] if r.truck_id == truck.id]
        recurring = len(maint_for_truck) >= 2
        base_cost = (
            sum(float(r.estimated_cost or r.actual_cost or 0) for r in maint_for_truck) / len(maint_for_truck)
            if maint_for_truck
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
        severity_label, severity_rank = _priority_to_severity(pred.priority_level)
        chart.append(
            {
                "truck": truck.code,
                "predicted_severity": severity_label,
                "severity_rank": severity_rank,
                "risk_score": pred.risk_score,
            }
        )
        drilldown.append(
            {
                "truck": truck.code,
                "predicted_severity": severity_label,
                "risk_score": pred.risk_score,
                "priority_level": pred.priority_level,
                "estimated_cost": pred.estimated_cost,
                "next_service_in_days": pred.next_service_in_days,
                "maintenance_records": len(maint_for_truck),
            }
        )
    return chart, drilldown


def _breakdown_risk_level(breakdown_count: int, trip_count: int) -> tuple[str, int]:
    if breakdown_count >= 3:
        return "High", 3
    rate = breakdown_count / trip_count if trip_count > 0 else 0.0
    if breakdown_count >= 2 or rate >= 0.35:
        return "High", 3
    if breakdown_count >= 1 or rate >= 0.15:
        return "Medium", 2
    return "Low", 1


def _breakdown_risk_prediction_chart(
    trips: list[Trip],
    breakdown_rows: list[dict],
) -> tuple[list[dict], list[dict]]:
    trucks_by_id: dict[int, Any] = {}
    truck_trip_counts: dict[int, int] = defaultdict(int)
    truck_breakdown_counts: dict[int, int] = defaultdict(int)
    trip_by_id = {t.id: t for t in trips}

    for trip in trips:
        if trip.truck:
            trucks_by_id[trip.truck_id] = trip.truck
            truck_trip_counts[trip.truck_id] += 1

    for row in breakdown_rows:
        trip_id = row.get("trip_id")
        if trip_id in (None, "—"):
            continue
        try:
            tid = int(trip_id)
        except (TypeError, ValueError):
            continue
        trip = trip_by_id.get(tid)
        if trip and trip.truck:
            truck_breakdown_counts[trip.truck_id] += 1

    chart: list[dict] = []
    drilldown: list[dict] = []
    for truck in sorted(trucks_by_id.values(), key=lambda t: str(t.code)):
        breakdown_count = truck_breakdown_counts.get(truck.id, 0)
        trip_count = truck_trip_counts.get(truck.id, 0)
        risk_label, risk_rank = _breakdown_risk_level(breakdown_count, trip_count)
        chart.append(
            {
                "truck": truck.code,
                "breakdown_risk": risk_label,
                "risk_rank": risk_rank,
                "breakdown_count": breakdown_count,
            }
        )
        drilldown.append(
            {
                "truck": truck.code,
                "breakdown_risk": risk_label,
                "breakdown_count": breakdown_count,
                "trip_count": trip_count,
            }
        )
    return chart, drilldown


def _trip_row(
    trip: Trip,
    ctx: dict,
    *,
    fuel_liters_by_trip: dict[int, float],
    extra: dict | None = None,
) -> dict:
    booking = trip.booking
    hours = _delivery_hours(trip)
    ref = _activity_date(trip.completed_at or trip.assigned_at or (booking.scheduled_date if booking else None))
    row = {
        "trip_id": trip.id,
        "booking_id": trip.booking_id,
        "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
        "truck": trip.truck.code if trip.truck else "—",
        "delivery_date": ref.isoformat() if ref else "—",
        "travel_time_hours": round(hours, 2) if hours is not None else "—",
        "fuel_usage_liters": round(fuel_liters_by_trip.get(trip.id, 0), 2),
        "status": _status_str(trip.status),
        "trip_status": _driver_trip_status_category(trip),
    }
    if extra:
        row.update(extra)
    return row


def build_driver_role_analytics(
    db: Session,
    ctx: dict,
    f: AnalyticsFilters,
    *,
    driver: User,
) -> dict[str, Any]:
    driver_id = driver.id
    scoped = AnalyticsFilters(
        date_from=f.date_from,
        date_to=f.date_to,
        driver_id=driver_id,
        truck_id=f.truck_id,
        route=f.route,
        shipment_status=f.shipment_status,
    )
    trips = _driver_trips(ctx, scoped, driver_id)
    trip_ids = {t.id for t in trips}

    fuel_liters_by_trip: dict[int, float] = defaultdict(float)
    for fl in ctx["fuel_logs"]:
        if fl.trip_id in trip_ids:
            fuel_liters_by_trip[fl.trip_id] += float(fl.liters or 0)

    # ------------------------------------------------------------------ #
    # 1. TRIP EXECUTION
    # ------------------------------------------------------------------ #
    log_rows = [_trip_row(t, ctx, fuel_liters_by_trip=fuel_liters_by_trip) for t in trips]
    log_rows.sort(key=lambda r: r["delivery_date"], reverse=True)
    log_chart, log_note = _trip_logs_chart(trips, log_rows, f)

    completed = [t for t in trips if t.status == TripStatus.COMPLETED]
    active = [t for t in trips if _status_str(t.status) in {s.value for s in ACTIVE_TRIP}]
    travel_hours = [h for t in trips if (h := _delivery_hours(t)) is not None]

    exec_desc_logs = (
        _empty("No data available yet.")
        if not log_rows
        else _block(
            kpis=[
                {"label": "Total trips", "value": len(trips)},
                {"label": "Completed", "value": len(completed)},
                {"label": "Active", "value": len(active)},
            ],
            chart=log_chart,
            drilldown=log_rows[:50],
            statistics=compute_statistics([int(row["trip_count"]) for row in log_chart], min_samples=1)
            if log_chart
            else None,
            note=log_note,
        )
    )

    completed_rows = [_trip_row(t, ctx, fuel_liters_by_trip=fuel_liters_by_trip) for t in completed]
    completed_rows.sort(key=lambda r: r["delivery_date"], reverse=True)
    completed_chart, completed_note = _trip_logs_chart(
        trips,
        completed_rows,
        f,
        deliveries_only=True,
    )
    on_time = sum(1 for t in completed if not _trip_is_delayed(t))
    exec_desc_completed = (
        _empty("No data available yet.")
        if not trips
        else _block(
            kpis=[
                {"label": "Completed deliveries", "value": len(completed_rows)},
                {"label": "On-time", "value": on_time},
                {"label": "Late completed", "value": len(completed_rows) - on_time},
            ],
            chart=completed_chart,
            drilldown=completed_rows[:50] if completed_rows else log_rows[:50],
            statistics=compute_statistics([int(row["trip_count"]) for row in completed_chart], min_samples=1)
            if completed_chart
            else None,
            note=completed_note,
        )
    )

    travel_rows = [
        _trip_row(t, ctx, fuel_liters_by_trip=fuel_liters_by_trip)
        for t in completed
        if _delivery_hours(t) is not None
    ]
    travel_chart, travel_note = _travel_time_report_chart(travel_rows, f)
    exec_desc_travel = (
        _empty("No data available yet.")
        if not travel_rows
        else _block(
            kpis=[
                {
                    "label": "Avg trip duration (hrs)",
                    "value": round(sum(travel_hours) / len(travel_hours), 2),
                },
                {"label": "Records", "value": len(travel_rows)},
            ],
            chart=travel_chart,
            drilldown=travel_rows[:50],
            statistics=compute_statistics(
                [float(row["avg_travel_hours"]) for row in travel_chart],
                min_samples=1,
            )
            if travel_chart
            else compute_statistics(travel_hours, min_samples=1),
            note=travel_note,
        )
    )

    duration_per_km: list[float] = []
    for t in completed:
        h = _delivery_hours(t)
        d = float(t.distance_km or 0)
        if h is not None and d > 0:
            duration_per_km.append(h / d)
    sample_trip = next((t for t in active if (t.distance_km or 0) > 0), None)
    if not sample_trip:
        sample_trip = next((t for t in completed if (t.distance_km or 0) > 0), None)
    if sample_trip and duration_per_km:
        avg_rate = sum(duration_per_km) / len(duration_per_km)
        predicted_hours = round(float(sample_trip.distance_km or 0) * avg_rate, 2)
        exec_pred_duration = _block(
            kpis=[
                {"label": "Sample distance (km)", "value": round(float(sample_trip.distance_km or 0), 1)},
                {"label": "Predicted duration (hrs)", "value": predicted_hours},
            ],
            chart=travel_chart,
            drilldown=travel_rows[:30],
            note="Based on your historical hours-per-km on completed trips.",
        )
    else:
        exec_pred_duration = _empty_predict()

    fuel_completed = [t for t in completed if (t.distance_km or 0) > 0]
    fuel_chart, fuel_pairs = _fuel_usage_regression_chart(fuel_completed, fuel_liters_by_trip)
    if fuel_pairs:
        avg_dist = sum(p[0] for p in fuel_pairs) / len(fuel_pairs)
        regression_at_avg = _regression_at_x(fuel_pairs, avg_dist)
        exec_pred_fuel = _block(
            kpis=[
                {"label": "Trips sampled", "value": len(fuel_pairs)},
                {"label": "Avg distance (km)", "value": round(avg_dist, 1)},
                {"label": "Predicted liters (avg km)", "value": regression_at_avg},
            ],
            chart=fuel_chart,
            drilldown=completed_rows[:30],
            statistics=compute_statistics([p[1] for p in fuel_pairs], min_samples=1),
            note=(
                "Fuel Usage Prediction using Linear Regression. "
                "Blue dots are actual liters vs distance traveled; the red line is the predicted trend."
            ),
        )
    else:
        exec_pred_fuel = _empty_predict()

    # ------------------------------------------------------------------ #
    # 2. ROUTE NAVIGATION
    # ------------------------------------------------------------------ #
    route_stats: dict[str, dict] = defaultdict(lambda: {"count": 0, "distance_km": 0.0, "hours": []})
    for trip in trips:
        booking = trip.booking
        if not booking:
            continue
        rk = _route_key(booking.pickup_location, booking.dropoff_location)
        route_stats[rk]["count"] += 1
        route_stats[rk]["distance_km"] += float(trip.distance_km or 0)
        h = _delivery_hours(trip)
        if h is not None:
            route_stats[rk]["hours"].append(h)

    route_rows = [
        {
            "route": rk,
            "trip_count": v["count"],
            "distance_km": round(v["distance_km"], 2),
            "avg_travel_hours": round(sum(v["hours"]) / len(v["hours"]), 2) if v["hours"] else "—",
            "status": "frequent" if v["count"] >= 2 else "occasional",
        }
        for rk, v in route_stats.items()
    ]
    route_rows.sort(key=lambda r: -int(r["trip_count"]))
    total_distance = round(sum(float(t.distance_km or 0) for t in trips), 2)
    nav_drilldown = _trip_rows_with_region(trips, ctx, fuel_liters_by_trip=fuel_liters_by_trip)
    history_chart, history_note = _region_trip_count_chart(trips, subject="Route history")
    _, past_routes_note = _region_trip_count_chart(trips, subject="Past delivery routes")
    nav_region_kpis = [
        {"label": "Total trips", "value": len(trips)},
        {
            "label": "North Luzon",
            "value": sum(1 for trip in trips if _trip_luzon_region(trip) == "North Luzon"),
        },
        {
            "label": "Metro Manila",
            "value": sum(1 for trip in trips if _trip_luzon_region(trip) == "Metro Manila"),
        },
    ]
    nav_region_stats = (
        compute_statistics([int(row["trip_count"]) for row in history_chart], min_samples=1)
        if history_chart
        else None
    )

    nav_desc_history = (
        _empty("No data available yet.")
        if not trips
        else _block(
            kpis=nav_region_kpis,
            chart=history_chart,
            drilldown=nav_drilldown[:50],
            statistics=nav_region_stats,
            note=history_note,
        )
    )

    distance_chart, distance_note = _region_distance_chart(trips)
    distance_rows = [
        _trip_row(t, ctx, fuel_liters_by_trip=fuel_liters_by_trip, extra={"distance_km": round(float(t.distance_km or 0), 2)})
        for t in trips
        if (t.distance_km or 0) > 0
    ]
    for row in distance_rows:
        trip = next((t for t in trips if t.id == row["trip_id"]), None)
        if trip:
            row["region"] = _trip_luzon_region(trip)
    nav_desc_distance = (
        _empty("No data available yet.")
        if not distance_rows
        else _block(
            kpis=[{"label": "Total distance (km)", "value": total_distance}],
            chart=distance_chart,
            drilldown=distance_rows[:50],
            statistics=compute_statistics([float(r["distance_km"]) for r in distance_rows], min_samples=1),
            note=distance_note,
        )
    )

    nav_desc_past_routes = (
        _empty("No data available yet.")
        if not trips
        else _block(
            kpis=nav_region_kpis,
            chart=history_chart,
            drilldown=nav_drilldown[:50],
            statistics=nav_region_stats,
            note=past_routes_note,
        )
    )

    routes_with_hours = [r for r in route_rows if r["avg_travel_hours"] != "—"]
    routes_with_hours.sort(key=lambda r: float(r["avg_travel_hours"]))
    nav_pred_optimal = (
        _empty_predict()
        if not routes_with_hours
        else _block(
            kpis=[{"label": "Fastest personal route", "value": routes_with_hours[0]["route"][:48]}],
            chart=[{"route": row["route"], "avg_travel_hours": row["avg_travel_hours"]} for row in routes_with_hours[:12]],
            drilldown=routes_with_hours,
            note="Route with lowest average travel time on your completed trips.",
        )
    )

    travel_completed = [t for t in completed if (t.distance_km or 0) > 0]
    travel_est_chart, travel_est_pairs = _travel_time_estimation_chart(travel_completed)
    if travel_est_pairs:
        avg_dist = sum(p[0] for p in travel_est_pairs) / len(travel_est_pairs)
        nav_pred_travel = _block(
            kpis=[
                {"label": "Trips sampled", "value": len(travel_est_pairs)},
                {"label": "Avg distance (km)", "value": round(avg_dist, 1)},
                {"label": "Predicted duration (min)", "value": _regression_at_x(travel_est_pairs, avg_dist)},
            ],
            chart=travel_est_chart,
            drilldown=travel_rows[:30],
            statistics=compute_statistics([p[1] for p in travel_est_pairs], min_samples=1),
            note=(
                "Travel Time Estimation using Linear Regression. "
                "Blue dots are actual travel duration (minutes) vs distance; the red line is the predicted trend."
            ),
        )
    else:
        nav_pred_travel = _empty_predict()

    # ------------------------------------------------------------------ #
    # 3. DELIVERY REPORTING
    # ------------------------------------------------------------------ #
    confirmation_drilldown = []
    for trip in trips:
        confirmation_drilldown.append(
            _trip_row(
                trip,
                ctx,
                fuel_liters_by_trip=fuel_liters_by_trip,
                extra={
                    "pod_confirmed": bool(getattr(trip, "proof_of_delivery", None) or getattr(trip, "pod_notes", None)),
                    "confirmation_status": _delivery_confirmation_outcome(trip),
                },
            )
        )
    confirmation_drilldown.sort(key=lambda r: r["delivery_date"], reverse=True)
    confirm_chart, confirm_note = _delivery_confirmation_chart(trips)
    delivered_count = sum(1 for trip in trips if _delivery_confirmation_outcome(trip) == "Delivered")
    pending_count = sum(1 for trip in trips if _delivery_confirmation_outcome(trip) == "Pending")
    failed_count = sum(1 for trip in trips if _delivery_confirmation_outcome(trip) == "Failed")
    report_desc_confirm = (
        _empty("No data available yet.")
        if not trips
        else _block(
            kpis=[
                {"label": "Delivered", "value": delivered_count},
                {"label": "Pending", "value": pending_count},
                {"label": "Failed", "value": failed_count},
            ],
            chart=confirm_chart,
            drilldown=confirmation_drilldown[:50],
            statistics=compute_statistics([float(row["count"]) for row in confirm_chart], min_samples=1)
            if confirm_chart
            else None,
            note=confirm_note,
        )
    )

    shipment_drilldown = [
        _trip_row(t, ctx, fuel_liters_by_trip=fuel_liters_by_trip, extra={"region": _trip_luzon_region(t)})
        for t in trips
    ]
    shipment_drilldown.sort(key=lambda r: r["delivery_date"], reverse=True)
    shipment_chart, shipment_note = _shipment_records_chart(trips, shipment_drilldown, f)
    report_desc_shipments = (
        _empty("No data available yet.")
        if not trips
        else _block(
            kpis=[
                {"label": "Total shipments", "value": len(trips)},
                {
                    "label": "Completed",
                    "value": sum(1 for trip in trips if trip.status == TripStatus.COMPLETED),
                },
            ],
            chart=shipment_chart,
            drilldown=shipment_drilldown[:50],
            statistics=compute_statistics([float(row["trip_count"]) for row in shipment_chart], min_samples=1)
            if shipment_chart
            else None,
            note=shipment_note,
        )
    )

    completion_chart, completion_note = _completion_time_prediction_chart(completed, f)
    actual_completion_vals = [
        float(row["actual_completion_hours"])
        for row in completion_chart
        if row.get("actual_completion_hours") is not None
    ]
    predicted_completion_vals = [
        float(row["predicted_completion_hours"])
        for row in completion_chart
        if row.get("predicted_completion_hours") is not None
    ]
    report_pred_completion = (
        _empty_predict()
        if not completion_chart
        else _block(
            kpis=[
                {
                    "label": "Avg actual (hrs)",
                    "value": round(sum(actual_completion_vals) / len(actual_completion_vals), 2)
                    if actual_completion_vals
                    else "—",
                },
                {
                    "label": "Avg predicted (hrs)",
                    "value": round(sum(predicted_completion_vals) / len(predicted_completion_vals), 2)
                    if predicted_completion_vals
                    else "—",
                },
            ],
            chart=completion_chart,
            drilldown=completed_rows[:30],
            statistics=compute_statistics(actual_completion_vals, min_samples=1)
            if actual_completion_vals
            else None,
            note=completion_note,
        )
    )

    # ------------------------------------------------------------------ #
    # 4. VEHICLE MONITORING
    # ------------------------------------------------------------------ #
    truck_usage: dict[str, dict] = defaultdict(lambda: {"trips": 0, "distance_km": 0.0})
    truck_ids: set[int] = set()
    for trip in trips:
        if not trip.truck:
            continue
        truck_ids.add(trip.truck_id)
        code = trip.truck.code
        truck_usage[code]["trips"] += 1
        truck_usage[code]["distance_km"] += float(trip.distance_km or 0)

    usage_rows = [
        {
            "truck": code,
            "trip_count": v["trips"],
            "distance_km": round(v["distance_km"], 2),
            "status": "assigned",
        }
        for code, v in sorted(truck_usage.items(), key=lambda x: -x[1]["trips"])
    ]
    usage_trip_rows: list[dict] = []
    for trip in trips:
        if not trip.truck:
            continue
        booking = trip.booking
        ref = _activity_date(trip.completed_at or trip.assigned_at or (booking.scheduled_date if booking else None))
        usage_trip_rows.append(
            {
                "trip_id": trip.id,
                "booking_id": trip.booking_id,
                "truck": trip.truck.code,
                "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
                "delivery_date": ref.isoformat() if ref else "—",
                "status": _status_str(trip.status),
                "distance_km": round(float(trip.distance_km or 0), 2),
            }
        )
    usage_trip_rows.sort(key=lambda r: (r["truck"], r["delivery_date"]), reverse=True)
    vehicle_desc_usage = (
        _empty("No data available yet.")
        if not usage_rows
        else _block(
            kpis=[{"label": "Vehicles used", "value": len(usage_rows)}],
            chart=[{"truck": row["truck"], "trip_count": row["trip_count"]} for row in usage_rows[:12]],
            drilldown=usage_trip_rows,
            note="Trip count per assigned vehicle. Click a bar to view individual trips for that truck.",
        )
    )

    maint_rows = []
    maint_by_truck: dict[str, int] = defaultdict(int)
    truck_codes: dict[int, str] = {}
    for trip in trips:
        if trip.truck:
            truck_codes[trip.truck_id] = trip.truck.code
    for rec in ctx["maintenance"]:
        if rec.truck_id not in truck_ids:
            continue
        truck_code = truck_codes.get(rec.truck_id, f"Truck #{rec.truck_id}")
        maint_by_truck[truck_code] += 1
        ref = _activity_date(rec.created_at)
        maint_rows.append(
            {
                "trip_id": "—",
                "booking_id": "—",
                "truck": truck_code,
                "route": "—",
                "delivery_date": ref.isoformat() if ref else "—",
                "status": _status_str(rec.status),
                "reported_issue": rec.reported_issue,
                "severity": rec.severity,
            }
        )
    maint_rows.sort(key=lambda r: r["delivery_date"], reverse=True)
    maint_chart = [
        {"truck": truck, "report_count": count}
        for truck, count in sorted(maint_by_truck.items(), key=lambda item: -item[1])
    ]
    vehicle_desc_maint = (
        _empty("No data available yet.")
        if not maint_rows
        else _block(
            kpis=[
                {"label": "Total reports", "value": len(maint_rows)},
                {"label": "Trucks affected", "value": len(maint_by_truck)},
                {
                    "label": "Resolved",
                    "value": sum(1 for row in maint_rows if str(row.get("status", "")).lower() == "resolved"),
                },
            ],
            chart=maint_chart,
            drilldown=maint_rows[:50],
            statistics=compute_statistics([float(v) for v in maint_by_truck.values()], min_samples=1),
            note="Maintenance reports per truck (includes open and resolved records).",
        )
    )

    maint_pred_chart, maint_pred_drilldown = _maintenance_need_prediction_chart(trips, ctx)
    if maint_pred_chart:
        vehicle_pred_maint = _block(
            kpis=[
                {"label": "Trucks assessed", "value": len(maint_pred_chart)},
                {
                    "label": "High severity",
                    "value": sum(1 for row in maint_pred_chart if row["predicted_severity"] == "High"),
                },
                {
                    "label": "Avg risk score",
                    "value": round(
                        sum(float(row["risk_score"]) for row in maint_pred_chart) / len(maint_pred_chart),
                        3,
                    ),
                },
            ],
            chart=maint_pred_chart,
            drilldown=maint_pred_drilldown,
            statistics=compute_statistics(
                [float(row["severity_rank"]) for row in maint_pred_chart],
                min_samples=1,
            ),
            note="Predicted maintenance severity per assigned truck (Low, Medium, High).",
        )
    else:
        vehicle_pred_maint = _empty_predict()

    breakdown_rows = []
    for issue in db.query(TripIssue).filter(TripIssue.trip_id.in_(trip_ids)).order_by(TripIssue.created_at.desc()).limit(50).all():
        if not _is_breakdown_issue(issue.issue_type):
            continue
        trip = next((t for t in trips if t.id == issue.trip_id), None)
        if trip:
            breakdown_rows.append(_trip_row(trip, ctx, fuel_liters_by_trip=fuel_liters_by_trip, extra={"cause": issue.issue_type}))
    for vir in db.query(VehicleIssueReport).filter(VehicleIssueReport.trip_id.in_(trip_ids)).order_by(VehicleIssueReport.created_at.desc()).limit(50).all():
        trip = next((t for t in trips if t.id == vir.trip_id), None)
        if trip:
            breakdown_rows.append(_trip_row(trip, ctx, fuel_liters_by_trip=fuel_liters_by_trip, extra={"cause": vir.issue_type}))
    breakdown_risk_chart, breakdown_risk_drilldown = _breakdown_risk_prediction_chart(trips, breakdown_rows)
    vehicle_pred_breakdown = (
        _empty_predict()
        if not breakdown_risk_chart
        else _block(
            kpis=[
                {"label": "Trucks assessed", "value": len(breakdown_risk_chart)},
                {
                    "label": "High risk",
                    "value": sum(1 for row in breakdown_risk_chart if row["breakdown_risk"] == "High"),
                },
                {"label": "Breakdown reports", "value": len(breakdown_rows)},
            ],
            chart=breakdown_risk_chart,
            drilldown=breakdown_rows[:50] if breakdown_rows else breakdown_risk_drilldown,
            statistics=compute_statistics(
                [float(row["risk_rank"]) for row in breakdown_risk_chart],
                min_samples=1,
            ),
            note="Predicted breakdown risk per assigned truck (Low, Medium, High).",
        )
    )

    # ------------------------------------------------------------------ #
    # 5. TRIP STATUS UPDATING
    # ------------------------------------------------------------------ #
    progress_rows: list[dict] = []
    trip_by_id = {t.id: t for t in trips}
    if trip_ids:
        updates = (
            db.query(TripStatusUpdate)
            .filter(TripStatusUpdate.trip_id.in_(trip_ids))
            .order_by(TripStatusUpdate.created_at.desc())
            .limit(200)
            .all()
        )
        for upd in updates:
            trip = trip_by_id.get(upd.trip_id)
            if not trip:
                continue
            ref = _activity_date(upd.created_at)
            display_status = _format_trip_progress_status(upd.status)
            progress_rows.append(
                _trip_row(
                    trip,
                    ctx,
                    fuel_liters_by_trip=fuel_liters_by_trip,
                    extra={
                        "trip_status": display_status,
                        "status": display_status,
                        "update_at": ref.isoformat() if ref else "—",
                    },
                )
            )
    if not progress_rows:
        for trip in trips:
            display_status = _resolve_trip_progress_status(trip, ctx)
            progress_rows.append(
                _trip_row(
                    trip,
                    ctx,
                    fuel_liters_by_trip=fuel_liters_by_trip,
                    extra={
                        "trip_status": display_status,
                        "status": display_status,
                    },
                )
            )
    else:
        trip_progress_drilldown = []
        for trip in trips:
            display_status = _resolve_trip_progress_status(trip, ctx)
            trip_progress_drilldown.append(
                _trip_row(
                    trip,
                    ctx,
                    fuel_liters_by_trip=fuel_liters_by_trip,
                    extra={
                        "trip_status": display_status,
                        "status": display_status,
                    },
                )
            )
        if trip_progress_drilldown:
            progress_rows = trip_progress_drilldown + progress_rows

    progress_chart = _trip_progress_status_chart_from_trips(trips, ctx)

    status_desc_progress = (
        _empty("No data available yet.")
        if not progress_rows
        else _block(
            kpis=[
                {"label": "Trips tracked", "value": len(trips)},
                {"label": "Delayed", "value": sum(1 for trip in trips if _resolve_trip_progress_status(trip, ctx) == "Delayed")},
                {"label": "En Route", "value": sum(1 for trip in trips if _resolve_trip_progress_status(trip, ctx) == "En Route")},
            ],
            chart=progress_chart,
            drilldown=progress_rows[:50],
            statistics=compute_statistics([float(r["trip_count"]) for r in progress_chart], min_samples=1)
            if progress_chart
            else None,
            note=(
                "Trip progress by status (En Route, Delayed, Completed, and other lifecycle stages). "
                "Click a bar to drill down to matching trips or status updates."
            ),
        )
    )

    delay_rows: list[dict] = []
    for trip_id, reason in ctx["delay_logs"].items():
        if trip_id not in trip_ids:
            continue
        trip = next((t for t in trips if t.id == trip_id), None)
        if trip:
            delay_rows.append(_trip_row(trip, ctx, fuel_liters_by_trip=fuel_liters_by_trip, extra={"cause": reason, "status": "delayed"}))
    for rep in db.query(GeneralOperationalReport).filter(GeneralOperationalReport.driver_id == driver_id).order_by(
        GeneralOperationalReport.created_at.desc()
    ).limit(50).all():
        if rep.category != "delay_report":
            continue
        trip = next((t for t in trips if t.id == rep.trip_id), None) if rep.trip_id else None
        delay_rows.append(
            {
                "trip_id": rep.trip_id or "—",
                "booking_id": rep.booking_id or "—",
                "route": _route_key(trip.booking.pickup_location, trip.booking.dropoff_location) if trip and trip.booking else "—",
                "truck": trip.truck.code if trip and trip.truck else "—",
                "delivery_date": _activity_date(rep.report_date).isoformat() if rep.report_date else "—",
                "status": "delay_report",
                "cause": (rep.description or "")[:120],
            }
        )
    for row in delay_rows:
        row["delay_cause"] = _normalize_delay_cause(str(row.get("cause") or ""))
    delay_rows.sort(key=lambda r: r.get("delivery_date", ""), reverse=True)
    delay_cause_chart = _delay_records_chart(delay_rows)

    status_desc_delays = (
        _empty("No data available yet.")
        if not delay_rows
        else _block(
            kpis=[{"label": "Delay incidents", "value": len(delay_rows)}],
            chart=delay_cause_chart,
            drilldown=delay_rows[:50],
            statistics=compute_statistics([float(r["delay_count"]) for r in delay_cause_chart], min_samples=1)
            if delay_cause_chart
            else None,
            note="Historical delay occurrences grouped by cause. Click a bar to drill down to individual delay records.",
        )
    )

    delayed_count = sum(
        1
        for t in completed
        if t.booking and _shipment_category(t.booking, t, ctx["delay_logs"]) == "delayed"
    )
    delay_rate = round((delayed_count / len(completed)) * 100, 1) if completed else None
    at_risk = []
    now = datetime.utcnow()
    for trip in active:
        if trip.estimated_delivery_time and trip.estimated_delivery_time < now:
            at_risk.append(_trip_row(trip, ctx, fuel_liters_by_trip=fuel_liters_by_trip, extra={"status": "past_eta"}))
    delay_likelihood_chart, delay_likelihood_drilldown, delay_likelihood_note = _delay_likelihood_prediction_chart(
        trips,
        ctx,
        f,
        fuel_liters_by_trip=fuel_liters_by_trip,
    )
    delay_rate_values = [
        float(row["actual_delay_rate_pct"])
        for row in delay_likelihood_chart
        if row.get("actual_delay_rate_pct") is not None
    ]
    if not delay_rate_values:
        delay_rate_values = [
            float(row["trip_count"])
            for row in delay_likelihood_chart
            if row.get("trip_outcome") == "Delayed / At Risk" and row.get("trip_count") is not None
        ]
    status_pred_delay = (
        _empty_predict()
        if not trips
        else _block(
            kpis=[
                {"label": "Historical delay rate %", "value": delay_rate if delay_rate is not None else "Insufficient data"},
                {"label": "Active at-risk trips", "value": len(at_risk)},
                {"label": "Trips assessed", "value": len(trips)},
            ],
            chart=delay_likelihood_chart,
            drilldown=(delay_likelihood_drilldown + at_risk)[:50],
            statistics=compute_statistics(delay_rate_values, min_samples=1) if delay_rate_values else None,
            note=delay_likelihood_note,
        )
    )

    return {
        "trip_execution": {
            "descriptive": {
                "trip_logs": exec_desc_logs,
                "completed_deliveries": exec_desc_completed,
                "travel_time_reports": exec_desc_travel,
            },
            "predictive": {
                "trip_duration_prediction": exec_pred_duration,
                "fuel_usage_prediction": exec_pred_fuel,
            },
        },
        "route_navigation": {
            "descriptive": {
                "route_history": nav_desc_history,
                "distance_records": nav_desc_distance,
                "past_delivery_routes": nav_desc_past_routes,
            },
            "predictive": {
                "optimal_route_prediction": nav_pred_optimal,
                "travel_time_estimation": nav_pred_travel,
            },
        },
        "delivery_reporting": {
            "descriptive": {
                "delivery_confirmation_logs": report_desc_confirm,
                "shipment_records": report_desc_shipments,
            },
            "predictive": {
                "completion_time_prediction": report_pred_completion,
            },
        },
        "vehicle_monitoring": {
            "descriptive": {
                "vehicle_usage_logs": vehicle_desc_usage,
                "maintenance_records": vehicle_desc_maint,
            },
            "predictive": {
                "maintenance_need_prediction": vehicle_pred_maint,
                "breakdown_risk_prediction": vehicle_pred_breakdown,
            },
        },
        "trip_status": {
            "descriptive": {
                "trip_progress_updates": status_desc_progress,
                "delay_records": status_desc_delays,
            },
            "predictive": {
                "delay_likelihood_prediction": status_pred_delay,
            },
        },
    }
