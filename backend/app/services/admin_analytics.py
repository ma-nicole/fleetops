"""Company-wide admin analytics from real DB records only."""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import inspect

from app.models.entities import (
    AttendanceRecord,
    Booking,
    BookingStatus,
    FuelLog,
    GeneralOperationalReport,
    MaintenanceRecord,
    OperationalLog,
    Payment,
    PaymentStatus,
    TollLog,
    Trip,
    TripShoulderCostEntry,
    TripStatus,
    Truck,
    User,
    UserRole,
)
from app.services.admin_analytics_validation import validate_admin_analytics
from app.services.analytics_stats import compute_statistics, empty_module

logger = logging.getLogger(__name__)

IN_TRANSIT_BOOKING = frozenset(
    {
        BookingStatus.ASSIGNED,
        BookingStatus.ACCEPTED,
        BookingStatus.ENROUTE,
        BookingStatus.LOADING,
        BookingStatus.OUT_FOR_DELIVERY,
        BookingStatus.APPROVED,
    }
)
CANCELLED_BOOKING = frozenset(
    {
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
        BookingStatus.EXPIRED,
        BookingStatus.PAYMENT_REJECTED,
    }
)
ACTIVE_TRIP = frozenset(
    {
        TripStatus.ASSIGNED,
        TripStatus.ACCEPTED,
        TripStatus.DEPARTED,
        TripStatus.LOADING,
        TripStatus.IN_DELIVERY,
    }
)


@dataclass
class AnalyticsFilters:
    date_from: date | None = None
    date_to: date | None = None
    driver_id: int | None = None
    truck_id: int | None = None
    route: str | None = None
    shipment_status: str | None = None


def _status_str(val) -> str:
    return val.value if hasattr(val, "value") else str(val)


def _route_key(pickup: str | None, dropoff: str | None) -> str:
    return f"{(pickup or '').strip()} → {(dropoff or '').strip()}"


def _activity_month(dt: datetime | date | None) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y-%m")


def _activity_date(dt: datetime | date | None) -> date | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.date()
    return dt


def _trip_activity_date(trip: Trip) -> date | None:
    for dt in (trip.completed_at, trip.assigned_at, trip.departure_time):
        if dt is not None:
            return _activity_date(dt)
    if trip.booking and trip.booking.scheduled_date:
        return trip.booking.scheduled_date
    return None


def _expense_context_year(records: list[dict[str, Any]], f: AnalyticsFilters) -> int:
    if f.date_to:
        return f.date_to.year
    if f.date_from:
        return f.date_from.year
    years = [int(r["expense_date"][:4]) for r in records if r.get("expense_date")]
    if years:
        return max(years)
    return datetime.utcnow().year


def _date_in_filter(d: date | None, f: AnalyticsFilters) -> bool:
    if d is None:
        return f.date_from is None and f.date_to is None
    if f.date_from and d < f.date_from:
        return False
    if f.date_to and d > f.date_to:
        return False
    return True


def _booking_in_filters(
    booking: Booking,
    trip: Trip | None,
    f: AnalyticsFilters,
) -> bool:
    if not _date_in_filter(booking.scheduled_date, f):
        return False
    if f.route:
        if _route_key(booking.pickup_location, booking.dropoff_location) != f.route:
            return False
    if trip:
        if f.driver_id and trip.driver_id != f.driver_id:
            return False
        if f.truck_id and trip.truck_id != f.truck_id:
            return False
    elif f.driver_id or f.truck_id:
        return False
    return True


def _primary_trip(ctx: dict, booking_id: int) -> Trip | None:
    trips = [t for t in ctx["trips_by_booking"].get(booking_id, []) if t.status != TripStatus.CANCELLED]
    if not trips:
        trips = ctx["trips_by_booking"].get(booking_id, [])
    return trips[0] if trips else None


def _filtered_trips(ctx: dict, f: AnalyticsFilters) -> list[Trip]:
    rows: list[Trip] = []
    for trip in ctx["trips"]:
        booking = trip.booking
        if not booking or not _booking_in_filters(booking, trip, f):
            continue
        rows.append(trip)
    return rows


def _trip_delay_reason(trip: Trip, delay_logs: dict[int, str]) -> str | None:
    if trip.id in delay_logs:
        return delay_logs[trip.id]
    eta = trip.estimated_delivery_time
    end = trip.completed_at
    if eta and end and end > eta:
        return "Completed after estimated delivery time"
    if eta and not end and eta < datetime.utcnow() and trip.status != TripStatus.COMPLETED:
        return "Past estimated delivery time (in progress)"
    return None


def _is_delayed(booking: Booking, trip: Trip | None, delay_logs: dict[int, str]) -> bool:
    return bool(trip and _trip_delay_reason(trip, delay_logs))


def _shipment_category(booking: Booking, trip: Trip | None, delay_logs: dict[int, str]) -> str:
    st = _status_str(booking.status)
    if st in {s.value for s in CANCELLED_BOOKING}:
        return "cancelled"
    trip_done = trip and _status_str(trip.status) == TripStatus.COMPLETED.value
    booking_done = st == BookingStatus.COMPLETED.value
    if booking_done or trip_done:
        return "delayed" if _is_delayed(booking, trip, delay_logs) else "delivered"
    if st in {s.value for s in IN_TRANSIT_BOOKING} or (
        trip and _status_str(trip.status) in {s.value for s in ACTIVE_TRIP}
    ):
        return "delayed" if _is_delayed(booking, trip, delay_logs) else "in_transit"
    if _is_delayed(booking, trip, delay_logs):
        return "delayed"
    return "pending"


def _load_context(db: Session) -> dict[str, Any]:
    bookings = db.query(Booking).options(joinedload(Booking.customer)).all()
    trips = (
        db.query(Trip)
        .options(
            joinedload(Trip.booking),
            joinedload(Trip.truck),
            joinedload(Trip.driver),
            joinedload(Trip.helper),
        )
        .all()
    )
    trips_by_booking: dict[int, list[Trip]] = defaultdict(list)
    for t in trips:
        trips_by_booking[t.booking_id].append(t)

    delay_logs: dict[int, str] = {}
    for row in db.query(OperationalLog).filter(OperationalLog.report_type == "delivery_delay").all():
        delay_logs[row.trip_id] = (row.operational_details or "Delivery delay")[:500]
    for row in db.query(GeneralOperationalReport).filter(
        GeneralOperationalReport.category == "delay_report"
    ).all():
        if row.trip_id and row.trip_id not in delay_logs:
            delay_logs[row.trip_id] = (row.description or "Delay report")[:500]

    fuel_logs = db.query(FuelLog).all()
    toll_logs = db.query(TollLog).all()
    table_names = {t for t in inspect(db.get_bind()).get_table_names()}
    shoulder = (
        db.query(TripShoulderCostEntry).all()
        if "trip_shoulder_cost_entries" in table_names
        else []
    )
    maintenance = db.query(MaintenanceRecord).all()
    payments = db.query(Payment).all()
    trucks = db.query(Truck).all()
    drivers = db.query(User).filter(User.role == UserRole.DRIVER).all()
    customers = db.query(User).filter(User.role == UserRole.CUSTOMER).all()
    attendance = db.query(AttendanceRecord).all()

    fuel_by_trip: dict[int, float] = defaultdict(float)
    for fl in fuel_logs:
        fuel_by_trip[fl.trip_id] += float(fl.cost or 0)

    toll_by_trip: dict[int, float] = defaultdict(float)
    for tl in toll_logs:
        toll_by_trip[tl.trip_id] += float(tl.amount or 0)

    return {
        "bookings": bookings,
        "trips": trips,
        "trips_by_booking": trips_by_booking,
        "delay_logs": delay_logs,
        "fuel_logs": fuel_logs,
        "toll_logs": toll_logs,
        "fuel_by_trip": fuel_by_trip,
        "toll_by_trip": toll_by_trip,
        "shoulder": shoulder,
        "maintenance": maintenance,
        "payments": payments,
        "trucks": trucks,
        "drivers": drivers,
        "customers": customers,
        "attendance": attendance,
    }


def _delivery_hours(trip: Trip) -> float | None:
    """Only from recorded timestamps — no estimated duration fallback."""
    start = trip.departure_time or trip.assigned_at
    end = trip.completed_at or trip.arrival_delivery_time
    if start and end:
        return max(0.0, (end - start).total_seconds() / 3600)
    return None


def _trip_fuel(trip: Trip, fuel_by_trip: dict[int, float]) -> float:
    logged = fuel_by_trip.get(trip.id)
    if logged is not None and logged > 0:
        return float(logged)
    return float(trip.fuel_cost or 0)


def _trip_toll(trip: Trip, toll_by_trip: dict[int, float]) -> float:
    logged = toll_by_trip.get(trip.id)
    if logged is not None and logged > 0:
        return float(logged)
    return float(trip.toll_cost or 0)


def _trip_direct_cost(trip: Trip, ctx: dict) -> float:
    return (
        _trip_fuel(trip, ctx["fuel_by_trip"])
        + _trip_toll(trip, ctx["toll_by_trip"])
        + float(trip.labor_cost or 0)
        + float(getattr(trip, "driver_allowance_php", 0) or 0)
        + float(getattr(trip, "helper_allowance_php", 0) or 0)
        + float(trip.maintenance_cost or 0)
    )


def _maintenance_in_filters(rec: MaintenanceRecord, f: AnalyticsFilters) -> bool:
    if f.truck_id and rec.truck_id != f.truck_id:
        return False
    ref = rec.created_at.date() if rec.created_at else None
    return _date_in_filter(ref, f)


def _shoulder_in_filters(row: TripShoulderCostEntry, trip: Trip | None, f: AnalyticsFilters) -> bool:
    if trip and trip.booking and not _booking_in_filters(trip.booking, trip, f):
        return False
    ref = row.recorded_at.date() if row.recorded_at else None
    return _date_in_filter(ref, f)


def _payment_in_filters(pay: Payment, booking: Booking | None, trip: Trip | None, f: AnalyticsFilters) -> bool:
    if pay.status != PaymentStatus.VERIFIED:
        return False
    if not booking:
        return False
    return _booking_in_filters(booking, trip, f)


def build_shipment_analytics(ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    rows: list[dict] = []
    monthly: dict[str, int] = defaultdict(int)
    monthly_jobs: dict[str, int] = defaultdict(int)
    status_counts: dict[str, int] = defaultdict(int)
    delivery_hours: list[float] = []
    customer_name_by_id = {c.id: (c.full_name or c.email) for c in ctx["customers"]}
    verified_revenue_by_booking: dict[int, float] = defaultdict(float)
    for pay in ctx["payments"]:
        if pay.status == PaymentStatus.VERIFIED:
            verified_revenue_by_booking[pay.booking_id] += float(pay.amount or 0)

    for booking in ctx["bookings"]:
        trip = _primary_trip(ctx, booking.id)
        if not _booking_in_filters(booking, trip, f):
            continue
        cat = _shipment_category(booking, trip, ctx["delay_logs"])
        if f.shipment_status and cat != f.shipment_status:
            continue
        status_counts[cat] += 1
        month = _activity_month(booking.scheduled_date)
        if month:
            monthly_jobs[month] += 1
        if cat == "delivered" and month:
            monthly[month] += 1
        if trip:
            hrs = _delivery_hours(trip)
            if hrs is not None and cat == "delivered":
                delivery_hours.append(hrs)
        delivery_date = None
        if trip and trip.completed_at:
            delivery_date = trip.completed_at.date().isoformat()
        elif cat == "delivered" and booking.scheduled_date:
            delivery_date = booking.scheduled_date.isoformat()
        fuel_php = _trip_fuel(trip, ctx["fuel_by_trip"]) if trip else 0.0
        toll_php = _trip_toll(trip, ctx["toll_by_trip"]) if trip else 0.0
        expense_php = _trip_direct_cost(trip, ctx) if trip else 0.0
        revenue_php = float(verified_revenue_by_booking.get(booking.id, 0.0))
        rows.append(
            {
                "booking_id": booking.id,
                "trip_id": trip.id if trip else None,
                "date": delivery_date or (booking.scheduled_date.isoformat() if booking.scheduled_date else None),
                "customer": customer_name_by_id.get(booking.customer_id),
                "driver": trip.driver.full_name if trip and trip.driver else None,
                "helper": trip.helper.full_name if trip and trip.helper else None,
                "truck": trip.truck.code if trip and trip.truck else None,
                "route": _route_key(booking.pickup_location, booking.dropoff_location),
                "status": _status_str(booking.status),
                "delivery_status": cat,
                "delivery_date": delivery_date,
                "scheduled_month": month,
                "delay_reason": _trip_delay_reason(trip, ctx["delay_logs"]) if trip else None,
                "revenue_php": round(revenue_php, 2),
                "expense_php": round(expense_php, 2),
                "fuel_php": round(float(fuel_php), 2),
                "toll_php": round(float(toll_php), 2),
                "profit_php": round(revenue_php - expense_php, 2),
            }
        )

    total = len(rows)
    if total == 0:
        return empty_module()

    delivered = status_counts.get("delivered", 0)
    delayed = status_counts.get("delayed", 0)
    cancelled = status_counts.get("cancelled", 0)
    in_transit = status_counts.get("in_transit", 0)
    pending = status_counts.get("pending", 0)
    success_rate = round((delivered / total) * 100, 1)
    avg_hours = round(sum(delivery_hours) / len(delivery_hours), 2) if delivery_hours else None

    return {
        "summary": {
            "total_shipments": total,
            "delivered": delivered,
            "delayed": delayed,
            "cancelled": cancelled,
            "in_transit": in_transit,
            "pending": pending,
            "delivery_success_rate_pct": success_rate,
            "average_delivery_hours": avg_hours,
            "average_delivery_hours_note": None if avg_hours is not None else "Insufficient data",
        },
        "statistics": compute_statistics(delivery_hours, min_samples=1),
        "status_distribution": [
            {"status": k, "count": v} for k, v in sorted(status_counts.items(), key=lambda x: -x[1])
        ],
        "monthly_deliveries": [{"month": m, "count": c} for m, c in sorted(monthly.items())][-12:],
        "jobs_over_time": [{"month": m, "count": c} for m, c in sorted(monthly_jobs.items())][-12:],
        "drilldown": rows,
    }


def _append_expense_record(
    records: list[dict[str, Any]],
    *,
    expense_date: date | None,
    category: str,
    amount_php: float,
    source_type: str,
    source_id: int | None = None,
    trip_id: int | None = None,
    booking_id: int | None = None,
    truck_id: int | None = None,
    truck_code: str | None = None,
    label: str | None = None,
    customer: str | None = None,
    route: str | None = None,
    driver: str | None = None,
    status: str | None = None,
    fuel_php: float | None = None,
    toll_php: float | None = None,
    revenue_php: float | None = None,
    profit_php: float | None = None,
) -> None:
    if expense_date is None or amount_php <= 0:
        return
    records.append(
        {
            "expense_date": expense_date.isoformat(),
            "category": category,
            "amount_php": round(float(amount_php), 2),
            "source_type": source_type,
            "source_id": source_id,
            "trip_id": trip_id,
            "booking_id": booking_id,
            "truck_id": truck_id,
            "truck_code": truck_code,
            "label": label,
            "customer": customer,
            "route": route,
            "driver": driver,
            "status": status,
            "fuel_php": round(float(fuel_php or 0), 2),
            "toll_php": round(float(toll_php or 0), 2),
            "revenue_php": round(float(revenue_php or 0), 2),
            "profit_php": round(float(profit_php or 0), 2),
        }
    )


def _collect_expense_records(ctx: dict, f: AnalyticsFilters) -> list[dict[str, Any]]:
    """Date-level operational expense line items from real DB sources."""
    records: list[dict[str, Any]] = []
    filtered_trips = _filtered_trips(ctx, f)
    filtered_trip_ids = {t.id for t in filtered_trips if t.status != TripStatus.CANCELLED}
    trip_by_id = {t.id: t for t in ctx["trips"]}
    truck_map = {t.id: t.code for t in ctx["trucks"]}
    customer_name_by_id = {c.id: (c.full_name or c.email) for c in ctx["customers"]}
    verified_revenue_by_booking: dict[int, float] = defaultdict(float)
    for pay in ctx["payments"]:
        if pay.status == PaymentStatus.VERIFIED:
            verified_revenue_by_booking[pay.booking_id] += float(pay.amount or 0)

    fuel_logged_trip_ids: set[int] = set()
    for fl in ctx["fuel_logs"]:
        trip = trip_by_id.get(fl.trip_id)
        if not trip or trip.id not in filtered_trip_ids:
            continue
        ref = _activity_date(fl.recorded_at)
        if not _date_in_filter(ref, f):
            continue
        amt = float(fl.cost or 0)
        if amt <= 0:
            continue
        fuel_logged_trip_ids.add(trip.id)
        _append_expense_record(
            records,
            expense_date=ref,
            category="fuel",
            amount_php=amt,
            source_type="fuel_log",
            source_id=fl.id,
            trip_id=trip.id,
            booking_id=trip.booking_id,
            truck_id=fl.truck_id,
            truck_code=truck_map.get(fl.truck_id),
            label=f"Fuel log #{fl.id}",
            customer=customer_name_by_id.get(trip.booking.customer_id) if trip and trip.booking else None,
            route=_route_key(trip.booking.pickup_location, trip.booking.dropoff_location) if trip and trip.booking else None,
            driver=trip.driver.full_name if trip and trip.driver else None,
            status=_status_str(trip.booking.status) if trip and trip.booking else None,
            fuel_php=amt,
            toll_php=0.0,
            revenue_php=verified_revenue_by_booking.get(trip.booking_id, 0.0) if trip else 0.0,
            profit_php=(verified_revenue_by_booking.get(trip.booking_id, 0.0) - amt) if trip else 0.0,
        )

    toll_logged_trip_ids: set[int] = set()
    for tl in ctx["toll_logs"]:
        trip = trip_by_id.get(tl.trip_id)
        if not trip or trip.id not in filtered_trip_ids:
            continue
        ref = _activity_date(tl.recorded_at)
        if not _date_in_filter(ref, f):
            continue
        amt = float(tl.amount or 0)
        if amt <= 0:
            continue
        toll_logged_trip_ids.add(trip.id)
        _append_expense_record(
            records,
            expense_date=ref,
            category="toll",
            amount_php=amt,
            source_type="toll_log",
            source_id=tl.id,
            trip_id=trip.id,
            booking_id=trip.booking_id,
            truck_id=trip.truck_id,
            truck_code=truck_map.get(trip.truck_id) if trip.truck_id else None,
            label=tl.location or f"Toll log #{tl.id}",
            customer=customer_name_by_id.get(trip.booking.customer_id) if trip and trip.booking else None,
            route=_route_key(trip.booking.pickup_location, trip.booking.dropoff_location) if trip and trip.booking else None,
            driver=trip.driver.full_name if trip and trip.driver else None,
            status=_status_str(trip.booking.status) if trip and trip.booking else None,
            fuel_php=0.0,
            toll_php=amt,
            revenue_php=verified_revenue_by_booking.get(trip.booking_id, 0.0) if trip else 0.0,
            profit_php=(verified_revenue_by_booking.get(trip.booking_id, 0.0) - amt) if trip else 0.0,
        )

    for trip in filtered_trips:
        if trip.status == TripStatus.CANCELLED:
            continue
        ref = _trip_activity_date(trip)
        if not _date_in_filter(ref, f):
            continue
        truck_code = truck_map.get(trip.truck_id) if trip.truck_id else None

        if trip.id not in fuel_logged_trip_ids:
            fuel = float(trip.fuel_cost or 0)
            if fuel > 0:
                _append_expense_record(
                    records,
                    expense_date=ref,
                    category="fuel",
                    amount_php=fuel,
                    source_type="trip_fuel",
                    source_id=trip.id,
                    trip_id=trip.id,
                    booking_id=trip.booking_id,
                    truck_id=trip.truck_id,
                    truck_code=truck_code,
                    label=f"Trip #{trip.id} fuel",
                    customer=customer_name_by_id.get(trip.booking.customer_id) if trip.booking else None,
                    route=_route_key(trip.booking.pickup_location, trip.booking.dropoff_location) if trip.booking else None,
                    driver=trip.driver.full_name if trip.driver else None,
                    status=_status_str(trip.booking.status) if trip.booking else None,
                    fuel_php=fuel,
                    toll_php=0.0,
                    revenue_php=verified_revenue_by_booking.get(trip.booking_id, 0.0),
                    profit_php=verified_revenue_by_booking.get(trip.booking_id, 0.0) - fuel,
                )

        if trip.id not in toll_logged_trip_ids:
            toll = float(trip.toll_cost or 0)
            if toll > 0:
                _append_expense_record(
                    records,
                    expense_date=ref,
                    category="toll",
                    amount_php=toll,
                    source_type="trip_toll",
                    source_id=trip.id,
                    trip_id=trip.id,
                    booking_id=trip.booking_id,
                    truck_id=trip.truck_id,
                    truck_code=truck_code,
                    label=f"Trip #{trip.id} toll",
                    customer=customer_name_by_id.get(trip.booking.customer_id) if trip.booking else None,
                    route=_route_key(trip.booking.pickup_location, trip.booking.dropoff_location) if trip.booking else None,
                    driver=trip.driver.full_name if trip.driver else None,
                    status=_status_str(trip.booking.status) if trip.booking else None,
                    fuel_php=0.0,
                    toll_php=toll,
                    revenue_php=verified_revenue_by_booking.get(trip.booking_id, 0.0),
                    profit_php=verified_revenue_by_booking.get(trip.booking_id, 0.0) - toll,
                )

        da = float(getattr(trip, "driver_allowance_php", 0) or 0)
        if da > 0:
            _append_expense_record(
                records,
                expense_date=ref,
                category="driver_allowance",
                amount_php=da,
                source_type="trip_allowance",
                source_id=trip.id,
                trip_id=trip.id,
                booking_id=trip.booking_id,
                truck_id=trip.truck_id,
                truck_code=truck_code,
                label=f"Trip #{trip.id} driver allowance",
                customer=customer_name_by_id.get(trip.booking.customer_id) if trip.booking else None,
                route=_route_key(trip.booking.pickup_location, trip.booking.dropoff_location) if trip.booking else None,
                driver=trip.driver.full_name if trip.driver else None,
                status=_status_str(trip.booking.status) if trip.booking else None,
                revenue_php=verified_revenue_by_booking.get(trip.booking_id, 0.0),
                profit_php=verified_revenue_by_booking.get(trip.booking_id, 0.0) - da,
            )

        ha = float(getattr(trip, "helper_allowance_php", 0) or 0)
        if ha > 0:
            _append_expense_record(
                records,
                expense_date=ref,
                category="helper_allowance",
                amount_php=ha,
                source_type="trip_allowance",
                source_id=trip.id,
                trip_id=trip.id,
                booking_id=trip.booking_id,
                truck_id=trip.truck_id,
                truck_code=truck_code,
                label=f"Trip #{trip.id} helper allowance",
                customer=customer_name_by_id.get(trip.booking.customer_id) if trip.booking else None,
                route=_route_key(trip.booking.pickup_location, trip.booking.dropoff_location) if trip.booking else None,
                driver=trip.driver.full_name if trip.driver else None,
                status=_status_str(trip.booking.status) if trip.booking else None,
                revenue_php=verified_revenue_by_booking.get(trip.booking_id, 0.0),
                profit_php=verified_revenue_by_booking.get(trip.booking_id, 0.0) - ha,
            )

        maint = float(trip.maintenance_cost or 0)
        if maint > 0:
            _append_expense_record(
                records,
                expense_date=ref,
                category="maintenance",
                amount_php=maint,
                source_type="trip_maintenance",
                source_id=trip.id,
                trip_id=trip.id,
                booking_id=trip.booking_id,
                truck_id=trip.truck_id,
                truck_code=truck_code,
                label=f"Trip #{trip.id} maintenance",
                customer=customer_name_by_id.get(trip.booking.customer_id) if trip.booking else None,
                route=_route_key(trip.booking.pickup_location, trip.booking.dropoff_location) if trip.booking else None,
                driver=trip.driver.full_name if trip.driver else None,
                status=_status_str(trip.booking.status) if trip.booking else None,
                revenue_php=verified_revenue_by_booking.get(trip.booking_id, 0.0),
                profit_php=verified_revenue_by_booking.get(trip.booking_id, 0.0) - maint,
            )

    for row in ctx["shoulder"]:
        trip = trip_by_id.get(row.trip_id)
        if not _shoulder_in_filters(row, trip, f):
            continue
        amt = float(row.amount_php or 0)
        if amt <= 0:
            continue
        ref = _activity_date(row.recorded_at)
        cat = (row.category or "").lower()
        if cat == "fuel":
            category = "fuel"
        elif cat == "toll":
            category = "toll"
        elif cat == "allowance":
            category = "driver_allowance"
        else:
            category = "maintenance"
        _append_expense_record(
            records,
            expense_date=ref,
            category=category,
            amount_php=amt,
            source_type="shoulder_cost",
            source_id=row.id,
            trip_id=row.trip_id,
            booking_id=row.booking_id,
            truck_code=truck_map.get(trip.truck_id) if trip and trip.truck_id else None,
            label=row.notes or f"Shoulder {cat} #{row.id}",
            customer=customer_name_by_id.get(trip.booking.customer_id) if trip and trip.booking else None,
            route=_route_key(trip.booking.pickup_location, trip.booking.dropoff_location) if trip and trip.booking else None,
            driver=trip.driver.full_name if trip and trip.driver else None,
            status=_status_str(trip.booking.status) if trip and trip.booking else None,
            revenue_php=verified_revenue_by_booking.get(trip.booking_id, 0.0) if trip else 0.0,
            profit_php=(verified_revenue_by_booking.get(trip.booking_id, 0.0) - amt) if trip else 0.0,
        )

    for rec in ctx["maintenance"]:
        if not _maintenance_in_filters(rec, f):
            continue
        cost = float(rec.actual_cost or rec.estimated_cost or 0)
        if cost <= 0:
            continue
        ref = _activity_date(rec.created_at)
        _append_expense_record(
            records,
            expense_date=ref,
            category="maintenance",
            amount_php=cost,
            source_type="maintenance_record",
            source_id=rec.id,
            trip_id=None,
            booking_id=None,
            truck_id=rec.truck_id,
            truck_code=truck_map.get(rec.truck_id),
            label=rec.reported_issue or f"Maintenance #{rec.id}",
        )

    records.sort(key=lambda r: (r["expense_date"], r["category"], r.get("source_id") or 0))
    return records


def build_expense_analytics(ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    records = _collect_expense_records(ctx, f)
    truck_map = {t.id: t.code for t in ctx["trucks"]}

    fuel_total = round(sum(r["amount_php"] for r in records if r["category"] == "fuel"), 2)
    toll_total_r = round(sum(r["amount_php"] for r in records if r["category"] == "toll"), 2)
    maint_total_r = round(sum(r["amount_php"] for r in records if r["category"] == "maintenance"), 2)
    driver_allow_r = round(sum(r["amount_php"] for r in records if r["category"] == "driver_allowance"), 2)
    helper_allow_r = round(sum(r["amount_php"] for r in records if r["category"] == "helper_allowance"), 2)
    total = round(fuel_total + toll_total_r + maint_total_r + driver_allow_r + helper_allow_r, 2)

    if total <= 0 and not records:
        return empty_module()

    fuel_by_truck: dict[int, float] = defaultdict(float)
    fuel_by_route: dict[str, float] = defaultdict(float)
    fuel_values: list[float] = []
    monthly: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))

    trip_by_id = {t.id: t for t in ctx["trips"]}
    for rec in records:
        amt = float(rec["amount_php"])
        month = rec["expense_date"][:7]
        monthly[month][rec["category"]] += amt
        if rec["category"] == "fuel":
            fuel_values.append(amt)
            if rec.get("truck_id"):
                fuel_by_truck[int(rec["truck_id"])] += amt
            trip = trip_by_id.get(rec.get("trip_id") or -1)
            if trip and trip.booking:
                route = _route_key(trip.booking.pickup_location, trip.booking.dropoff_location)
                fuel_by_route[route] += amt

    breakdown = [
        {"key": "fuel", "label": "Fuel", "amount_php": fuel_total},
        {"key": "toll", "label": "Toll", "amount_php": toll_total_r},
        {"key": "maintenance", "label": "Maintenance", "amount_php": maint_total_r},
        {"key": "driver_allowance", "label": "Driver allowances", "amount_php": driver_allow_r},
        {"key": "helper_allowance", "label": "Helper allowances", "amount_php": helper_allow_r},
    ]

    monthly_trend = []
    for month in sorted(monthly.keys())[-12:]:
        bucket = monthly[month]
        fuel_m = bucket.get("fuel", 0)
        toll_m = bucket.get("toll", 0)
        maint_m = bucket.get("maintenance", 0)
        allow_m = bucket.get("driver_allowance", 0) + bucket.get("helper_allowance", 0)
        monthly_trend.append(
            {
                "month": month,
                "fuel": round(fuel_m, 2),
                "toll": round(toll_m, 2),
                "maintenance": round(maint_m, 2),
                "allowance": round(allow_m, 2),
                "total": round(fuel_m + toll_m + maint_m + allow_m, 2),
            }
        )

    context_year = _expense_context_year(records, f)
    category_labels = {
        "fuel": "Fuel",
        "toll": "Toll",
        "maintenance": "Maintenance",
        "driver_allowance": "Driver Allowances",
        "helper_allowance": "Helper Allowances",
    }

    return {
        "summary": {
            "fuel_expenses_php": fuel_total,
            "toll_expenses_php": toll_total_r,
            "maintenance_expenses_php": maint_total_r,
            "driver_allowances_php": driver_allow_r,
            "helper_allowances_php": helper_allow_r,
            "total_operational_cost_php": total,
        },
        "statistics": compute_statistics(fuel_values, min_samples=1),
        "fuel_by_truck": [
            {"truck_id": tid, "truck_code": truck_map.get(tid, f"Truck #{tid}"), "fuel_php": round(v, 2)}
            for tid, v in sorted(fuel_by_truck.items(), key=lambda x: -x[1])
        ],
        "fuel_by_route": [
            {"route": r, "fuel_php": round(v, 2)}
            for r, v in sorted(fuel_by_route.items(), key=lambda x: -x[1])[:15]
        ],
        "expense_breakdown": breakdown,
        "monthly_totals": monthly_trend,
        "drilldown": {
            "context_year": context_year,
            "categories": [{"key": k, "label": v} for k, v in category_labels.items()],
            "records": records,
        },
    }


def build_fleet_analytics(ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    filtered_trips = [t for t in _filtered_trips(ctx, f) if t.status != TripStatus.CANCELLED]
    trips_per_truck: dict[int, int] = defaultdict(int)
    fuel_per_truck: dict[int, float] = defaultdict(float)
    maint_events: dict[int, int] = defaultdict(int)
    driver_sets: dict[int, set[int]] = defaultdict(set)

    for trip in filtered_trips:
        trips_per_truck[trip.truck_id] += 1
        fuel_per_truck[trip.truck_id] += _trip_fuel(trip, ctx["fuel_by_trip"])
        driver_sets[trip.truck_id].add(trip.driver_id)

    for rec in ctx["maintenance"]:
        if _maintenance_in_filters(rec, f):
            maint_events[rec.truck_id] += 1

    truck_map = {t.id: t for t in ctx["trucks"]}
    filtered_trip_count = len(filtered_trips)
    usage_rows = []
    for tid, count in trips_per_truck.items():
        truck = truck_map.get(tid)
        util_pct = round((count / filtered_trip_count) * 100, 1) if filtered_trip_count else 0.0
        usage_rows.append(
            {
                "truck_id": tid,
                "truck_code": truck.code if truck else f"#{tid}",
                "trip_count": count,
                "utilization_rate_pct": util_pct,
                "fuel_php": round(fuel_per_truck.get(tid, 0), 2),
                "maintenance_events": maint_events.get(tid, 0),
                "assigned_drivers": len(driver_sets.get(tid, set())),
                "status": truck.status if truck else None,
            }
        )

    if not usage_rows and not ctx["trucks"]:
        return empty_module()

    usage_rows.sort(key=lambda x: -x["trip_count"])
    most = usage_rows[0] if usage_rows else None
    least = usage_rows[-1] if usage_rows else None
    active_trucks = sum(
        1
        for t in ctx["trucks"]
        if (t.status or "available") not in ("maintenance", "inactive", "in_maintenance")
    )
    trucks_with_trips = len(trips_per_truck)
    fleet_size = len(truck_map)
    util_pct = round((trucks_with_trips / fleet_size) * 100, 1) if fleet_size else 0.0

    return {
        "summary": {
            "fleet_size": fleet_size,
            "active_trucks": active_trucks,
            "most_used_truck": most["truck_code"] if most else None,
            "least_used_truck": least["truck_code"] if least else None,
            "fleet_utilization_rate_pct": util_pct,
            "total_trips": filtered_trip_count,
        },
        "statistics": compute_statistics([float(r["trip_count"]) for r in usage_rows], min_samples=1),
        "truck_usage": usage_rows,
        "drilldown": usage_rows,
    }


def build_driver_analytics(ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    stats: dict[int, dict] = defaultdict(
        lambda: {
            "name": "",
            "completed": 0,
            "delayed": 0,
            "on_time": 0,
            "fuel_php": 0.0,
            "distance_km": 0.0,
            "hours": 0.0,
            "routes": set(),
        }
    )

    for trip in _filtered_trips(ctx, f):
        if f.driver_id and trip.driver_id != f.driver_id:
            continue
        booking = trip.booking
        if not booking:
            continue
        d = stats[trip.driver_id]
        if trip.driver:
            d["name"] = trip.driver.full_name
        route = _route_key(booking.pickup_location, booking.dropoff_location)
        d["routes"].add(route)
        d["fuel_php"] += _trip_fuel(trip, ctx["fuel_by_trip"])
        d["distance_km"] += float(trip.distance_km or 0)
        hrs = _delivery_hours(trip)
        if hrs is not None:
            d["hours"] += hrs
        cat = _shipment_category(booking, trip, ctx["delay_logs"])
        trip_done = _status_str(trip.status) == TripStatus.COMPLETED.value
        booking_done = _status_str(booking.status) == BookingStatus.COMPLETED.value
        if cat == "delivered":
            d["completed"] += 1
            d["on_time"] += 1
        elif cat == "delayed":
            d["delayed"] += 1
            if trip_done or booking_done:
                d["completed"] += 1

    attendance_by_driver: dict[int, int] = defaultdict(int)
    for att in ctx["attendance"]:
        attendance_by_driver[att.user_id] += 1

    rows = []
    for did, d in stats.items():
        if not d["name"]:
            u = next((x for x in ctx["drivers"] if x.id == did), None)
            d["name"] = u.full_name if u else f"Driver #{did}"
        rows.append(
            {
                "driver_id": did,
                "driver_name": d["name"],
                "deliveries_completed": d["completed"],
                "delayed_deliveries": d["delayed"],
                "on_time_deliveries": d["on_time"],
                "attendance_records": attendance_by_driver.get(did, 0),
                "fuel_php": round(d["fuel_php"], 2),
                "distance_km": round(d["distance_km"], 2),
                "total_hours": round(d["hours"], 2),
                "route_count": len(d["routes"]),
                "score": max(0, d["on_time"] * 2 - d["delayed"]),
            }
        )

    if not rows:
        return empty_module()

    rows.sort(key=lambda x: -x["score"])

    return {
        "summary": {
            "driver_count": len(rows),
            "total_completed": sum(r["deliveries_completed"] for r in rows),
            "total_delayed": sum(r["delayed_deliveries"] for r in rows),
        },
        "statistics": compute_statistics([float(r["deliveries_completed"]) for r in rows], min_samples=1),
        "ranking": rows[:20],
        "distribution": [
            {
                "driver_name": r["driver_name"],
                "completed": r["deliveries_completed"],
                "delayed": r["delayed_deliveries"],
            }
            for r in rows[:10]
        ],
        "drilldown": rows,
    }


def build_route_analytics(ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    route_stats: dict[str, dict] = defaultdict(
        lambda: {
            "deliveries": 0,
            "delayed": 0,
            "total_cost": 0.0,
            "fuel_php": 0.0,
            "distance_km": 0.0,
            "hours": [],
            "drivers": set(),
        }
    )

    for trip in _filtered_trips(ctx, f):
        booking = trip.booking
        if not booking:
            continue
        rk = _route_key(booking.pickup_location, booking.dropoff_location)
        if f.route and rk != f.route:
            continue
        rs = route_stats[rk]
        rs["deliveries"] += 1
        cat = _shipment_category(booking, trip, ctx["delay_logs"])
        if cat == "delayed":
            rs["delayed"] += 1
        fuel = _trip_fuel(trip, ctx["fuel_by_trip"])
        toll = _trip_toll(trip, ctx["toll_by_trip"])
        cost = fuel + toll + float(trip.labor_cost or 0)
        rs["total_cost"] += cost
        rs["fuel_php"] += fuel
        rs["distance_km"] += float(trip.distance_km or 0)
        rs["drivers"].add(trip.driver_id)
        hrs = _delivery_hours(trip)
        if hrs is not None:
            rs["hours"].append(hrs)

    if not route_stats:
        return empty_module()

    rows = []
    for route, rs in route_stats.items():
        avg_h = round(sum(rs["hours"]) / len(rs["hours"]), 2) if rs["hours"] else None
        rows.append(
            {
                "route": route,
                "deliveries": rs["deliveries"],
                "delayed_count": rs["delayed"],
                "total_cost_php": round(rs["total_cost"], 2),
                "fuel_php": round(rs["fuel_php"], 2),
                "distance_km": round(rs["distance_km"], 2),
                "avg_delivery_hours": avg_h,
                "driver_count": len(rs["drivers"]),
            }
        )

    rows.sort(key=lambda x: -x["deliveries"])
    cost_vals = [r["total_cost_php"] for r in rows if r["total_cost_php"] > 0]
    with_hours = [r for r in rows if r["avg_delivery_hours"] is not None]
    fastest = min(with_hours, key=lambda x: x["avg_delivery_hours"]) if with_hours else None
    most_delayed = max(rows, key=lambda x: x["delayed_count"], default=None)
    most_expensive = max(rows, key=lambda x: x["total_cost_php"], default=None)

    return {
        "summary": {
            "route_count": len(rows),
            "most_used_route": rows[0]["route"] if rows else None,
            "fastest_route": fastest["route"] if fastest else None,
            "most_delayed_route": most_delayed["route"] if most_delayed and most_delayed["delayed_count"] else None,
            "most_expensive_route": most_expensive["route"] if most_expensive else None,
        },
        "statistics": compute_statistics(cost_vals, min_samples=1),
        "performance": rows[:15],
        "cost_comparison": sorted(rows, key=lambda x: -x["total_cost_php"])[:10],
        "drilldown": rows,
    }


def _verified_revenue_rows(ctx: dict, f: AnalyticsFilters) -> list[tuple[Payment, Booking, Trip | None]]:
    booking_map = {b.id: b for b in ctx["bookings"]}
    rows: list[tuple[Payment, Booking, Trip | None]] = []
    for pay in ctx["payments"]:
        booking = booking_map.get(pay.booking_id)
        trip = _primary_trip(ctx, pay.booking_id) if booking else None
        if _payment_in_filters(pay, booking, trip, f):
            rows.append((pay, booking, trip))
    return rows


def build_financial_analytics(ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    monthly_rev: dict[str, float] = defaultdict(float)
    monthly_exp: dict[str, float] = defaultdict(float)
    client_rev: dict[int, float] = defaultdict(float)
    route_profit: dict[str, float] = defaultdict(float)
    rev_values: list[float] = []

    revenue_rows = _verified_revenue_rows(ctx, f)
    undated_rev = 0.0
    for pay, booking, _trip in revenue_rows:
        amt = float(pay.amount or 0)
        month = _activity_month(pay.paid_at or pay.created_at)
        if month:
            monthly_rev[month] += amt
        else:
            undated_rev += amt
        rev_values.append(amt)
        client_rev[pay.customer_id] += amt
        rk = _route_key(booking.pickup_location, booking.dropoff_location)
        route_profit[rk] += amt

    expense_summary = build_expense_analytics(ctx, f)
    total_exp = 0.0
    if not expense_summary.get("empty"):
        total_exp = float(expense_summary["summary"]["total_operational_cost_php"])
        for row in expense_summary.get("monthly_totals") or []:
            monthly_exp[row["month"]] = float(row["total"])

    if not rev_values:
        return empty_module()

    total_rev = round(sum(rev_values), 2)
    total_exp = round(total_exp, 2)

    months = sorted(set(monthly_rev.keys()) | set(monthly_exp.keys()))[-12:]
    trend = []
    for m in months:
        rev = round(monthly_rev.get(m, 0), 2)
        exp = round(monthly_exp.get(m, 0), 2)
        trend.append({"month": m, "revenue_php": rev, "expense_php": exp, "profit_php": round(rev - exp, 2)})

    top_routes = sorted(route_profit.items(), key=lambda x: -x[1])[:5]

    customer_map = {c.id: c.full_name or c.email for c in ctx["customers"]}
    category_labels = {
        "fuel": "Fuel",
        "toll": "Toll",
        "maintenance": "Maintenance",
        "allowance": "Allowances",
        "driver_allowance": "Driver Allowances",
        "helper_allowance": "Helper Allowances",
    }
    drilldown: list[dict[str, Any]] = []
    for pay, booking, trip in revenue_rows:
        fuel_php = _trip_fuel(trip, ctx["fuel_by_trip"]) if trip else 0.0
        toll_php = _trip_toll(trip, ctx["toll_by_trip"]) if trip else 0.0
        expense_php = _trip_direct_cost(trip, ctx) if trip else 0.0
        amount_php = round(float(pay.amount or 0), 2)
        paid_at = pay.paid_at or pay.created_at
        month = _activity_month(paid_at)
        drilldown.append(
            {
                "record_type": "revenue",
                "category": "revenue",
                "month": month,
                "payment_id": pay.id,
                "booking_id": pay.booking_id,
                "trip_id": trip.id if trip else None,
                "date": paid_at.isoformat() if paid_at else None,
                "reference": pay.reference or None,
                "amount_php": amount_php,
                "revenue_php": amount_php,
                "expense_php": round(expense_php, 2),
                "fuel_php": round(float(fuel_php), 2),
                "toll_php": round(float(toll_php), 2),
                "profit_php": round(amount_php - expense_php, 2),
                "route": _route_key(booking.pickup_location, booking.dropoff_location),
                "client_name": customer_map.get(pay.customer_id),
                "customer": customer_map.get(pay.customer_id),
                "driver": trip.driver.full_name if trip and trip.driver else None,
                "truck": trip.truck.code if trip and trip.truck else None,
                "status": _status_str(booking.status),
                "paid_at": paid_at.isoformat() if paid_at else None,
            }
        )
    if not expense_summary.get("empty"):
        for rec in expense_summary.get("drilldown", {}).get("records") or []:
            expense_date = rec.get("expense_date")
            month = expense_date[:7] if expense_date else None
            drilldown.append(
                {
                    "record_type": "expense",
                    "category": rec.get("category"),
                    "category_label": category_labels.get(str(rec.get("category")), rec.get("category")),
                    "month": month,
                    "expense_date": expense_date,
                    "date": expense_date,
                    "amount_php": rec.get("amount_php"),
                    "revenue_php": rec.get("revenue_php"),
                    "expense_php": rec.get("amount_php"),
                    "fuel_php": rec.get("fuel_php"),
                    "toll_php": rec.get("toll_php"),
                    "profit_php": rec.get("profit_php"),
                    "source_type": rec.get("source_type"),
                    "trip_id": rec.get("trip_id"),
                    "booking_id": rec.get("booking_id"),
                    "customer": rec.get("customer"),
                    "route": rec.get("route"),
                    "driver": rec.get("driver"),
                    "truck": rec.get("truck_code"),
                    "status": rec.get("status"),
                    "truck_code": rec.get("truck_code"),
                    "label": rec.get("label"),
                }
            )

    return {
        "summary": {
            "total_revenue_php": total_rev,
            "total_expenses_php": total_exp,
            "undated_revenue_php": round(undated_rev, 2),
            "profit_estimate_php": round(total_rev - total_exp, 2),
            "most_profitable_route": top_routes[0][0] if top_routes else None,
        },
        "statistics": compute_statistics(rev_values, min_samples=1),
        "revenue_trend": trend,
        "revenue_vs_expense": trend,
        "profit_trend": [{"month": t["month"], "profit_php": t["profit_php"]} for t in trend],
        "category_summary": [
            {"category": "revenue", "label": "Revenue", "amount_php": total_rev},
            {"category": "expenses", "label": "Expenses", "amount_php": total_exp},
            {"category": "profit", "label": "Profit", "amount_php": round(total_rev - total_exp, 2)},
        ],
        "revenue_per_client": [
            {
                "customer_id": cid,
                "client_name": next(
                    (c.full_name or c.email for c in ctx["customers"] if c.id == cid),
                    f"Client #{cid}",
                ),
                "revenue_php": round(amt, 2),
            }
            for cid, amt in sorted(client_rev.items(), key=lambda x: -x[1])[:20]
        ],
        "drilldown": drilldown,
    }


def build_client_analytics(ctx: dict, f: AnalyticsFilters) -> dict[str, Any]:
    client_stats: dict[int, dict] = defaultdict(
        lambda: {"bookings": 0, "delivered": 0, "revenue": 0.0, "destinations": defaultdict(int)}
    )
    customer_map = {c.id: c.full_name or c.email for c in ctx["customers"]}

    for booking in ctx["bookings"]:
        trip = _primary_trip(ctx, booking.id)
        if not _booking_in_filters(booking, trip, f):
            continue
        cid = booking.customer_id
        cs = client_stats[cid]
        cs["bookings"] += 1
        dest = (booking.dropoff_location or "").strip() or "Unknown"
        cs["destinations"][dest] += 1
        if _status_str(booking.status) == BookingStatus.COMPLETED.value:
            cs["delivered"] += 1

    for pay, _booking, _trip in _verified_revenue_rows(ctx, f):
        client_stats[pay.customer_id]["revenue"] += float(pay.amount or 0)

    if not client_stats:
        return empty_module()

    rows = []
    for cid, cs in client_stats.items():
        top_dest = max(cs["destinations"].items(), key=lambda x: x[1], default=(None, 0))
        rows.append(
            {
                "customer_id": cid,
                "client_name": customer_map.get(cid, f"Client #{cid}"),
                "total_bookings": cs["bookings"],
                "deliveries": cs["delivered"],
                "revenue_php": round(cs["revenue"], 2),
                "top_destination": top_dest[0],
                "destination_count": len(cs["destinations"]),
            }
        )

    rows.sort(key=lambda x: -x["total_bookings"])

    return {
        "summary": {
            "active_clients": len(rows),
            "total_bookings": sum(r["total_bookings"] for r in rows),
            "total_revenue_php": round(sum(r["revenue_php"] for r in rows), 2),
        },
        "statistics": compute_statistics([float(r["total_bookings"]) for r in rows], min_samples=1),
        "booking_distribution": [
            {"client_name": r["client_name"], "bookings": r["total_bookings"]} for r in rows[:10]
        ],
        "revenue_contribution": [
            {"client_name": r["client_name"], "revenue_php": r["revenue_php"]}
            for r in sorted(rows, key=lambda x: -x["revenue_php"])[:10]
        ],
        "drilldown": rows,
    }


def build_admin_analytics(
    db: Session,
    *,
    filters: AnalyticsFilters,
    include_financial: bool = True,
    include_clients: bool = True,
    viewer: User | None = None,
) -> dict[str, Any]:
    ctx = _load_context(db)
    filter_options = {
        "drivers": [{"id": d.id, "name": d.full_name} for d in ctx["drivers"]],
        "trucks": [{"id": t.id, "code": t.code} for t in ctx["trucks"]],
        "clients": [{"id": c.id, "name": (c.full_name or c.email)} for c in ctx["customers"]],
        "routes": sorted({_route_key(b.pickup_location, b.dropoff_location) for b in ctx["bookings"]}),
        "shipment_statuses": ["delivered", "delayed", "cancelled", "in_transit", "pending"],
    }

    expenses = build_expense_analytics(ctx, filters)
    shipments = build_shipment_analytics(ctx, filters)
    fleet = build_fleet_analytics(ctx, filters)
    drivers = build_driver_analytics(ctx, filters)
    routes = build_route_analytics(ctx, filters)

    payload: dict[str, Any] = {
        "generated_at": datetime.utcnow().isoformat(),
        "filters_applied": {
            "date_from": filters.date_from.isoformat() if filters.date_from else None,
            "date_to": filters.date_to.isoformat() if filters.date_to else None,
            "driver_id": filters.driver_id,
            "truck_id": filters.truck_id,
            "route": filters.route,
            "shipment_status": filters.shipment_status,
        },
        "filter_options": filter_options,
        "shipments": shipments,
        "expenses": expenses,
        "fleet": fleet,
        "drivers": drivers,
        "routes": routes,
    }
    if include_financial:
        payload["financial"] = build_financial_analytics(ctx, filters)
    else:
        payload["financial"] = None
    if include_clients:
        payload["clients"] = build_client_analytics(ctx, filters)
    else:
        payload["clients"] = None

    if include_financial or include_clients:
        from app.services.manager_role_analytics import build_manager_role_analytics

        payload["role_analytics"] = build_manager_role_analytics(
            db,
            ctx,
            filters,
            shipments=shipments,
            expenses=expenses,
            fleet=fleet,
            drivers=drivers,
            routes=routes,
        )
    else:
        payload["role_analytics"] = None

    if not include_financial and not include_clients:
        from app.services.dispatcher_role_analytics import build_dispatcher_role_analytics

        try:
            payload["dispatcher_role_analytics"] = build_dispatcher_role_analytics(
                db,
                ctx,
                filters,
                viewer=viewer,
                shipments=shipments,
                fleet=fleet,
                drivers=drivers,
                routes=routes,
            )
        except Exception:
            logger.exception(
                "dispatcher_role_analytics build failed viewer_id=%s",
                getattr(viewer, "id", None),
            )
            payload["dispatcher_role_analytics"] = None
    else:
        payload["dispatcher_role_analytics"] = None

    payload["validation"] = validate_admin_analytics(payload)

    from app.services.executive_analytics import (
        build_comparative_analytics,
        build_executive_overview,
        build_section_percentages,
    )
    from app.services.toll_analytics import build_toll_analytics

    payload["executive_overview"] = build_executive_overview(
        ctx,
        filters,
        shipments=shipments,
        expenses=expenses,
        fleet=fleet,
        financial=payload.get("financial"),
    )
    payload["comparative_analytics"] = build_comparative_analytics(ctx, filters)
    payload["section_percentages"] = {
        "shipments": build_section_percentages(shipments, "shipments"),
        "expenses": build_section_percentages(expenses, "expenses"),
        "financial": build_section_percentages(payload["financial"], "financial") if payload.get("financial") else None,
    }
    payload["toll_analytics"] = build_toll_analytics(db)
    return payload
