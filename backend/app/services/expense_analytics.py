"""Expense analytics — aggregates trip, fuel, toll, allowance, and operational costs for charts."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.constants.trip_shoulder_costs import SHOULDER_COST_CATEGORY_LABELS
from app.models.entities import (
    FuelLog,
    MaintenanceRecord,
    TollLog,
    Trip,
    TripShoulderCostEntry,
    TripStatus,
)


def _month_key(dt: datetime | None) -> str | None:
    if not dt:
        return None
    return dt.strftime("%Y-%m")


def _trip_fuel(db_trip: Trip, fuel_by_trip: dict[int, float]) -> float:
    logged = fuel_by_trip.get(db_trip.id, 0.0)
    return float(logged or db_trip.fuel_cost or 0)


def _trip_toll(db_trip: Trip, toll_by_trip: dict[int, float]) -> float:
    logged = toll_by_trip.get(db_trip.id, 0.0)
    return float(logged or db_trip.toll_cost or 0)


def build_expense_analytics(db: Session) -> dict[str, Any]:
    trips = db.query(Trip).filter(Trip.status != TripStatus.CANCELLED).all()
    fuel_logs = db.query(FuelLog).all()
    toll_logs = db.query(TollLog).all()
    shoulder_rows = db.query(TripShoulderCostEntry).all()
    maintenance_rows = db.query(MaintenanceRecord).all()

    fuel_by_trip: dict[int, float] = defaultdict(float)
    for row in fuel_logs:
        fuel_by_trip[row.trip_id] += float(row.cost or 0)

    toll_by_trip: dict[int, float] = defaultdict(float)
    for row in toll_logs:
        toll_by_trip[row.trip_id] += float(row.amount or 0)

    system_fuel = 0.0
    system_toll = 0.0
    labor_total = 0.0
    trip_maintenance_total = 0.0
    trip_driver_allowance_total = 0.0
    trip_helper_allowance_total = 0.0

    monthly: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "fuel": 0.0,
            "toll": 0.0,
            "allowance": 0.0,
            "operational": 0.0,
            "labor": 0.0,
            "total": 0.0,
            "trips": 0.0,
        }
    )

    for trip in trips:
        fuel = _trip_fuel(trip, fuel_by_trip)
        toll = _trip_toll(trip, toll_by_trip)
        labor = float(trip.labor_cost or 0)
        maint = float(trip.maintenance_cost or 0)
        driver_allowance = float(getattr(trip, "driver_allowance_php", 0) or 0)
        helper_allowance = float(getattr(trip, "helper_allowance_php", 0) or 0)
        system_fuel += fuel
        system_toll += toll
        labor_total += labor
        trip_maintenance_total += maint
        trip_driver_allowance_total += driver_allowance
        trip_helper_allowance_total += helper_allowance

        month = _month_key(trip.completed_at or trip.assigned_at)
        if month:
            monthly[month]["fuel"] += fuel
            monthly[month]["toll"] += toll
            monthly[month]["labor"] += labor
            monthly[month]["operational"] += maint
            monthly[month]["allowance"] += driver_allowance + helper_allowance
            monthly[month]["trips"] += 1

    shoulder_by_category: dict[str, float] = defaultdict(float)
    shoulder_fuel = 0.0
    shoulder_toll = 0.0
    shoulder_allowance = 0.0
    shoulder_operational = 0.0

    for row in shoulder_rows:
        amount = float(row.amount_php or 0)
        cat = (row.category or "other").lower()
        shoulder_by_category[cat] += amount
        month = _month_key(row.recorded_at)
        if cat == "fuel":
            shoulder_fuel += amount
            if month:
                monthly[month]["fuel"] += amount
        elif cat == "toll":
            shoulder_toll += amount
            if month:
                monthly[month]["toll"] += amount
        elif cat == "allowance":
            shoulder_allowance += amount
            if month:
                monthly[month]["allowance"] += amount
        else:
            shoulder_operational += amount
            if month:
                monthly[month]["operational"] += amount

    maintenance_total = 0.0
    for record in maintenance_rows:
        cost = float(record.actual_cost or record.estimated_cost or 0)
        maintenance_total += cost
        month = _month_key(record.created_at or record.resolved_at)
        if month:
            monthly[month]["operational"] += cost

    fuel_total = round(system_fuel + shoulder_fuel, 2)
    toll_total = round(system_toll + shoulder_toll, 2)
    trip_crew_allowance_total = round(trip_driver_allowance_total + trip_helper_allowance_total, 2)
    allowance_total = round(trip_crew_allowance_total + shoulder_allowance, 2)
    labor_total_r = round(labor_total, 2)
    operational_total = round(trip_maintenance_total + shoulder_operational + maintenance_total, 2)
    grand_total = round(fuel_total + toll_total + allowance_total + labor_total_r + operational_total, 2)

    trip_count = len(trips)
    avg_per_trip = round(grand_total / trip_count, 2) if trip_count else 0.0

    for month, bucket in monthly.items():
        bucket["total"] = round(
            bucket["fuel"] + bucket["toll"] + bucket["allowance"] + bucket["operational"] + bucket["labor"],
            2,
        )
        for k in ("fuel", "toll", "allowance", "operational", "labor"):
            bucket[k] = round(bucket[k], 2)
        bucket["trips"] = int(bucket["trips"])

    monthly_trend = [
        {"month": month, **values}
        for month, values in sorted(monthly.items())
    ][-12:]

    category_breakdown = [
        {"key": "fuel", "label": "Fuel", "amount_php": fuel_total},
        {"key": "toll", "label": "Toll", "amount_php": toll_total},
        {"key": "allowance", "label": "Allowance", "amount_php": allowance_total},
        {"key": "labor", "label": "Labor", "amount_php": labor_total_r},
        {"key": "operational", "label": "Operational", "amount_php": operational_total},
    ]

    shoulder_breakdown = [
        {
            "category": cat,
            "label": SHOULDER_COST_CATEGORY_LABELS.get(cat, cat.replace("_", " ").title()),
            "amount_php": round(amount, 2),
        }
        for cat, amount in sorted(shoulder_by_category.items(), key=lambda x: -x[1])
    ]

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "total_expenses_php": grand_total,
            "trip_count": trip_count,
            "avg_expense_per_trip_php": avg_per_trip,
            "fuel_php": fuel_total,
            "toll_php": toll_total,
            "allowance_php": allowance_total,
            "driver_allowance_php": round(trip_driver_allowance_total, 2),
            "helper_allowance_php": round(trip_helper_allowance_total, 2),
            "labor_php": labor_total_r,
            "operational_php": operational_total,
        },
        "components": {
            "system_trip_fuel_php": round(system_fuel, 2),
            "system_trip_toll_php": round(system_toll, 2),
            "shoulder_fuel_php": round(shoulder_fuel, 2),
            "shoulder_toll_php": round(shoulder_toll, 2),
            "shoulder_allowance_php": round(shoulder_allowance, 2),
            "trip_driver_allowance_php": round(trip_driver_allowance_total, 2),
            "trip_helper_allowance_php": round(trip_helper_allowance_total, 2),
            "trip_crew_allowance_php": trip_crew_allowance_total,
            "shoulder_operational_php": round(shoulder_operational, 2),
            "maintenance_records_php": round(maintenance_total, 2),
            "trip_maintenance_field_php": round(trip_maintenance_total, 2),
        },
        "category_breakdown": category_breakdown,
        "shoulder_breakdown": shoulder_breakdown,
        "monthly_trend": monthly_trend,
    }
