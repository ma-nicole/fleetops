"""Dispatcher role analytics — six operational pillars (real DB only)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
import math
import statistics
from typing import Any

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.models.entities import (
    Booking,
    BookingStatus,
    FuelLog,
    GeneralOperationalReport,
    JobOrder,
    OperationalLog,
    Trip,
    TripIssue,
    TripStatus,
    TripStatusUpdate,
    Truck,
    User,
    UserRole,
    VehicleIssueReport,
)
from app.services.admin_analytics import (
    AnalyticsFilters,
    _activity_date,
    _delivery_hours,
    _filtered_trips,
    _route_key,
    _status_str,
)
from app.services.analytics_stats import compute_statistics
from app.services.dispatch_operations_center import ACTIVE_EXECUTION, _busy_resource_ids, build_operations_center_payload
from app.services.dispatcher_booking_assignment import (
    filter_bookings_for_dispatcher,
    filter_trips_for_dispatcher,
    has_dispatcher_booking_scope,
    job_order_assignment_map,
)
from app.services.manager_role_analytics import (
    _block,
    _combine_forecast_chart,
    _empty,
    _empty_predict,
    _forecast_series,
    _monthly_series,
)
from app.services.time_bucket import (
    GRANULARITY_OPTIONS,
    period_key,
    rollup_count_series,
    rollup_nested_series,
    series_from_buckets,
)
from app.services.prescriptive.assignment import recommend_assignment
from app.services.schedule_timeline import build_timeline

ACTIVE_TRIP = frozenset(
    {
        TripStatus.ASSIGNED,
        TripStatus.ACCEPTED,
        TripStatus.DEPARTED,
        TripStatus.LOADING,
        TripStatus.IN_DELIVERY,
    }
)


def _table_names(db: Session) -> set[str]:
    return set(inspect(db.get_bind()).get_table_names())


def _safe_operations_center(db: Session, viewer: User | None) -> dict[str, Any]:
    try:
        return build_operations_center_payload(db, viewer)
    except Exception:
        return {"summary": {"waiting_for_assignment": 0, "available_trucks": 0}}


def _safe_timeline(db: Session, start: str) -> dict[str, Any]:
    try:
        return build_timeline(db, start=start, mode="week", resource="truck", status_filter=None, q=None)
    except Exception:
        return {"conflicts": []}


def _safe_recommend_assignment(db: Session, booking_id: int):
    try:
        return recommend_assignment(db, booking_id)
    except Exception:
        return None


def _safe_busy_resource_ids(db: Session) -> tuple[set[int], set[int], set[int]]:
    try:
        return _busy_resource_ids(db)
    except Exception:
        return set(), set(), set()


def _query_if_table(db: Session, table: str, query_fn):
    if table not in _table_names(db):
        return []
    return query_fn()


def _scope_context(ctx: dict, db: Session, viewer: User | None) -> dict:
    if viewer is None or has_dispatcher_booking_scope(viewer):
        return ctx
    scoped = dict(ctx)
    scoped["trips"] = filter_trips_for_dispatcher(db, viewer, ctx["trips"])
    scoped["bookings"] = filter_bookings_for_dispatcher(db, viewer, ctx["bookings"])
    trips_by_booking: dict[int, list[Trip]] = defaultdict(list)
    for t in scoped["trips"]:
        trips_by_booking[t.booking_id].append(t)
    scoped["trips_by_booking"] = trips_by_booking
    return scoped


def _dispatcher_lookup(db: Session, booking_ids: list[int]) -> tuple[dict[int, JobOrder], dict[int, str]]:
    jobs = job_order_assignment_map(db, booking_ids)
    dispatcher_ids = {j.assigned_dispatcher_id for j in jobs.values() if j.assigned_dispatcher_id}
    names: dict[int, str] = {}
    if dispatcher_ids:
        for u in db.query(User).filter(User.id.in_(dispatcher_ids)).all():
            names[u.id] = u.full_name
    return jobs, names


def _dispatcher_for(booking_id: int, jobs: dict[int, JobOrder], names: dict[int, str]) -> str:
    job = jobs.get(booking_id)
    if job and job.assigned_dispatcher_id:
        return names.get(job.assigned_dispatcher_id, "—")
    return "—"


def _count_by_field(rows: list[dict], field: str, *, limit: int = 12) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        counts[str(row.get(field) or "unknown")] += 1
    return [{field: label, "count": value} for label, value in sorted(counts.items(), key=lambda x: -x[1])[:limit]]


def _cause_count_chart(rows: list[dict], *, field: str = "cause", limit: int = 12) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        counts[str(row.get(field) or "unknown")] += 1
    return [{"cause": label, "count": value} for label, value in sorted(counts.items(), key=lambda x: -x[1])[:limit]]


_GRANULARITY_LABEL = {g: g.replace("ly", "").replace("i", "y") for g in GRANULARITY_OPTIONS}
_GRANULARITY_LABEL.update(
    {
        "yearly": "year",
        "quarterly": "quarter",
        "monthly": "month",
        "weekly": "week",
        "daily": "day",
    }
)


def _period_note(metric: str, granularity: str) -> str:
    unit = _GRANULARITY_LABEL.get(granularity, granularity)
    return (
        f"{metric} summarized by {unit}. "
        "Click a period on the chart to drill down Year → Quarter → Month → Week → Day."
    )


def _period_count_chart(rows: list[dict], date_field: str, granularity: str, *, limit: int = 24) -> list[dict]:
    buckets: dict[str, int] = defaultdict(int)
    for row in rows:
        raw = row.get(date_field)
        if not raw or raw == "—":
            continue
        try:
            ref = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue
        bucket = period_key(ref, granularity)
        if bucket:
            buckets[bucket] += 1
    return rollup_count_series(buckets, granularity, limit)


def _workload_forecast_chart(
    schedule_rows: list[dict],
    f: AnalyticsFilters,
) -> tuple[list[dict], list[dict[str, float | str]] | None]:
    """Trip volume actuals + forecast, capped for readable period axes."""
    limit = 24 if f.granularity in ("daily", "weekly") else 36
    period_rows = _period_count_chart(schedule_rows, "scheduled_date", f.granularity, limit=limit)
    actuals = [
        (str(row["period"]), float(row["count"]))
        for row in period_rows
        if row.get("period") is not None and row.get("count") is not None
    ]
    if not actuals:
        return [], None
    min_pts = 2 if f.granularity in ("yearly", "quarterly") else 3
    series = _monthly_series(actuals, min_points=min_pts)
    forecast = _forecast_series(series, 3, granularity=f.granularity) if series is not None else None
    chart = _combine_forecast_chart(
        actuals,
        forecast,
        actual_key="actual_trips",
        forecast_key="forecast_trips",
    )
    return chart, forecast


def _period_avg_chart(
    rows: list[dict],
    date_field: str,
    value_field: str,
    granularity: str,
    *,
    limit: int = 24,
) -> list[dict]:
    buckets: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        raw = row.get(date_field)
        value = row.get(value_field)
        if not raw or raw == "—" or value is None or value == "—":
            continue
        try:
            ref = date.fromisoformat(str(raw)[:10])
            numeric = float(value)
        except (ValueError, TypeError):
            continue
        bucket = period_key(ref, granularity)
        if bucket:
            buckets[bucket].append(numeric)
    if not buckets:
        return []
    averages = {key: sum(values) / len(values) for key, values in buckets.items()}
    return series_from_buckets(averages, granularity, limit, value_key="avg_hours")


def _trip_period_status_chart(trips: list[Trip], granularity: str, *, limit: int = 24) -> list[dict]:
    buckets: dict[str, dict[str, float]] = defaultdict(lambda: {"completed": 0.0, "active": 0.0})
    for trip in trips:
        if trip.status == TripStatus.COMPLETED:
            ref = trip.completed_at or trip.assigned_at
            bucket_key = "completed"
        elif trip.status in ACTIVE_TRIP:
            ref = trip.assigned_at or (trip.booking.scheduled_date if trip.booking else None)
            bucket_key = "active"
        else:
            continue
        if ref is None:
            continue
        ref_date = ref.date() if isinstance(ref, datetime) else ref
        period = period_key(ref_date, granularity)
        if period:
            buckets[period][bucket_key] += 1
    return rollup_nested_series(buckets, granularity, limit)


def _fleet_availability_chart(rows: list[dict]) -> list[dict]:
    available = sum(1 for row in rows if row.get("availability") == "available")
    busy = max(0, len(rows) - available)
    return [
        {"availability": "available", "count": available},
        {"availability": "busy", "count": busy},
    ]


_DISPATCH_EVENT_ORDER = ("Pickup", "Dropoff", "Refuel", "Break", "Maintenance")

_PICKUP_EVENT_TOKENS = frozenset(
    {
        "for_pickup",
        "picked_up",
        "pickup",
        "loading_unloading_issue",
        "route_change",
        "route_deviation",
        "loading",
    }
)
_DROPOFF_EVENT_TOKENS = frozenset(
    {
        "dropped_off",
        "dropoff",
        "drop_off",
        "completed",
        "delivery",
        "customs_hold",
        "customer_coordination_issue",
        "delivery_issue",
        "trip_completion",
    }
)
_REFUEL_EVENT_TOKENS = frozenset({"fuel_log", "fuel", "refuel", "fuel_toll_issue"})
_BREAK_EVENT_TOKENS = frozenset(
    {
        "break",
        "on_break",
        "rest",
        "delay",
        "traffic",
        "delivery_delay",
        "driver_helper_concern",
        "other_incident",
        "incident_report",
        "general_operational_update",
    }
)
_MAINTENANCE_EVENT_TOKENS = frozenset(
    {
        "maintenance",
        "maintenance_concern",
        "vehicle_concern",
        "breakdown",
        "mechanical",
        "warning_light",
        "extra_cost",
    }
)


def _classify_dispatch_event(raw: str) -> str | None:
    token = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    if not token:
        return None
    if token in _PICKUP_EVENT_TOKENS or "pickup" in token or token.startswith("load"):
        return "Pickup"
    if token in _DROPOFF_EVENT_TOKENS or "drop" in token or "deliver" in token:
        return "Dropoff"
    if token in _REFUEL_EVENT_TOKENS or "fuel" in token:
        return "Refuel"
    if token in _MAINTENANCE_EVENT_TOKENS or "maint" in token or "vehicle" in token:
        return "Maintenance"
    if token in _BREAK_EVENT_TOKENS:
        return "Break"
    return "Break"


def _dispatch_event_distribution_chart(
    db: Session,
    *,
    filtered_ids: set[int],
    dispatch_log_rows: list[dict],
) -> list[dict[str, Any]]:
    """Aggregate dispatcher-facing events into pickup / dropoff / refuel / break / maintenance slices."""
    counts: dict[str, int] = defaultdict(int)

    for row in dispatch_log_rows:
        event = _classify_dispatch_event(str(row.get("status") or row.get("report_type") or ""))
        if event:
            counts[event] += 1

    if filtered_ids:
        for tsu in _query_if_table(
            db,
            "trip_status_updates",
            lambda: db.query(TripStatusUpdate).filter(TripStatusUpdate.trip_id.in_(filtered_ids)).all(),
        ):
            event = _classify_dispatch_event(tsu.status)
            if event:
                counts[event] += 1

        for _fuel in _query_if_table(
            db,
            "fuel_logs",
            lambda: db.query(FuelLog).filter(FuelLog.trip_id.in_(filtered_ids)).all(),
        ):
            counts["Refuel"] += 1

        for rep in _query_if_table(
            db,
            "general_operational_reports",
            lambda: db.query(GeneralOperationalReport).filter(GeneralOperationalReport.trip_id.in_(filtered_ids)).all(),
        ):
            event = _classify_dispatch_event(str(rep.category or rep.status or ""))
            if event:
                counts[event] += 1

        for _issue in _query_if_table(
            db,
            "vehicle_issue_reports",
            lambda: db.query(VehicleIssueReport).filter(VehicleIssueReport.trip_id.in_(filtered_ids)).all(),
        ):
            counts["Maintenance"] += 1

    total = sum(counts.values())
    if total <= 0:
        return []

    chart: list[dict[str, Any]] = []
    for label in _DISPATCH_EVENT_ORDER:
        count = int(counts.get(label, 0))
        if count <= 0:
            continue
        chart.append(
            {
                "dispatch_event": label,
                "count": count,
                "share_pct": round((count / total) * 100, 1),
            }
        )
    chart.sort(key=lambda row: -int(row["count"]))
    return chart


def _capacity_snapshot_chart(*, pending: int, available: int, conflicts: int) -> list[dict]:
    return [
        {"category": "Pending assignment", "count": pending},
        {"category": "Available trucks", "count": available},
        {"category": "Schedule conflicts", "count": conflicts},
    ]


def _shortage_snapshot_chart(*, pending: int, available: int) -> list[dict]:
    return [
        {"category": "Pending bookings", "count": pending},
        {"category": "Available trucks", "count": available},
    ]


def _conflict_cause_chart(conflicts: list[dict], *, limit: int = 12) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for conflict in conflicts:
        for reason in conflict.get("reasons") or ["unknown"]:
            counts[str(reason)] += 1
    return [{"cause": label, "count": value} for label, value in sorted(counts.items(), key=lambda x: -x[1])[:limit]]


def _trip_schedule_window(trip: Trip) -> tuple[datetime | None, datetime | None]:
    start = trip.assigned_at
    if not start and trip.booking and trip.booking.scheduled_date:
        start = datetime.combine(trip.booking.scheduled_date, datetime.min.time())
    end = trip.estimated_delivery_time or trip.completed_at
    return start, end


def _detect_filtered_schedule_conflicts(trips: list[Trip]) -> list[dict]:
    """Overlap detection on filtered trips (same truck or driver)."""
    conflicts: list[dict] = []
    active = [t for t in trips if t.status != TripStatus.CANCELLED]

    def append_conflict(primary: Trip, secondary: Trip, reason: str) -> None:
        booking = secondary.booking
        conflicts.append(
            {
                "trip_id": secondary.id,
                "booking_id": secondary.booking_id,
                "reasons": [reason],
                "label": _route_key(booking.pickup_location, booking.dropoff_location)
                if booking
                else f"Trip {secondary.id}",
            }
        )

    for bucket_fn, reason in ((lambda t: t.truck_id, "overlap"), (lambda t: t.driver_id, "driver_overlap")):
        grouped: dict[int, list[Trip]] = defaultdict(list)
        for trip in active:
            resource_id = bucket_fn(trip)
            if resource_id:
                grouped[resource_id].append(trip)
        for resource_trips in grouped.values():
            ordered = sorted(resource_trips, key=lambda t: _trip_schedule_window(t)[0] or datetime.min)
            for idx, left in enumerate(ordered):
                left_start, left_end = _trip_schedule_window(left)
                if not left_start:
                    continue
                left_end = left_end or left_start
                for right in ordered[idx + 1 :]:
                    right_start, right_end = _trip_schedule_window(right)
                    if not right_start:
                        continue
                    right_end = right_end or right_start
                    if left_start < right_end and right_start < left_end:
                        append_conflict(left, right, reason)
    return conflicts


def _schedule_conflict_prediction_chart(
    conflicts: list[dict],
    *,
    pending: int,
    available: int,
) -> list[dict]:
    if conflicts:
        return _conflict_cause_chart(conflicts)
    chart: list[dict] = []
    pressure = max(0, pending - available)
    if pressure:
        chart.append({"cause": "Capacity pressure", "count": pressure})
    if pending:
        chart.append({"cause": "Pending assignment", "count": pending})
    if available:
        chart.append({"cause": "Available trucks", "count": available})
    if not chart:
        chart.append({"cause": "No conflicts predicted", "count": 1})
    return chart


def _travel_time_delay_hours(trip: Trip) -> float | None:
    """Actual minus scheduled travel time (hours). Negative = early, positive = delayed."""
    actual_hours = _delivery_hours(trip)
    scheduled_hours = float(trip.predicted_duration_hours or trip.duration_hours or 0)
    if actual_hours is not None and scheduled_hours > 0:
        return round(actual_hours - scheduled_hours, 1)

    actual_end = trip.completed_at or trip.arrival_delivery_time
    if actual_end and trip.estimated_delivery_time:
        return round((actual_end - trip.estimated_delivery_time).total_seconds() / 3600, 1)

    if actual_end and trip.departure_time and scheduled_hours > 0:
        scheduled_end = trip.departure_time + timedelta(hours=scheduled_hours)
        return round((actual_end - scheduled_end).total_seconds() / 3600, 1)
    return None


def _gaussian_kde(grid: list[float], samples: list[float]) -> list[float]:
    n = len(samples)
    if n == 0 or not grid:
        return [0.0] * len(grid)
    if n == 1:
        return [1.0 if abs(g - samples[0]) < 0.01 else 0.0 for g in grid]
    spread = statistics.pstdev(samples) if n > 1 else abs(samples[0]) * 0.15
    if spread <= 0:
        spread = max(abs(samples[0]), 1.0) * 0.15
    bandwidth = max(1.06 * spread * (n**-0.2), 0.75)
    norm = n * bandwidth * math.sqrt(2 * math.pi)
    return [
        sum(math.exp(-0.5 * ((g - sample) / bandwidth) ** 2) for sample in samples) / norm
        for g in grid
    ]


def _travel_delay_histogram(delays: list[float], *, bin_width: float = 4.0) -> list[dict[str, Any]]:
    if len(delays) < 2:
        return []
    lo = min(min(delays), 0.0)
    hi = max(max(delays), 0.0)
    lo = math.floor(lo / bin_width) * bin_width - bin_width / 2
    hi = math.ceil(hi / bin_width) * bin_width + bin_width / 2
    if hi - lo < bin_width * 2:
        lo -= bin_width
        hi += bin_width

    bin_centers: list[float] = []
    center = lo + bin_width / 2
    while center <= hi + 0.001:
        bin_centers.append(round(center, 1))
        center += bin_width

    counts = [0] * len(bin_centers)
    for delay in delays:
        idx = int((delay - lo) / bin_width)
        idx = max(0, min(len(bin_centers) - 1, idx))
        counts[idx] += 1

    density_raw = _gaussian_kde(bin_centers, delays)
    max_count = max(counts) if counts else 1
    max_density = max(density_raw) if density_raw else 1.0
    scale = max_count / max_density if max_density > 0 else 1.0

    return [
        {
            "delay_hours": bin_center,
            "trip_count": count,
            "density_curve": round(density * scale, 2),
        }
        for bin_center, count, density in zip(bin_centers, counts, density_raw)
    ]


def _trip_row(trip: Trip, jobs: dict[int, JobOrder], names: dict[int, str], *, extra: dict | None = None) -> dict:
    booking = trip.booking
    ref = _activity_date(booking.scheduled_date if booking else trip.assigned_at)
    row = {
        "booking_id": trip.booking_id,
        "trip_id": trip.id,
        "driver": trip.driver.full_name if trip.driver else "—",
        "truck": trip.truck.code if trip.truck else "—",
        "route": _route_key(booking.pickup_location, booking.dropoff_location) if booking else "—",
        "date": ref.isoformat() if ref else "—",
        "status": _status_str(trip.status),
        "dispatcher": _dispatcher_for(trip.booking_id, jobs, names),
    }
    if extra:
        row.update(extra)
    return row


def build_dispatcher_role_analytics(
    db: Session,
    ctx: dict,
    f: AnalyticsFilters,
    *,
    viewer: User | None,
    shipments: dict,
    fleet: dict,
    drivers: dict,
    routes: dict,
) -> dict[str, Any]:
    ctx = _scope_context(ctx, db, viewer)
    filtered_trips = _filtered_trips(ctx, f)
    filtered_ids = {t.id for t in filtered_trips}
    booking_ids = list({t.booking_id for t in filtered_trips} | {b.id for b in ctx["bookings"]})
    jobs, dispatcher_names = _dispatcher_lookup(db, booking_ids)
    today = date.today()

    # ------------------------------------------------------------------ #
    # 1. TRIP SCHEDULING
    # ------------------------------------------------------------------ #
    schedule_rows: list[dict] = []
    for trip in filtered_trips:
        booking = trip.booking
        if not booking or not booking.scheduled_date:
            continue
        schedule_rows.append(
            _trip_row(
                trip,
                jobs,
                dispatcher_names,
                extra={
                    "scheduled_date": booking.scheduled_date.isoformat(),
                    "time_slot": getattr(booking, "scheduled_time_slot", None) or "—",
                },
            )
        )
    schedule_rows.sort(key=lambda r: (r.get("scheduled_date", ""), r["trip_id"]))

    driver_trip_counts: dict[str, int] = defaultdict(int)
    for trip in filtered_trips:
        driver_name = trip.driver.full_name if trip.driver else "Unassigned"
        driver_trip_counts[driver_name] += 1
    driver_trip_chart = [
        {"driver": driver, "trip_count": count}
        for driver, count in sorted(driver_trip_counts.items(), key=lambda item: -item[1])
    ]

    sched_desc_trips = (
        _empty("No data available for the selected filters.")
        if not filtered_trips
        else _block(
            kpis=[
                {"label": "Total trips", "value": len(filtered_trips)},
                {"label": "Drivers with trips", "value": len(driver_trip_counts)},
                {
                    "label": "Most trips (driver)",
                    "value": driver_trip_chart[0]["driver"] if driver_trip_chart else "—",
                },
            ],
            chart=driver_trip_chart,
            drilldown=schedule_rows[:50] if schedule_rows else [_trip_row(t, jobs, dispatcher_names) for t in filtered_trips[:50]],
            statistics=compute_statistics([row["trip_count"] for row in driver_trip_chart], min_samples=1)
            if driver_trip_chart
            else None,
            note=(
                "Number of Trips per Driver. Horizontal bar chart showing how scheduled and assigned trips "
                "are distributed across drivers in the selected period — sorted highest to lowest."
            ),
        )
    )

    dispatch_log_rows: list[dict] = []
    for log in _query_if_table(
        db,
        "operational_logs",
        lambda: db.query(OperationalLog).order_by(OperationalLog.created_at.desc()).limit(100).all(),
    ):
        if log.trip_id and log.trip_id not in filtered_ids:
            continue
        trip = next((t for t in ctx["trips"] if t.id == log.trip_id), None) if log.trip_id else None
        if log.trip_id and not trip:
            continue
        booking_id = log.booking_id or (trip.booking_id if trip else None)
        dispatch_log_rows.append(
            {
                "booking_id": booking_id or "—",
                "trip_id": log.trip_id or "—",
                "driver": trip.driver.full_name if trip and trip.driver else "—",
                "truck": trip.truck.code if trip and trip.truck else "—",
                "route": _route_key(trip.booking.pickup_location, trip.booking.dropoff_location)
                if trip and trip.booking
                else "—",
                "date": _activity_date(log.created_at).isoformat() if log.created_at else "—",
                "status": log.report_type,
                "report_type": log.report_type,
                "dispatch_event": _classify_dispatch_event(log.report_type),
                "dispatcher": _dispatcher_for(booking_id, jobs, dispatcher_names) if booking_id else "—",
            }
        )
    dispatch_event_chart = _dispatch_event_distribution_chart(
        db,
        filtered_ids=filtered_ids,
        dispatch_log_rows=dispatch_log_rows,
    )
    sched_desc_dispatch = (
        _empty("No data available for the selected filters.")
        if not dispatch_event_chart
        else _block(
            kpis=[
                {"label": "Total dispatch events", "value": sum(int(row["count"]) for row in dispatch_event_chart)},
                {"label": "Top activity", "value": dispatch_event_chart[0]["dispatch_event"]},
                {"label": "Share (top)", "value": f"{dispatch_event_chart[0]['share_pct']}%"},
            ],
            chart=dispatch_event_chart,
            drilldown=dispatch_log_rows[:50],
            statistics=compute_statistics([row["count"] for row in dispatch_event_chart], min_samples=1),
            note=(
                "Distribution of Dispatch Events. Pie chart detailing the share of pickups, drop-offs, refuels, "
                "breaks, and maintenance activities logged during dispatcher operations."
            ),
        )
    )

    delivery_rows: list[dict] = []
    delay_samples: list[float] = []
    for trip in filtered_trips:
        if trip.status != TripStatus.COMPLETED:
            continue
        delay_hours = _travel_time_delay_hours(trip)
        row = _trip_row(
            trip,
            jobs,
            dispatcher_names,
            extra={
                "completed_at": trip.completed_at.isoformat() if trip.completed_at else "—",
                "delay_hours": delay_hours,
            },
        )
        delivery_rows.append(row)
        if delay_hours is not None:
            delay_samples.append(float(delay_hours))
    delivery_rows.sort(key=lambda r: r.get("completed_at", ""), reverse=True)
    travel_delay_chart = _travel_delay_histogram(delay_samples)
    on_time = sum(1 for value in delay_samples if abs(value) <= 1.0)
    sched_desc_delivery = (
        _empty("No completed trips with travel-time delay samples for the selected filters.")
        if not travel_delay_chart
        else _block(
            kpis=[
                {"label": "Completed trips", "value": len(delivery_rows)},
                {"label": "Delay samples", "value": len(delay_samples)},
                {
                    "label": "On-time (±1 hr)",
                    "value": on_time,
                },
            ],
            chart=travel_delay_chart,
            drilldown=delivery_rows[:50],
            statistics=compute_statistics(delay_samples, min_samples=1) if delay_samples else None,
            note=(
                "Distribution of Travel Time Delays (Actual − Scheduled). Histogram of trip-level delay "
                "in hours with a smoothed density curve — negative values are early arrivals, positive are late."
            ),
        )
    )

    ops = _safe_operations_center(db, viewer)
    pending_assign = int(ops.get("summary", {}).get("waiting_for_assignment") or 0)
    available_trucks = int(ops.get("summary", {}).get("available_trucks") or 0)
    timeline = _safe_timeline(db, (f.date_from or today).isoformat())
    conflicts = list(timeline.get("conflicts") or [])
    conflicts.extend(_detect_filtered_schedule_conflicts(filtered_trips))
    deduped_conflicts: list[dict] = []
    seen_conflict_keys: set[tuple] = set()
    for conflict in conflicts:
        key = (conflict.get("trip_id"), tuple(conflict.get("reasons") or []))
        if key in seen_conflict_keys:
            continue
        seen_conflict_keys.add(key)
        deduped_conflicts.append(conflict)
    conflicts = deduped_conflicts
    if viewer and not has_dispatcher_booking_scope(viewer):
        scoped_bids = {b.id for b in ctx["bookings"]}
        conflicts = [c for c in conflicts if c.get("booking_id") in scoped_bids]

    conflict_drilldown = [
        {
            "booking_id": c.get("booking_id"),
            "trip_id": c.get("trip_id"),
            "route": c.get("label"),
            "date": today.isoformat(),
            "status": ", ".join(c.get("reasons") or []),
            "dispatcher": _dispatcher_for(c.get("booking_id"), jobs, dispatcher_names)
            if c.get("booking_id")
            else "—",
        }
        for c in conflicts
    ]
    sched_pred_optimal = _block(
        kpis=[
            {"label": "Pending assignment", "value": pending_assign},
            {"label": "Available trucks", "value": available_trucks},
            {"label": "Schedule conflicts (week)", "value": len(conflicts)},
        ],
        chart=_capacity_snapshot_chart(
            pending=pending_assign,
            available=available_trucks,
            conflicts=len(conflicts),
        ),
        drilldown=conflict_drilldown[:50],
        note="Capacity gap and detected timeline overlaps for the current week.",
    )

    workload_chart, workload_forecast = _workload_forecast_chart(schedule_rows, f)
    sched_pred_workload = (
        _empty_predict()
        if not workload_chart
        else _block(
            kpis=[
                {
                    "label": "Next period trips (est.)",
                    "value": workload_forecast[0]["value"] if workload_forecast else "—",
                }
            ],
            chart=workload_chart,
            drilldown=schedule_rows[:30],
            statistics=compute_statistics(
                [float(row["actual_trips"]) for row in workload_chart if row.get("actual_trips") is not None],
                min_samples=1,
            )
            if any(row.get("actual_trips") is not None for row in workload_chart)
            else None,
            note=_period_note("Trip volume forecast", f.granularity),
        )
    )

    # ------------------------------------------------------------------ #
    # 2. ROUTE COORDINATION
    # ------------------------------------------------------------------ #
    route_summary = routes.get("summary") or {}
    route_perf = routes.get("performance") or []
    route_drill = routes.get("drilldown") or route_perf
    route_util_chart = [
        {"route": row.get("route"), "deliveries": int(row.get("deliveries") or 0)}
        for row in sorted(route_perf, key=lambda item: -int(item.get("deliveries") or 0))[:12]
    ]
    route_desc_history = (
        _empty(routes.get("message", "No data available for the selected filters."))
        if routes.get("empty")
        else _block(
            kpis=[
                {"label": "Routes tracked", "value": route_summary.get("route_count", len(route_perf))},
                {"label": "Most used", "value": route_summary.get("most_used_route", "—")},
            ],
            chart=route_util_chart,
            drilldown=route_drill[:50] if isinstance(route_drill, list) else [],
            statistics=routes.get("statistics"),
            note="Route utilization ranked by completed deliveries — not individual trip rows.",
        )
    )

    travel_rows: list[dict] = []
    travel_hours: list[float] = []
    travel_by_period: dict[str, list[float]] = defaultdict(list)
    for trip in filtered_trips:
        if trip.status != TripStatus.COMPLETED:
            continue
        hours = _delivery_hours(trip)
        if hours is None:
            continue
        travel_hours.append(hours)
        booking = trip.booking
        travel_rows.append(
            _trip_row(
                trip,
                jobs,
                dispatcher_names,
                extra={"travel_hours": round(hours, 2)},
            )
        )
        ref = trip.completed_at or trip.assigned_at
        if ref is not None:
            ref_date = ref.date() if isinstance(ref, datetime) else ref
            bucket = period_key(ref_date, f.granularity)
            if bucket:
                travel_by_period[bucket].append(hours)
    travel_chart = series_from_buckets(
        {key: sum(values) / len(values) for key, values in travel_by_period.items()},
        f.granularity,
        value_key="avg_hours",
    )
    route_desc_travel = (
        _empty("No data available for the selected filters.")
        if not travel_rows
        else _block(
            kpis=[
                {"label": "Records", "value": len(travel_rows)},
                {"label": "Avg travel (hrs)", "value": round(sum(travel_hours) / len(travel_hours), 2)},
            ],
            chart=travel_chart,
            drilldown=travel_rows[:50],
            statistics=compute_statistics(travel_hours, min_samples=1),
            note=_period_note("Average delivery travel time (hours)", f.granularity),
        )
    )

    perf_log_rows = []
    for r in route_perf:
        perf_log_rows.append(
            {
                "route": r.get("route"),
                "deliveries": r.get("deliveries"),
                "delayed_count": r.get("delayed_count"),
                "avg_delivery_hours": r.get("avg_delivery_hours"),
                "status": "delayed" if int(r.get("delayed_count") or 0) > 0 else "on_track",
            }
        )
    route_desc_performance = (
        _empty("No data available for the selected filters.")
        if not perf_log_rows
        else _block(
            kpis=[
                {"label": "Fastest route", "value": route_summary.get("fastest_route", "—")},
                {"label": "Most delayed", "value": route_summary.get("most_delayed_route", "—")},
            ],
            chart=[
                {
                    "route": row["route"],
                    "on_time": max(
                        0,
                        int(row.get("deliveries") or 0) - int(row.get("delayed_count") or 0),
                    ),
                    "delayed": int(row.get("delayed_count") or 0),
                }
                for row in perf_log_rows[:12]
            ],
            drilldown=perf_log_rows,
            note="On-time vs delayed deliveries per route — aggregated route performance.",
        )
    )

    route_eff = sorted(
        [r for r in route_perf if r.get("avg_delivery_hours")],
        key=lambda x: float(x.get("avg_delivery_hours") or 999),
    )
    route_pred_optimal = (
        _empty_predict()
        if not route_eff
        else _block(
            kpis=[{"label": "Recommended route (fastest avg)", "value": route_eff[0].get("route", "—")}],
            chart=[
                {"route": row.get("route"), "avg_delivery_hours": row.get("avg_delivery_hours")}
                for row in route_eff[:12]
            ],
            drilldown=route_eff,
            note="Based on historical average delivery hours per route.",
        )
    )

    delay_by_route: dict[str, int] = defaultdict(int)
    for trip_id, reason in ctx["delay_logs"].items():
        if trip_id not in filtered_ids:
            continue
        trip = next((t for t in ctx["trips"] if t.id == trip_id), None)
        if trip and trip.booking:
            delay_by_route[_route_key(trip.booking.pickup_location, trip.booking.dropoff_location)] += 1
    delay_chart = [{"route": k, "delay_events": v} for k, v in sorted(delay_by_route.items(), key=lambda x: -x[1])[:12]]
    delay_drill = []
    for trip_id, reason in ctx["delay_logs"].items():
        if trip_id not in filtered_ids:
            continue
        trip = next((t for t in ctx["trips"] if t.id == trip_id), None)
        if not trip:
            continue
        booking = trip.booking
        delay_drill.append(
            _trip_row(trip, jobs, dispatcher_names, extra={"cause": reason, "status": "delayed"})
        )
    delay_cause_chart = _cause_count_chart(delay_drill)
    route_pred_traffic = (
        _empty_predict()
        if not delay_drill
        else _block(
            kpis=[{"label": "Delayed trips logged", "value": len(delay_drill)}],
            chart=delay_chart,
            drilldown=delay_drill[:50],
            note="From operational delay logs and ETA breach signals.",
        )
    )

    # ------------------------------------------------------------------ #
    # 3. TRUCK ASSIGNMENT
    # ------------------------------------------------------------------ #
    busy_trucks, busy_drivers, _ = _safe_busy_resource_ids(db)
    truck_avail_rows = []
    for truck in ctx["trucks"]:
        is_busy = truck.id in busy_trucks
        trips_count = sum(1 for t in filtered_trips if t.truck_id == truck.id)
        truck_avail_rows.append(
            {
                "truck": truck.code,
                "status": truck.status or truck.availability_status or "—",
                "availability": "busy" if is_busy else "available",
                "trip_count": trips_count,
                "date": today.isoformat(),
            }
        )
    fleet_avail_chart = _fleet_availability_chart(truck_avail_rows)
    truck_desc_availability = (
        _empty("No data available for the selected filters.")
        if not truck_avail_rows
        else _block(
            kpis=[
                {"label": "Fleet size", "value": len(truck_avail_rows)},
                {"label": "Available now", "value": sum(1 for r in truck_avail_rows if r["availability"] == "available")},
            ],
            chart=fleet_avail_chart,
            drilldown=truck_avail_rows,
            statistics=compute_statistics([row["trip_count"] for row in truck_avail_rows], min_samples=1),
            note="Current fleet availability snapshot — available vs busy trucks.",
        )
    )

    fleet_summary = fleet.get("summary") or {}
    fleet_usage_chart = [
        {
            "truck_code": str(row.get("truck_code") or row.get("truck") or "—"),
            "trip_count": int(row.get("trip_count") or 0),
        }
        for row in (fleet.get("truck_usage") or [])
    ]
    truck_desc_utilization = (
        _empty(fleet.get("message", "No data available for the selected filters."))
        if fleet.get("empty")
        else _block(
            kpis=[
                {"label": "Utilization %", "value": fleet_summary.get("fleet_utilization_rate_pct", "—")},
                {"label": "Most used", "value": fleet_summary.get("most_used_truck", "—")},
            ],
            chart=fleet_usage_chart,
            drilldown=fleet.get("drilldown") or [],
            statistics=fleet.get("statistics"),
            note="Trip assignments per truck — ranked fleet utilization for the filtered period.",
        )
    )

    alloc_rows: list[dict] = []
    pending_bookings = [
        b
        for b in ctx["bookings"]
        if _status_str(b.status) in {BookingStatus.READY_FOR_ASSIGNMENT.value, BookingStatus.APPROVED.value}
    ]
    for booking in pending_bookings[:5]:
        rec = _safe_recommend_assignment(db, booking.id)
        if rec is None:
            continue
        best = rec.best
        if best:
            alloc_rows.append(
                {
                    "booking_id": booking.id,
                    "trip_id": "—",
                    "truck": best.truck_code,
                    "driver": best.driver_name,
                    "route": _route_key(booking.pickup_location, booking.dropoff_location),
                    "date": booking.scheduled_date.isoformat() if booking.scheduled_date else "—",
                    "status": f"score {best.score}",
                    "dispatcher": _dispatcher_for(booking.id, jobs, dispatcher_names),
                }
            )
    truck_pred_allocation = (
        _empty_predict()
        if not alloc_rows and pending_assign == 0
        else _block(
            kpis=[
                {"label": "Pending bookings", "value": len(pending_bookings)},
                {"label": "Recommendations", "value": len(alloc_rows)},
            ],
            chart=_shortage_snapshot_chart(
                pending=len(pending_bookings),
                available=sum(1 for row in truck_avail_rows if row["availability"] == "available"),
            ),
            drilldown=alloc_rows or [
                {
                    "booking_id": "—",
                    "status": "no_pending",
                    "dispatcher": "—",
                }
            ],
            note="Prescriptive assignment scores for pending bookings (top 5).",
        )
    )

    truck_month: dict[str, int] = defaultdict(int)
    for trip in filtered_trips:
        if trip.truck_id and trip.completed_at:
            p = period_key(trip.completed_at, f.granularity)
            if p:
                truck_month[p] += 1
    truck_demand_series = _monthly_series([(m, float(c)) for m, c in sorted(truck_month.items())], min_points=2)
    truck_demand_forecast = (
        _forecast_series(truck_demand_series, 3, granularity=f.granularity) if truck_demand_series is not None else None
    )
    truck_pred_demand = (
        _empty_predict()
        if not truck_demand_forecast
        else _block(
            kpis=[{"label": "Next period trips (est.)", "value": truck_demand_forecast[0]["value"]}],
            chart=_combine_forecast_chart(
                [(m, float(c)) for m, c in sorted(truck_month.items())],
                truck_demand_forecast,
                actual_key="actual_trips",
                forecast_key="forecast_trips",
            ),
            drilldown=[],
            note="Fleet trip demand from completed trip counts by month.",
        )
    )

    # ------------------------------------------------------------------ #
    # 4. DRIVER COORDINATION
    # ------------------------------------------------------------------ #
    driver_schedule_rows: list[dict] = []
    for trip in filtered_trips:
        if not trip.driver_id:
            continue
        booking = trip.booking
        if not booking or not booking.scheduled_date:
            continue
        driver_schedule_rows.append(_trip_row(trip, jobs, dispatcher_names))
    driver_schedule_rows.sort(key=lambda r: r["date"])

    driver_schedule_chart = _period_count_chart(driver_schedule_rows, "date", f.granularity)
    driver_desc_schedules = (
        _empty("No data available for the selected filters.")
        if not driver_schedule_rows
        else _block(
            kpis=[{"label": "Driver schedule entries", "value": len(driver_schedule_rows)}],
            chart=driver_schedule_chart,
            drilldown=driver_schedule_rows[:50],
            statistics=compute_statistics([row["count"] for row in driver_schedule_chart], min_samples=1)
            if driver_schedule_chart
            else None,
            note=_period_note("Driver schedule assignments", f.granularity),
        )
    )

    assignment_hist = driver_schedule_rows.copy()
    driver_desc_assignments = (
        _empty("No data available for the selected filters.")
        if not assignment_hist
        else _block(
            kpis=[{"label": "Assignments", "value": len(assignment_hist)}],
            chart=drivers.get("distribution") or [],
            drilldown=assignment_hist[:50],
            note="Completed vs delayed deliveries per driver — workload distribution.",
        )
    )

    completion_rows = delivery_rows.copy()
    completion_metric_rows: list[dict] = []
    for trip in filtered_trips:
        if trip.status != TripStatus.COMPLETED or not trip.completed_at:
            continue
        hours = _delivery_hours(trip)
        if hours is None:
            continue
        completion_metric_rows.append(
            {
                "completed_at": trip.completed_at.isoformat(),
                "completion_hours": round(hours, 2),
            }
        )
    completion_time_chart = _period_avg_chart(
        completion_metric_rows,
        "completed_at",
        "completion_hours",
        f.granularity,
    )
    driver_desc_completion = (
        _empty("No data available for the selected filters.")
        if not completion_rows
        else _block(
            kpis=[{"label": "Completed trips", "value": len(completion_rows)}],
            chart=completion_time_chart,
            drilldown=completion_rows[:50],
            statistics=compute_statistics(
                [row["completion_hours"] for row in completion_metric_rows],
                min_samples=1,
            )
            if completion_metric_rows
            else None,
            note=_period_note("Average trip completion time (hours)", f.granularity),
        )
    )

    driver_trip_counts: dict[int, int] = defaultdict(int)
    for trip in filtered_trips:
        if trip.driver_id and trip.status in ACTIVE_TRIP | {TripStatus.COMPLETED}:
            driver_trip_counts[trip.driver_id] += 1
    workload_chart = sorted(
        [
            {
                "driver": next((d.full_name for d in ctx["drivers"] if d.id == did), f"Driver #{did}"),
                "active_trips": cnt,
            }
            for did, cnt in driver_trip_counts.items()
        ],
        key=lambda x: -x["active_trips"],
    )[:12]
    driver_pred_workload = (
        _empty_predict()
        if not workload_chart
        else _block(
            kpis=[{"label": "Drivers with load", "value": len(workload_chart)}],
            chart=workload_chart,
            drilldown=driver_schedule_rows[:50],
            note="Current trip load per driver from active and recent assignments.",
        )
    )

    driver_month: dict[str, set[int]] = defaultdict(set)
    for trip in filtered_trips:
        if trip.driver_id and trip.completed_at:
            p = period_key(trip.completed_at, f.granularity)
            if p:
                driver_month[p].add(trip.driver_id)
    staffing_series = _monthly_series([(m, float(len(d))) for m, d in sorted(driver_month.items())], min_points=2)
    staffing_forecast = (
        _forecast_series(staffing_series, 3, granularity=f.granularity) if staffing_series is not None else None
    )
    driver_pred_staffing = (
        _empty_predict()
        if not staffing_forecast
        else _block(
            kpis=[{"label": "Drivers needed (est.)", "value": staffing_forecast[0]["value"]}],
            chart=_combine_forecast_chart(
                [(m, float(len(d))) for m, d in sorted(driver_month.items())],
                staffing_forecast,
                actual_key="actual_drivers",
                forecast_key="forecast_drivers",
            ),
            drilldown=[],
            note="Unique drivers per month trend extrapolation.",
        )
    )

    # ------------------------------------------------------------------ #
    # 5. ORDER MONITORING
    # ------------------------------------------------------------------ #
    order_rows = []
    for booking in ctx["bookings"]:
        trip_list = ctx["trips_by_booking"].get(booking.id, [])
        trip = trip_list[0] if trip_list else None
        order_rows.append(
            {
                "booking_id": booking.id,
                "trip_id": trip.id if trip else "—",
                "driver": trip.driver.full_name if trip and trip.driver else "—",
                "truck": trip.truck.code if trip and trip.truck else "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location),
                "date": booking.scheduled_date.isoformat() if booking.scheduled_date else "—",
                "status": _status_str(booking.status),
                "dispatcher": _dispatcher_for(booking.id, jobs, dispatcher_names),
            }
        )
    order_intake_chart = _period_count_chart(order_rows, "date", f.granularity)
    order_desc_details = (
        _empty("No data available for the selected filters.")
        if not order_rows
        else _block(
            kpis=[{"label": "Orders", "value": len(order_rows)}],
            chart=order_intake_chart,
            drilldown=order_rows[:50],
            statistics=compute_statistics([row["count"] for row in order_intake_chart], min_samples=1)
            if order_intake_chart
            else None,
            note=_period_note("Order intake by scheduled date", f.granularity),
        )
    )

    ship_summary = shipments.get("summary") or {}
    order_desc_shipment = (
        _empty(shipments.get("message", "No data available for the selected filters."))
        if shipments.get("empty")
        else _block(
            kpis=[
                {"label": "Total shipments", "value": ship_summary.get("total_shipments", "—")},
                {"label": "Delivered", "value": ship_summary.get("delivered", "—")},
                {"label": "Delayed", "value": ship_summary.get("delayed", "—")},
            ],
            chart=shipments.get("status_distribution") or [],
            drilldown=shipments.get("drilldown") or [],
            statistics=shipments.get("statistics"),
            note="Shipment status distribution — part-to-whole view of delivery outcomes.",
        )
    )

    progress_period_rows: list[dict] = []
    for trip in filtered_trips:
        if _status_str(trip.status) not in {s.value for s in ACTIVE_TRIP}:
            continue
        ref = trip.assigned_at or (trip.booking.scheduled_date if trip.booking else None)
        if ref is None:
            continue
        ref_date = ref.date() if isinstance(ref, datetime) else ref
        progress_period_rows.append({"date": ref_date.isoformat()})
    progress_volume_chart = _period_count_chart(progress_period_rows, "date", f.granularity)
    progress_rows = [
        _trip_row(t, jobs, dispatcher_names)
        for t in filtered_trips
        if _status_str(t.status) in {s.value for s in ACTIVE_TRIP}
    ]
    order_desc_progress = (
        _empty("No data available for the selected filters.")
        if not progress_rows
        else _block(
            kpis=[{"label": "Active shipments", "value": len(progress_rows)}],
            chart=progress_volume_chart,
            drilldown=progress_rows,
            statistics=compute_statistics([row["count"] for row in progress_volume_chart], min_samples=1)
            if progress_volume_chart
            else None,
            note=_period_note("In-transit shipment volume", f.granularity),
        )
    )

    total_ship = int(ship_summary.get("total_shipments") or 0) if not shipments.get("empty") else 0
    delayed = int(ship_summary.get("delayed") or 0) if not shipments.get("empty") else 0
    order_pred_delay = (
        _empty_predict()
        if not delay_drill and total_ship == 0
        else _block(
            kpis=[
                {"label": "At-risk / delayed", "value": len(delay_drill)},
                {
                    "label": "Historical delay rate %",
                    "value": round((delayed / total_ship) * 100, 1) if total_ship else "Insufficient data",
                },
            ],
            chart=delay_cause_chart,
            drilldown=delay_drill[:50],
            note="Delay causes from operational logs — distinct from route-level delay counts.",
        )
    )

    monthly_del = shipments.get("monthly_deliveries") or []
    del_actuals = [(str(m.get("period") or m["month"]), float(m["count"])) for m in monthly_del]
    del_series = _monthly_series(del_actuals, min_points=2)
    completion_forecast = (
        _forecast_series(del_series, 3, granularity=f.granularity) if del_series is not None else None
    )
    order_pred_completion = (
        _empty_predict()
        if not completion_forecast
        else _block(
            kpis=[{"label": "Next period deliveries (est.)", "value": completion_forecast[0]["value"]}],
            chart=_combine_forecast_chart(
                del_actuals,
                completion_forecast,
                actual_key="actual_deliveries",
                forecast_key="forecast_deliveries",
            ),
            drilldown=delivery_rows[:30],
        )
    )

    # ------------------------------------------------------------------ #
    # 6. OPERATIONAL SUPPORT
    # ------------------------------------------------------------------ #
    dispatch_record_rows = dispatch_log_rows.copy()
    for booking in pending_bookings[:20]:
        dispatch_record_rows.append(
            {
                "booking_id": booking.id,
                "trip_id": "—",
                "route": _route_key(booking.pickup_location, booking.dropoff_location),
                "date": booking.scheduled_date.isoformat() if booking.scheduled_date else "—",
                "status": "awaiting_assignment",
                "dispatcher": _dispatcher_for(booking.id, jobs, dispatcher_names),
            }
        )
    dispatch_record_chart = _period_count_chart(dispatch_record_rows, "date", f.granularity)
    ops_desc_dispatch = (
        _empty("No data available for the selected filters.")
        if not dispatch_record_rows
        else _block(
            kpis=[{"label": "Dispatch records", "value": len(dispatch_record_rows)}],
            chart=dispatch_record_chart,
            drilldown=dispatch_record_rows[:50],
            statistics=compute_statistics([row["count"] for row in dispatch_record_chart], min_samples=1)
            if dispatch_record_chart
            else None,
            note=_period_note("Dispatch record volume (logs + pending queue)", f.granularity),
        )
    )

    trip_summary_chart = _trip_period_status_chart(filtered_trips, f.granularity)
    ops_desc_trips = (
        _empty("No data available for the selected filters.")
        if not filtered_trips
        else _block(
            kpis=[{"label": "Trips in scope", "value": len(filtered_trips)}],
            chart=trip_summary_chart,
            drilldown=[_trip_row(t, jobs, dispatcher_names) for t in filtered_trips[:50]],
            note=_period_note("Completed vs active trip volume", f.granularity),
        )
    )

    perf_summary = drivers.get("summary") or {}
    op_log_rows: list[dict] = []
    for rep in _query_if_table(
        db,
        "general_operational_reports",
        lambda: db.query(GeneralOperationalReport).order_by(GeneralOperationalReport.created_at.desc()).limit(30).all(),
    ):
        op_log_rows.append(
            {
                "trip_id": rep.trip_id,
                "booking_id": rep.booking_id,
                "date": _activity_date(rep.created_at).isoformat() if rep.created_at else "—",
                "status": rep.status or rep.category,
                "route": "—",
            }
        )
    driver_ranking_chart = [
        {
            "driver_name": str(row.get("driver_name") or row.get("driver") or "—"),
            "completed": int(row.get("deliveries_completed") or row.get("completed") or 0),
        }
        for row in (drivers.get("ranking") or [])
    ]
    ops_desc_performance = (
        _empty("No data available for the selected filters.")
        if not op_log_rows and drivers.get("empty")
        else _block(
            kpis=[
                {"label": "Completed deliveries", "value": perf_summary.get("total_completed", "—")},
                {"label": "Operational reports", "value": len(op_log_rows)},
            ],
            chart=driver_ranking_chart,
            drilldown=op_log_rows[:50],
            note="Driver completion ranking — aggregated deliveries per driver.",
        )
    )

    ops_pred_conflict = _block(
        kpis=[
            {"label": "Schedule conflicts", "value": len(conflicts)},
            {"label": "Pending assignment", "value": pending_assign},
            {"label": "Available trucks", "value": available_trucks},
        ],
        chart=_schedule_conflict_prediction_chart(
            conflicts,
            pending=pending_assign,
            available=available_trucks,
        ),
        drilldown=conflict_drilldown[:50] if conflict_drilldown else schedule_rows[:30],
        statistics=compute_statistics([float(row["count"]) for row in _conflict_cause_chart(conflicts)], min_samples=1)
        if conflicts
        else None,
        note=(
            "Schedule conflict causes from overlapping truck/driver slots. "
            "When no overlaps are detected, the chart shows capacity pressure and assignment risk."
        ),
    )

    available_truck_count = sum(1 for row in truck_avail_rows if row["availability"] == "available")
    shortage = max(0, len(pending_bookings) - available_truck_count)
    ops_pred_shortage = _block(
        kpis=[
            {"label": "Pending bookings", "value": len(pending_bookings)},
            {"label": "Available trucks", "value": available_truck_count},
            {"label": "Predicted shortage", "value": shortage},
        ],
        chart=_shortage_snapshot_chart(pending=len(pending_bookings), available=available_truck_count),
        drilldown=alloc_rows[:20] if alloc_rows else truck_avail_rows[:20],
        note="Compares pending assignment queue against currently available trucks.",
    )

    issue_period: dict[str, int] = defaultdict(int)
    issue_sources: list[dict] = []
    for issue in _query_if_table(
        db,
        "trip_issues",
        lambda: db.query(TripIssue).order_by(TripIssue.created_at.desc()).limit(50).all(),
    ):
        if issue.trip_id not in filtered_ids:
            continue
        trip = next((t for t in ctx["trips"] if t.id == issue.trip_id), None)
        ref = _activity_date(issue.created_at)
        if ref:
            p = period_key(ref, f.granularity)
            if p:
                issue_period[p] += 1
        if trip:
            issue_sources.append(_trip_row(trip, jobs, dispatcher_names, extra={"cause": issue.issue_type}))
    for vir in _query_if_table(
        db,
        "vehicle_issue_reports",
        lambda: db.query(VehicleIssueReport).order_by(VehicleIssueReport.created_at.desc()).limit(50).all(),
    ):
        if vir.trip_id not in filtered_ids:
            continue
        ref = _activity_date(vir.created_at)
        if ref:
            p = period_key(ref, f.granularity)
            if p:
                issue_period[p] += 1
        trip = next((t for t in ctx["trips"] if t.id == vir.trip_id), None)
        if trip:
            issue_sources.append(_trip_row(trip, jobs, dispatcher_names, extra={"cause": vir.issue_type}))
    issue_series = _monthly_series([(m, float(c)) for m, c in sorted(issue_period.items())], min_points=2)
    issue_forecast = (
        _forecast_series(issue_series, 3, granularity=f.granularity) if issue_series is not None else None
    )
    issue_actual_chart = [{"period": key, "count": value} for key, value in sorted(issue_period.items())[-24:]]
    issue_chart = (
        _combine_forecast_chart(
            [(key, float(value)) for key, value in sorted(issue_period.items())],
            issue_forecast,
            actual_key="actual_issues",
            forecast_key="forecast_issues",
        )
        if issue_forecast
        else issue_actual_chart
    )
    ops_pred_issues = (
        _empty_predict()
        if not issue_sources and not issue_actual_chart
        else _block(
            kpis=[
                {"label": "Open issue signals", "value": len(issue_sources)},
                {
                    "label": "Next period issues (est.)",
                    "value": issue_forecast[0]["value"] if issue_forecast else "Insufficient data",
                },
            ],
            chart=issue_chart,
            drilldown=issue_sources[:50],
            note="Trip issues and vehicle issue reports with monthly trend when sufficient history exists.",
        )
    )

    return {
        "trip_scheduling": {
            "descriptive": {
                "trip_schedules": sched_desc_trips,
                "dispatch_logs": sched_desc_dispatch,
                "delivery_records": sched_desc_delivery,
            },
            "predictive": {
                "optimal_scheduling": sched_pred_optimal,
                "workload_forecasting": sched_pred_workload,
            },
        },
        "route_coordination": {
            "descriptive": {
                "route_history": route_desc_history,
                "travel_time_records": route_desc_travel,
                "delivery_performance_logs": route_desc_performance,
            },
            "predictive": {
                "optimal_route_prediction": route_pred_optimal,
                "traffic_delay_prediction": route_pred_traffic,
            },
        },
        "truck_assignment": {
            "descriptive": {
                "truck_availability": truck_desc_availability,
                "vehicle_utilization": truck_desc_utilization,
            },
            "predictive": {
                "vehicle_allocation": truck_pred_allocation,
                "truck_demand_forecasting": truck_pred_demand,
            },
        },
        "driver_coordination": {
            "descriptive": {
                "driver_schedules": driver_desc_schedules,
                "assignment_history": driver_desc_assignments,
                "trip_completion_logs": driver_desc_completion,
            },
            "predictive": {
                "driver_workload_prediction": driver_pred_workload,
                "staffing_demand_forecasting": driver_pred_staffing,
            },
        },
        "order_monitoring": {
            "descriptive": {
                "order_details": order_desc_details,
                "shipment_status_logs": order_desc_shipment,
                "delivery_progress": order_desc_progress,
            },
            "predictive": {
                "delivery_delay_prediction": order_pred_delay,
                "order_completion_forecasting": order_pred_completion,
            },
        },
        "operational_support": {
            "descriptive": {
                "dispatch_records": ops_desc_dispatch,
                "trip_summaries": ops_desc_trips,
                "operational_performance_logs": ops_desc_performance,
            },
            "predictive": {
                "schedule_conflict_prediction": ops_pred_conflict,
                "truck_shortage_prediction": ops_pred_shortage,
                "operational_issue_forecasting": ops_pred_issues,
            },
        },
    }
