"""Analytics ETL pipeline (paper §3.2.8 Fig 23 — data preparation & marts).

Produces three marts on every call:
  • trip_cost_mart   — totals & cost-per-km per completed trip
  • monthly_mart     — totals & trip counts per month
  • maintenance_mart — events & costs per truck

Used by `/api/analytics/dashboard` and the manager dashboard.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import (
    Booking,
    BookingStatus,
    FuelLog,
    MaintenanceRecord,
    Payment,
    PaymentStatus,
    TollLog,
    Trip,
    TripStatus,
    Truck,
)


def _month_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def run_pipeline(db: Session) -> dict[str, Any]:
    trips = db.query(Trip).all()
    bookings = db.query(Booking).all()
    fuel_logs = db.query(FuelLog).all()
    toll_logs = db.query(TollLog).all()
    maintenance = db.query(MaintenanceRecord).all()
    payments = db.query(Payment).all()
    trucks = db.query(Truck).all()

    # ---- Trip cost mart ----
    trip_mart = []
    for trip in trips:
        fuel = sum(f.cost for f in fuel_logs if f.trip_id == trip.id) or trip.fuel_cost
        toll = sum(t.amount for t in toll_logs if t.trip_id == trip.id) or trip.toll_cost
        labor = trip.labor_cost
        total = fuel + toll + labor
        trip_mart.append({
            "trip_id": trip.id,
            "booking_id": trip.booking_id,
            "distance_km": trip.distance_km,
            "fuel_cost": round(fuel, 2),
            "toll_cost": round(toll, 2),
            "labor_cost": round(labor, 2),
            "total_cost": round(total, 2),
            "cost_per_km": round(total / trip.distance_km, 2) if trip.distance_km else 0,
            "status": trip.status.value if hasattr(trip.status, "value") else str(trip.status),
            "completed_at": trip.completed_at.isoformat() if trip.completed_at else None,
        })

    # ---- Monthly mart ----
    monthly: dict[str, dict[str, float]] = defaultdict(lambda: {"total_cost": 0.0, "trips": 0})
    for trip in trips:
        if not trip.completed_at:
            continue
        key = _month_key(trip.completed_at)
        monthly[key]["total_cost"] += float((trip.fuel_cost or 0) + (trip.toll_cost or 0) + (trip.labor_cost or 0))
        monthly[key]["trips"] += 1
    monthly_mart = [
        {"month": k, "total_cost": round(v["total_cost"], 2), "trips": int(v["trips"])}
        for k, v in sorted(monthly.items())
    ]

    # ---- Maintenance mart ----
    maint_by_truck: dict[int, dict[str, float]] = defaultdict(lambda: {"events": 0, "cost": 0.0})
    for record in maintenance:
        maint_by_truck[record.truck_id]["events"] += 1
        maint_by_truck[record.truck_id]["cost"] += float(record.actual_cost or record.estimated_cost or 0)
    maintenance_mart = [
        {
            "truck_id": tid,
            "events": int(v["events"]),
            "total_cost": round(v["cost"], 2),
        }
        for tid, v in maint_by_truck.items()
    ]

    # ---- KPI rollup ----
    total_bookings = len(bookings)
    completed_bookings = sum(1 for b in bookings if b.status == BookingStatus.COMPLETED)
    ongoing_bookings = sum(
        1
        for b in bookings
        if b.status
        in {
            BookingStatus.APPROVED,
            BookingStatus.ASSIGNED,
            BookingStatus.ACCEPTED,
            BookingStatus.ENROUTE,
            BookingStatus.LOADING,
            BookingStatus.OUT_FOR_DELIVERY,
        }
    )
    total_revenue = sum(p.amount for p in payments if p.status == PaymentStatus.PAID)
    receivables = sum(b.estimated_cost for b in bookings if b.status == BookingStatus.COMPLETED) - total_revenue

    avg_trip_cost = (
        round(sum(t["total_cost"] for t in trip_mart) / len(trip_mart), 2)
        if trip_mart
        else 0
    )

    return {
        "ingested_at": datetime.utcnow().isoformat(),
        "kpis": {
            "total_bookings": total_bookings,
            "completed_bookings": completed_bookings,
            "ongoing_bookings": ongoing_bookings,
            "total_trips": len(trips),
            "active_trucks": sum(1 for t in trucks if t.status == "available"),
            "fleet_size": len(trucks),
            "total_revenue": round(float(total_revenue), 2),
            "outstanding_receivables": round(float(max(0, receivables)), 2),
            "average_trip_cost": avg_trip_cost,
        },
        "marts": {
            "trip_cost_mart": trip_mart,
            "monthly_mart": monthly_mart,
            "maintenance_mart": maintenance_mart,
        },
    }
