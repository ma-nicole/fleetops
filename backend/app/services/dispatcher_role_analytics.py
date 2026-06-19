"""Dispatcher role analytics — six operational pillars (real DB only)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.models.entities import (
    Booking,
    BookingStatus,
    GeneralOperationalReport,
    JobOrder,
    OperationalLog,
    Trip,
    TripIssue,
    TripStatus,
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
    _empty,
    _empty_predict,
    _forecast_series,
    _monthly_series,
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

    upcoming = [r for r in schedule_rows if r.get("scheduled_date", "") >= today.isoformat()]
    day_counts: dict[str, int] = defaultdict(int)
    week_counts: dict[str, int] = defaultdict(int)
    month_counts: dict[str, int] = defaultdict(int)
    for r in schedule_rows:
        sd = r.get("scheduled_date")
        if not sd or sd == "—":
            continue
        day_counts[sd] += 1
        d = date.fromisoformat(sd)
        week_counts[d.strftime("%Y-W%W")] += 1
        month_counts[sd[:7]] += 1

    sched_desc_trips = (
        _empty("No data available yet.")
        if not schedule_rows
        else _block(
            kpis=[
                {"label": "Scheduled trips", "value": len(schedule_rows)},
                {"label": "Upcoming", "value": len(upcoming)},
                {"label": "Today", "value": day_counts.get(today.isoformat(), 0)},
            ],
            chart=[{"month": m, "count": c} for m, c in sorted(month_counts.items())[-12:]],
            drilldown=schedule_rows[:50],
            statistics=compute_statistics(list(day_counts.values()), min_samples=1) if day_counts else None,
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
                "dispatcher": _dispatcher_for(booking_id, jobs, dispatcher_names) if booking_id else "—",
            }
        )
    sched_desc_dispatch = (
        _empty("No data available yet.")
        if not dispatch_log_rows
        else _block(
            kpis=[{"label": "Dispatch log entries", "value": len(dispatch_log_rows)}],
            chart=[],
            drilldown=dispatch_log_rows[:50],
        )
    )

    delivery_rows = [
        _trip_row(t, jobs, dispatcher_names, extra={"completed_at": t.completed_at.isoformat() if t.completed_at else "—"})
        for t in filtered_trips
        if t.status == TripStatus.COMPLETED
    ]
    delivery_rows.sort(key=lambda r: r.get("completed_at", ""), reverse=True)
    sched_desc_delivery = (
        _empty("No data available yet.")
        if not delivery_rows
        else _block(
            kpis=[{"label": "Completed deliveries", "value": len(delivery_rows)}],
            chart=[{"week": w, "count": c} for w, c in sorted(week_counts.items())[-8:]],
            drilldown=delivery_rows[:50],
        )
    )

    ops = _safe_operations_center(db, viewer)
    pending_assign = int(ops.get("summary", {}).get("waiting_for_assignment") or 0)
    available_trucks = int(ops.get("summary", {}).get("available_trucks") or 0)
    timeline = _safe_timeline(db, today.isoformat())
    conflicts = timeline.get("conflicts") or []
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
        chart=[],
        drilldown=conflict_drilldown[:50],
        note="Capacity gap and detected timeline overlaps for the current week.",
    )

    trip_day_series = _monthly_series([(m, float(c)) for m, c in sorted(month_counts.items())], min_points=2)
    workload_forecast = _forecast_series(trip_day_series, 3) if trip_day_series is not None else None
    sched_pred_workload = (
        _empty_predict()
        if not workload_forecast
        else _block(
            kpis=[{"label": "Next period trips (est.)", "value": workload_forecast[0]["value"]}],
            chart=[{"period": p["period"], "forecast_trips": p["value"]} for p in workload_forecast],
            drilldown=schedule_rows[:30],
            note="Trip volume forecast from scheduled trip counts by month.",
        )
    )

    # ------------------------------------------------------------------ #
    # 2. ROUTE COORDINATION
    # ------------------------------------------------------------------ #
    route_summary = routes.get("summary") or {}
    route_perf = routes.get("performance") or []
    route_drill = routes.get("drilldown") or route_perf
    route_desc_history = (
        _empty(routes.get("message", "No data available yet."))
        if routes.get("empty")
        else _block(
            kpis=[
                {"label": "Routes tracked", "value": route_summary.get("route_count", len(route_perf))},
                {"label": "Most used", "value": route_summary.get("most_used_route", "—")},
            ],
            chart=routes.get("cost_comparison") or route_perf,
            drilldown=route_drill[:50] if isinstance(route_drill, list) else [],
            statistics=routes.get("statistics"),
        )
    )

    travel_rows: list[dict] = []
    travel_hours: list[float] = []
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
    route_desc_travel = (
        _empty("No data available yet.")
        if not travel_rows
        else _block(
            kpis=[
                {"label": "Records", "value": len(travel_rows)},
                {"label": "Avg travel (hrs)", "value": round(sum(travel_hours) / len(travel_hours), 2)},
            ],
            chart=travel_rows[:12],
            drilldown=travel_rows[:50],
            statistics=compute_statistics(travel_hours, min_samples=1),
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
        _empty("No data available yet.")
        if not perf_log_rows
        else _block(
            kpis=[
                {"label": "Fastest route", "value": route_summary.get("fastest_route", "—")},
                {"label": "Most delayed", "value": route_summary.get("most_delayed_route", "—")},
            ],
            chart=perf_log_rows[:12],
            drilldown=perf_log_rows,
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
            chart=route_eff[:12],
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
    truck_desc_availability = (
        _empty("No data available yet.")
        if not truck_avail_rows
        else _block(
            kpis=[
                {"label": "Fleet size", "value": len(truck_avail_rows)},
                {"label": "Available now", "value": sum(1 for r in truck_avail_rows if r["availability"] == "available")},
            ],
            chart=truck_avail_rows[:12],
            drilldown=truck_avail_rows,
        )
    )

    fleet_summary = fleet.get("summary") or {}
    truck_desc_utilization = (
        _empty(fleet.get("message", "No data available yet."))
        if fleet.get("empty")
        else _block(
            kpis=[
                {"label": "Utilization %", "value": fleet_summary.get("fleet_utilization_rate_pct", "—")},
                {"label": "Most used", "value": fleet_summary.get("most_used_truck", "—")},
            ],
            chart=fleet.get("truck_usage") or [],
            drilldown=fleet.get("drilldown") or [],
            statistics=fleet.get("statistics"),
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
            chart=[],
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
            truck_month[trip.completed_at.strftime("%Y-%m")] += 1
    truck_demand_series = _monthly_series([(m, float(c)) for m, c in sorted(truck_month.items())], min_points=2)
    truck_demand_forecast = _forecast_series(truck_demand_series, 3) if truck_demand_series is not None else None
    truck_pred_demand = (
        _empty_predict()
        if not truck_demand_forecast
        else _block(
            kpis=[{"label": "Next period trips (est.)", "value": truck_demand_forecast[0]["value"]}],
            chart=[{"period": p["period"], "forecast_trips": p["value"]} for p in truck_demand_forecast],
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

    driver_desc_schedules = (
        _empty("No data available yet.")
        if not driver_schedule_rows
        else _block(
            kpis=[{"label": "Driver schedule entries", "value": len(driver_schedule_rows)}],
            chart=[],
            drilldown=driver_schedule_rows[:50],
        )
    )

    assignment_hist = driver_schedule_rows.copy()
    driver_desc_assignments = (
        _empty("No data available yet.")
        if not assignment_hist
        else _block(
            kpis=[{"label": "Assignments", "value": len(assignment_hist)}],
            chart=drivers.get("distribution") or [],
            drilldown=assignment_hist[:50],
        )
    )

    completion_rows = delivery_rows.copy()
    driver_desc_completion = (
        _empty("No data available yet.")
        if not completion_rows
        else _block(
            kpis=[{"label": "Completed trips", "value": len(completion_rows)}],
            chart=[],
            drilldown=completion_rows[:50],
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
            driver_month[trip.completed_at.strftime("%Y-%m")].add(trip.driver_id)
    staffing_series = _monthly_series([(m, float(len(d))) for m, d in sorted(driver_month.items())], min_points=2)
    staffing_forecast = _forecast_series(staffing_series, 3) if staffing_series is not None else None
    driver_pred_staffing = (
        _empty_predict()
        if not staffing_forecast
        else _block(
            kpis=[{"label": "Drivers needed (est.)", "value": staffing_forecast[0]["value"]}],
            chart=[{"period": p["period"], "forecast_drivers": p["value"]} for p in staffing_forecast],
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
    order_desc_details = (
        _empty("No data available yet.")
        if not order_rows
        else _block(
            kpis=[{"label": "Orders", "value": len(order_rows)}],
            chart=[],
            drilldown=order_rows[:50],
        )
    )

    ship_summary = shipments.get("summary") or {}
    order_desc_shipment = (
        _empty(shipments.get("message", "No data available yet."))
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
        )
    )

    progress_rows = [
        _trip_row(t, jobs, dispatcher_names)
        for t in filtered_trips
        if _status_str(t.status) in {s.value for s in ACTIVE_TRIP}
    ]
    order_desc_progress = (
        _empty("No data available yet.")
        if not progress_rows
        else _block(
            kpis=[{"label": "Active shipments", "value": len(progress_rows)}],
            chart=[],
            drilldown=progress_rows,
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
            chart=delay_chart,
            drilldown=delay_drill[:50],
        )
    )

    monthly_del = shipments.get("monthly_deliveries") or []
    del_series = _monthly_series([(m["month"], float(m["count"])) for m in monthly_del], min_points=2)
    completion_forecast = _forecast_series(del_series, 3) if del_series is not None else None
    order_pred_completion = (
        _empty_predict()
        if not completion_forecast
        else _block(
            kpis=[{"label": "Next period deliveries (est.)", "value": completion_forecast[0]["value"]}],
            chart=[{"period": p["period"], "forecast_deliveries": p["value"]} for p in completion_forecast],
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
    ops_desc_dispatch = (
        _empty("No data available yet.")
        if not dispatch_record_rows
        else _block(
            kpis=[{"label": "Dispatch records", "value": len(dispatch_record_rows)}],
            chart=[],
            drilldown=dispatch_record_rows[:50],
        )
    )

    status_counts: dict[str, int] = defaultdict(int)
    for trip in filtered_trips:
        status_counts[_status_str(trip.status)] += 1
    trip_summary_chart = [{"status": k, "count": v} for k, v in sorted(status_counts.items())]
    ops_desc_trips = (
        _empty("No data available yet.")
        if not filtered_trips
        else _block(
            kpis=[{"label": "Trips in scope", "value": len(filtered_trips)}],
            chart=trip_summary_chart,
            drilldown=[_trip_row(t, jobs, dispatcher_names) for t in filtered_trips[:50]],
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
    ops_desc_performance = (
        _empty("No data available yet.")
        if not op_log_rows and drivers.get("empty")
        else _block(
            kpis=[
                {"label": "Completed deliveries", "value": perf_summary.get("total_completed", "—")},
                {"label": "Operational reports", "value": len(op_log_rows)},
            ],
            chart=drivers.get("ranking") or [],
            drilldown=op_log_rows[:50],
        )
    )

    ops_pred_conflict = (
        _empty_predict()
        if not conflicts
        else _block(
            kpis=[{"label": "Schedule conflicts", "value": len(conflicts)}],
            chart=[],
            drilldown=conflict_drilldown[:50],
            note="Overlapping truck/driver slots detected on the weekly schedule board.",
        )
    )

    shortage = max(0, len(pending_bookings) - sum(1 for r in truck_avail_rows if r["availability"] == "available"))
    ops_pred_shortage = _block(
        kpis=[
            {"label": "Pending bookings", "value": len(pending_bookings)},
            {"label": "Available trucks", "value": sum(1 for r in truck_avail_rows if r["availability"] == "available")},
            {"label": "Predicted shortage", "value": shortage},
        ],
        chart=[],
        drilldown=alloc_rows[:20] if alloc_rows else truck_avail_rows[:20],
        note="Compares pending assignment queue against currently available trucks.",
    )

    issue_month: dict[str, int] = defaultdict(int)
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
            issue_month[ref.strftime("%Y-%m")] += 1
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
            issue_month[ref.strftime("%Y-%m")] += 1
        trip = next((t for t in ctx["trips"] if t.id == vir.trip_id), None)
        if trip:
            issue_sources.append(_trip_row(trip, jobs, dispatcher_names, extra={"cause": vir.issue_type}))
    issue_series = _monthly_series([(m, float(c)) for m, c in sorted(issue_month.items())], min_points=2)
    issue_forecast = _forecast_series(issue_series, 3) if issue_series is not None else None
    ops_pred_issues = (
        _empty_predict()
        if not issue_sources and not issue_forecast
        else _block(
            kpis=[
                {"label": "Open issue signals", "value": len(issue_sources)},
                {
                    "label": "Next period issues (est.)",
                    "value": issue_forecast[0]["value"] if issue_forecast else "Insufficient data",
                },
            ],
            chart=(issue_forecast and [{"period": p["period"], "forecast_issues": p["value"]} for p in issue_forecast])
            or [],
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
