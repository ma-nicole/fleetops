"""Driver pay summary from completed trips and bookings (no mock payroll rows)."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime
from typing import Any

from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from app.constants.driver_pay import DRIVER_SHARE_OF_CARGO_GROSS, CARGO_GROSS_PHP_PER_TON, driver_pay_from_cargo_tons
from app.models.entities import Booking, BookingStatus, Trip, TripStatus

_EXCLUDED_BOOKING: tuple[BookingStatus, ...] = (
    BookingStatus.CANCELLED,
    BookingStatus.REJECTED,
    BookingStatus.PAYMENT_REJECTED,
)

_MONTH_NAMES = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)


def _period_label(period_start: date, period_end: date) -> str:
    if period_start.year == period_end.year and period_start.month == period_end.month:
        mname = _MONTH_NAMES[period_start.month - 1]
        return f"{mname} 1–{period_end.day}, {period_start.year}"
    return f"{period_start.isoformat()} – {period_end.isoformat()}"


def _effective_completed_expr():
    return func.coalesce(Trip.completed_at, Trip.updated_at)


def build_driver_pay_summary(
    db: Session,
    *,
    driver_user_id: int,
    today: date,
    history_limit: int = 100,
) -> dict[str, Any]:
    """Summarize pay for the current calendar month (UTC) plus recent completed trip rows."""
    period_start = date(today.year, today.month, 1)
    last_d = monthrange(today.year, today.month)[1]
    period_end = date(today.year, today.month, last_d)
    period_start_dt = datetime(period_start.year, period_start.month, period_start.day)
    period_end_dt = datetime(period_end.year, period_end.month, period_end.day, 23, 59, 59)

    base_q = (
        db.query(Trip)
        .options(joinedload(Trip.booking))
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(
            Trip.driver_id == driver_user_id,
            Trip.status == TripStatus.COMPLETED,
            ~Booking.status.in_(_EXCLUDED_BOOKING),
        )
    )

    month_trips = (
        base_q.filter(
            and_(
                _effective_completed_expr() >= period_start_dt,
                _effective_completed_expr() <= period_end_dt,
            )
        )
        .order_by(_effective_completed_expr().desc())
        .all()
    )

    trips_completed = len(month_trips)
    total_distance_km = round(sum(float(t.distance_km or 0) for t in month_trips), 1)
    base_earnings = round(sum(driver_pay_from_cargo_tons(t.booking.cargo_weight_tons if t.booking else 0) for t in month_trips), 2)
    bonus = 0.0
    deductions = 0.0
    current_total = round(max(0.0, base_earnings + bonus - deductions), 2)

    history_trips = (
        base_q.order_by(_effective_completed_expr().desc()).limit(history_limit).all()
    )

    payment_history: list[dict[str, Any]] = []
    for t in history_trips:
        bk = t.booking
        eff = t.completed_at or t.updated_at
        tons = float(bk.cargo_weight_tons) if bk else 0.0
        dpay = driver_pay_from_cargo_tons(tons)
        pickup = (bk.pickup_location or "").strip() if bk else ""
        drop = (bk.dropoff_location or "").strip() if bk else ""
        route_label = "—"
        if pickup or drop:
            route_label = f"{pickup} → {drop}" if pickup and drop else (pickup or drop)

        payment_history.append(
            {
                "trip_id": t.id,
                "booking_id": t.booking_id,
                "completed_at": eff.isoformat() if eff else None,
                "period_label": eff.strftime("%b %d, %Y") if eff else "—",
                "route_label": route_label,
                "cargo_weight_tons": tons,
                "distance_km": round(float(t.distance_km or 0), 2),
                "driver_pay": dpay,
                "bonus": 0.0,
                "deduction": 0.0,
                "total_pay": dpay,
                "status": "pending_payroll",
            }
        )

    return {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "period_label": _period_label(period_start, period_end),
        "trips_completed": trips_completed,
        "total_distance_km": total_distance_km,
        "base_earnings": base_earnings,
        "bonus": bonus,
        "deductions": deductions,
        "current_total": current_total,
        "driver_share_formula": {
            "description": f"{int(DRIVER_SHARE_OF_CARGO_GROSS * 100)}% of cargo gross (cargo tons × ₱{int(CARGO_GROSS_PHP_PER_TON)} per ton), summed per completed trip",
            "cargo_gross_php_per_ton": CARGO_GROSS_PHP_PER_TON,
            "driver_share_rate": DRIVER_SHARE_OF_CARGO_GROSS,
        },
        "payroll_note": "Driver payroll settlement is not recorded in the database yet; amounts are accrued estimates from completed trips only.",
        "payment_history": payment_history,
    }
