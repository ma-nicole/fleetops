"""Driver role analytics — five pillars scoped to the authenticated driver (real DB only)."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
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
    _trip_fuel,
)
from app.services.analytics_stats import compute_statistics
from app.services.manager_role_analytics import (
    _block,
    _empty,
    _empty_predict,
    _forecast_series,
    _is_breakdown_issue,
    _monthly_series,
)
from app.services.predictive.fuel_model import predict_fuel_consumption
from app.services.predictive.maintenance_model import predict_maintenance
from app.schemas.predict import FuelPredictRequest, MaintenancePredictRequest

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
            chart=log_rows[:12],
            drilldown=log_rows[:50],
        )
    )

    completed_rows = [_trip_row(t, ctx, fuel_liters_by_trip=fuel_liters_by_trip) for t in completed]
    completed_rows.sort(key=lambda r: r["delivery_date"], reverse=True)
    exec_desc_completed = (
        _empty("No data available yet.")
        if not completed_rows
        else _block(
            kpis=[{"label": "Completed deliveries", "value": len(completed_rows)}],
            chart=[],
            drilldown=completed_rows[:50],
        )
    )

    travel_rows = [
        _trip_row(t, ctx, fuel_liters_by_trip=fuel_liters_by_trip)
        for t in completed
        if _delivery_hours(t) is not None
    ]
    month_travel: dict[str, list[float]] = defaultdict(list)
    for r in travel_rows:
        if r["delivery_date"] != "—":
            month_travel[r["delivery_date"][:7]].append(float(r["travel_time_hours"]))
    travel_chart = [
        {"month": m, "avg_travel_hours": round(sum(v) / len(v), 2)} for m, v in sorted(month_travel.items())[-12:]
    ]
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
            statistics=compute_statistics(travel_hours, min_samples=1),
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
    if fuel_completed:
        avg_dist = sum(float(t.distance_km or 0) for t in fuel_completed) / len(fuel_completed)
        truck = next((t.truck for t in fuel_completed if t.truck and t.truck.fuel_efficiency_kmpl), None)
        pred_fuel = predict_fuel_consumption(
            FuelPredictRequest(
                distance_km=avg_dist,
                cargo_weight_tons=5.0,
                avg_speed_kmh=45,
                road_condition="highway",
                vehicle_fuel_efficiency_kmpl=float(truck.fuel_efficiency_kmpl) if truck else 4.0,
            )
        )
        exec_pred_fuel = _block(
            kpis=[
                {"label": "Sample distance (km)", "value": round(avg_dist, 1)},
                {"label": "Predicted liters", "value": pred_fuel.fuel_liters},
                {"label": "Predicted fuel cost (₱)", "value": pred_fuel.fuel_cost},
            ],
            chart=[],
            drilldown=completed_rows[:20],
            note="Fuel model using your typical trip distance and assigned truck efficiency.",
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

    nav_desc_history = (
        _empty("No data available yet.")
        if not route_rows
        else _block(
            kpis=[
                {"label": "Unique routes", "value": len(route_rows)},
                {"label": "Most used", "value": route_rows[0]["route"][:48] if route_rows else "—"},
            ],
            chart=route_rows[:12],
            drilldown=route_rows[:50],
        )
    )

    distance_rows = [
        _trip_row(t, ctx, fuel_liters_by_trip=fuel_liters_by_trip, extra={"distance_km": round(float(t.distance_km or 0), 2)})
        for t in trips
        if (t.distance_km or 0) > 0
    ]
    nav_desc_distance = (
        _empty("No data available yet.")
        if not distance_rows
        else _block(
            kpis=[{"label": "Total distance (km)", "value": total_distance}],
            chart=distance_rows[:12],
            drilldown=distance_rows[:50],
            statistics=compute_statistics([float(r["distance_km"]) for r in distance_rows], min_samples=1),
        )
    )

    nav_desc_past_routes = nav_desc_history

    routes_with_hours = [r for r in route_rows if r["avg_travel_hours"] != "—"]
    routes_with_hours.sort(key=lambda r: float(r["avg_travel_hours"]))
    nav_pred_optimal = (
        _empty_predict()
        if not routes_with_hours
        else _block(
            kpis=[{"label": "Fastest personal route", "value": routes_with_hours[0]["route"][:48]}],
            chart=routes_with_hours[:12],
            drilldown=routes_with_hours,
            note="Route with lowest average travel time on your completed trips.",
        )
    )

    if sample_trip and sample_trip.booking:
        rk = _route_key(sample_trip.booking.pickup_location, sample_trip.booking.dropoff_location)
        match = next((r for r in route_rows if r["route"] == rk), None)
        est_hours = match["avg_travel_hours"] if match and match["avg_travel_hours"] != "—" else None
        nav_pred_travel = (
            _empty_predict()
            if est_hours is None
            else _block(
                kpis=[
                    {"label": "Route", "value": rk[:48] + ("…" if len(rk) > 48 else "")},
                    {"label": "Estimated travel (hrs)", "value": est_hours},
                ],
                chart=travel_chart,
                drilldown=[r for r in travel_rows if r["route"] == rk][:20],
                note="Estimated from your historical average on this route.",
            )
        )
    else:
        nav_pred_travel = _empty_predict()

    # ------------------------------------------------------------------ #
    # 3. DELIVERY REPORTING
    # ------------------------------------------------------------------ #
    confirmation_rows = []
    for trip in completed:
        booking = trip.booking
        confirmation_rows.append(
            _trip_row(
                trip,
                ctx,
                fuel_liters_by_trip=fuel_liters_by_trip,
                extra={
                    "pod_confirmed": bool(getattr(trip, "proof_of_delivery", None) or getattr(trip, "pod_notes", None)),
                },
            )
        )
    report_desc_confirm = (
        _empty("No data available yet.")
        if not confirmation_rows
        else _block(
            kpis=[
                {"label": "Delivered", "value": len(confirmation_rows)},
                {"label": "With POD", "value": sum(1 for r in confirmation_rows if r.get("pod_confirmed"))},
            ],
            chart=[],
            drilldown=confirmation_rows[:50],
        )
    )

    shipment_rows = log_rows.copy()
    report_desc_shipments = exec_desc_logs

    completion_hours = travel_hours.copy()
    month_completion: dict[str, list[float]] = defaultdict(list)
    for t in completed:
        h = _delivery_hours(t)
        ref = _activity_date(t.completed_at)
        if h is not None and ref:
            month_completion[ref.strftime("%Y-%m")].append(h)
    completion_series = _monthly_series(
        [(m, sum(v) / len(v)) for m, v in sorted(month_completion.items())],
        min_points=2,
    )
    completion_forecast = _forecast_series(completion_series, 3) if completion_series is not None else None
    report_pred_completion = (
        _empty_predict()
        if not completion_forecast
        else _block(
            kpis=[
                {
                    "label": "Avg completion time (hrs)",
                    "value": round(sum(completion_hours) / len(completion_hours), 2) if completion_hours else "—",
                },
                {"label": "Next period est. (hrs)", "value": completion_forecast[0]["value"]},
            ],
            chart=[{"period": p["period"], "forecast_hours": p["value"]} for p in completion_forecast],
            drilldown=completed_rows[:30],
            note="Monthly average completion duration trend from your completed trips.",
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
    vehicle_desc_usage = (
        _empty("No data available yet.")
        if not usage_rows
        else _block(
            kpis=[{"label": "Vehicles used", "value": len(usage_rows)}],
            chart=usage_rows[:12],
            drilldown=usage_rows,
        )
    )

    maint_rows = []
    for rec in ctx["maintenance"]:
        if rec.truck_id not in truck_ids:
            continue
        truck_code = next((t.truck.code for t in trips if t.truck_id == rec.truck_id and t.truck), f"Truck #{rec.truck_id}")
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
    vehicle_desc_maint = (
        _empty("No data available yet.")
        if not maint_rows
        else _block(
            kpis=[{"label": "Maintenance records", "value": len(maint_rows)}],
            chart=maint_rows[:10],
            drilldown=maint_rows[:50],
        )
    )

    primary_truck = next((t.truck for t in sorted(trips, key=lambda x: x.assigned_at or datetime.min, reverse=True) if t.truck), None)
    maint_for_truck = [r for r in ctx["maintenance"] if primary_truck and r.truck_id == primary_truck.id]
    if primary_truck:
        recurring = len(maint_for_truck) >= 2
        base_cost = (
            sum(float(r.estimated_cost or r.actual_cost or 0) for r in maint_for_truck) / len(maint_for_truck)
            if maint_for_truck
            else 5000.0
        )
        maint_pred = predict_maintenance(
            MaintenancePredictRequest(
                vehicle_id=primary_truck.id,
                mileage_km=float(primary_truck.odometer_km or 0),
                age_years=float(primary_truck.age_years or 1),
                has_recurring_issue=recurring,
                base_maintenance_cost=float(base_cost),
            )
        )
        vehicle_pred_maint = _block(
            kpis=[
                {"label": "Assigned truck", "value": primary_truck.code},
                {"label": "Risk score", "value": maint_pred.risk_score},
                {"label": "Priority", "value": maint_pred.priority_level},
            ],
            chart=[],
            drilldown=maint_rows[:20] if maint_rows else usage_rows[:10],
            note="Maintenance model for your most recently assigned truck.",
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
    vehicle_pred_breakdown = (
        _empty_predict()
        if not breakdown_rows and not primary_truck
        else _block(
            kpis=[
                {"label": "Breakdown reports", "value": len(breakdown_rows)},
                {
                    "label": "Risk level",
                    "value": "elevated" if len(breakdown_rows) >= 2 else "normal" if breakdown_rows else "low",
                },
            ],
            chart=[],
            drilldown=breakdown_rows[:50],
            note="From your submitted trip issues and vehicle issue reports.",
        )
    )

    # ------------------------------------------------------------------ #
    # 5. TRIP STATUS UPDATING
    # ------------------------------------------------------------------ #
    progress_rows: list[dict] = []
    if trip_ids:
        updates = (
            db.query(TripStatusUpdate)
            .filter(TripStatusUpdate.trip_id.in_(trip_ids))
            .order_by(TripStatusUpdate.created_at.desc())
            .limit(100)
            .all()
        )
        trip_by_id = {t.id: t for t in trips}
        for upd in updates:
            trip = trip_by_id.get(upd.trip_id)
            if not trip:
                continue
            ref = _activity_date(upd.created_at)
            progress_rows.append(
                _trip_row(
                    trip,
                    ctx,
                    fuel_liters_by_trip=fuel_liters_by_trip,
                    extra={
                        "status": str(upd.status),
                        "delivery_date": ref.isoformat() if ref else "—",
                    },
                )
            )

    status_desc_progress = (
        _empty("No data available yet.")
        if not progress_rows
        else _block(
            kpis=[{"label": "Status updates", "value": len(progress_rows)}],
            chart=[],
            drilldown=progress_rows[:50],
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
    delay_rows.sort(key=lambda r: r.get("delivery_date", ""), reverse=True)
    month_delays: dict[str, int] = defaultdict(int)
    for r in delay_rows:
        d = r.get("delivery_date")
        if d and d != "—":
            month_delays[str(d)[:7]] += 1
    delay_chart = [{"month": m, "delay_count": c} for m, c in sorted(month_delays.items())[-12:]]

    status_desc_delays = (
        _empty("No data available yet.")
        if not delay_rows
        else _block(
            kpis=[{"label": "Delay incidents", "value": len(delay_rows)}],
            chart=delay_chart,
            drilldown=delay_rows[:50],
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
    status_pred_delay = (
        _empty_predict()
        if delay_rate is None and not at_risk
        else _block(
            kpis=[
                {"label": "Historical delay rate %", "value": delay_rate if delay_rate is not None else "Insufficient data"},
                {"label": "Active at-risk trips", "value": len(at_risk)},
            ],
            chart=delay_chart,
            drilldown=(delay_rows[:30] + at_risk)[:50],
            note="From your delay reports and active trips past estimated delivery time.",
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
