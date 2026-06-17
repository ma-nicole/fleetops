"""Customer role analytics — four pillars from customer-owned records only."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import BookingStatus, PaymentStatus, User
from app.services.admin_analytics import (
    AnalyticsFilters,
    _activity_date,
    _booking_in_filters,
    _load_context,
    _primary_trip,
    _route_key,
    _shipment_category,
)
from app.services.manager_role_analytics import _block, _empty, _empty_predict, _forecast_series, _monthly_series


def _customer_bookings(ctx: dict, f: AnalyticsFilters, customer_id: int) -> list:
    rows = []
    for booking in ctx["bookings"]:
        if booking.customer_id != customer_id:
            continue
        trip = _primary_trip(ctx, booking.id)
        if _booking_in_filters(booking, trip, f):
            rows.append(booking)
    return rows


def build_customer_role_analytics(
    db: Session,
    f: AnalyticsFilters,
    *,
    customer: User,
) -> dict[str, Any]:
    ctx = _load_context(db)
    bookings = _customer_bookings(ctx, f, customer.id)
    booking_ids = {b.id for b in bookings}
    trips_by_booking = {bid: _primary_trip(ctx, bid) for bid in booking_ids}

    verified_payments = [
        p for p in ctx["payments"] if p.customer_id == customer.id and p.booking_id in booking_ids and p.status == PaymentStatus.VERIFIED
    ]
    all_payments = [p for p in ctx["payments"] if p.customer_id == customer.id and p.booking_id in booking_ids]

    # 1) Account Management
    account_rows = []
    for b in bookings:
        trip = trips_by_booking.get(b.id)
        account_rows.append(
            {
                "booking_id": b.id,
                "trip_id": trip.id if trip else None,
                "date": b.created_at.date().isoformat() if b.created_at else "—",
                "route": _route_key(b.pickup_location, b.dropoff_location),
                "status": str(b.status.value if hasattr(b.status, "value") else b.status),
            }
        )
    account_rows.sort(key=lambda r: r["date"], reverse=True)
    account_desc_activity = (
        _empty("No data available yet.")
        if not account_rows
        else _block(
            kpis=[
                {"label": "Total bookings", "value": len(account_rows)},
                {"label": "Completed", "value": sum(1 for b in bookings if str(b.status.value if hasattr(b.status, "value") else b.status) == BookingStatus.COMPLETED.value)},
            ],
            chart=[],
            drilldown=account_rows[:50],
        )
    )

    payment_rows = []
    for p in sorted(all_payments, key=lambda x: x.created_at or datetime.min, reverse=True):
        payment_rows.append(
            {
                "payment_id": p.id,
                "booking_id": p.booking_id,
                "date": (p.paid_at or p.created_at).date().isoformat() if (p.paid_at or p.created_at) else "—",
                "amount_php": round(float(p.amount or 0), 2),
                "status": str(p.status.value if hasattr(p.status, "value") else p.status),
                "reference": p.reference or "—",
            }
        )
    account_desc_payments = (
        _empty("No data available yet.")
        if not payment_rows
        else _block(
            kpis=[
                {"label": "Payment records", "value": len(payment_rows)},
                {"label": "Verified", "value": sum(1 for p in payment_rows if p["status"] == PaymentStatus.VERIFIED.value)},
            ],
            chart=[],
            drilldown=payment_rows[:50],
        )
    )

    profile_rows = [
        {
            "customer_id": customer.id,
            "name": customer.full_name,
            "email": customer.email,
            "company": customer.company_name or "—",
            "status": "active",
        }
    ]
    account_desc_profile = _block(
        kpis=[
            {"label": "Customer profile", "value": "Available"},
            {"label": "Account status", "value": "Active"},
        ],
        chart=[],
        drilldown=profile_rows,
    )

    monthly_bookings: dict[str, int] = defaultdict(int)
    for b in bookings:
        d = _activity_date(b.created_at)
        if d:
            monthly_bookings[d.strftime("%Y-%m")] += 1
    booking_series = _monthly_series([(m, float(c)) for m, c in sorted(monthly_bookings.items())], min_points=2)
    booking_forecast = _forecast_series(booking_series, 3) if booking_series is not None else None
    account_pred_activity = (
        _empty_predict()
        if not booking_forecast
        else _block(
            kpis=[{"label": "Next period bookings (est.)", "value": booking_forecast[0]["value"]}],
            chart=[{"period": p["period"], "forecast_bookings": p["value"]} for p in booking_forecast],
            drilldown=account_rows[:20],
        )
    )

    payment_rate = round((len(verified_payments) / len(all_payments)) * 100, 1) if all_payments else None
    account_pred_payment = (
        _empty_predict()
        if payment_rate is None
        else _block(
            kpis=[{"label": "Verified payment rate %", "value": payment_rate}],
            chart=[],
            drilldown=payment_rows[:30],
            note="Estimated from your historical payment verification outcomes.",
        )
    )

    # 2) Service Selection
    route_counts: dict[str, int] = defaultdict(int)
    estimate_rows = []
    for b in bookings:
        rk = _route_key(b.pickup_location, b.dropoff_location)
        route_counts[rk] += 1
        estimate_rows.append(
            {
                "booking_id": b.id,
                "route": rk,
                "date": b.created_at.date().isoformat() if b.created_at else "—",
                "estimated_cost_php": round(float(b.estimated_cost or 0), 2),
                "status": str(b.status.value if hasattr(b.status, "value") else b.status),
            }
        )
    route_rows = [{"route": r, "count": c} for r, c in sorted(route_counts.items(), key=lambda x: -x[1])]
    service_desc_preferences = (
        _empty("No data available yet.")
        if not route_rows
        else _block(
            kpis=[{"label": "Routes used", "value": len(route_rows)}],
            chart=route_rows[:12],
            drilldown=estimate_rows[:50],
        )
    )
    service_desc_estimates = (
        _empty("No data available yet.")
        if not estimate_rows
        else _block(
            kpis=[
                {"label": "Cost estimate records", "value": len(estimate_rows)},
                {"label": "Avg estimate (₱)", "value": round(sum(float(r["estimated_cost_php"]) for r in estimate_rows) / len(estimate_rows), 2)},
            ],
            chart=estimate_rows[:12],
            drilldown=estimate_rows[:50],
        )
    )
    service_desc_routes = service_desc_preferences

    service_pred_route = (
        _empty_predict()
        if not route_rows
        else _block(
            kpis=[{"label": "Likely next route", "value": route_rows[0]["route"]}],
            chart=route_rows[:12],
            drilldown=estimate_rows[:30],
            note="Most frequently booked route in your history.",
        )
    )
    service_pred_budget = (
        _empty_predict()
        if len(estimate_rows) < 2
        else _block(
            kpis=[
                {"label": "Latest estimate (₱)", "value": estimate_rows[0]["estimated_cost_php"]},
                {"label": "Typical estimate (₱)", "value": round(sum(float(r["estimated_cost_php"]) for r in estimate_rows) / len(estimate_rows), 2)},
            ],
            chart=estimate_rows[:12],
            drilldown=estimate_rows[:30],
            note="Historical estimate trend for planning future bookings.",
        )
    )

    # 3) Booking Management
    status_counts: dict[str, int] = defaultdict(int)
    booking_rows = []
    cancelled_rows = []
    for b in bookings:
        trip = trips_by_booking.get(b.id)
        label = _shipment_category(b, trip, ctx["delay_logs"])
        status_counts[label] += 1
        row = {
            "booking_id": b.id,
            "trip_id": trip.id if trip else None,
            "date": b.created_at.date().isoformat() if b.created_at else "—",
            "route": _route_key(b.pickup_location, b.dropoff_location),
            "status": label,
        }
        booking_rows.append(row)
        if label == "cancelled":
            cancelled_rows.append(row)
    booking_rows.sort(key=lambda r: r["date"], reverse=True)
    booking_desc_status = (
        _empty("No data available yet.")
        if not booking_rows
        else _block(
            kpis=[{"label": "Bookings tracked", "value": len(booking_rows)}],
            chart=[{"status": k, "count": v} for k, v in sorted(status_counts.items(), key=lambda x: -x[1])],
            drilldown=booking_rows[:50],
        )
    )
    booking_desc_payments = account_desc_payments
    booking_desc_cancellations = (
        _empty("No data available yet.")
        if not cancelled_rows
        else _block(
            kpis=[{"label": "Cancelled bookings", "value": len(cancelled_rows)}],
            chart=[],
            drilldown=cancelled_rows[:50],
        )
    )

    completion_rate = round((status_counts.get("delivered", 0) / len(booking_rows)) * 100, 1) if booking_rows else None
    booking_pred_completion = (
        _empty_predict()
        if completion_rate is None
        else _block(
            kpis=[{"label": "Historical completion rate %", "value": completion_rate}],
            chart=[{"status": "delivered", "count": status_counts.get("delivered", 0)}, {"status": "others", "count": len(booking_rows) - status_counts.get("delivered", 0)}],
            drilldown=booking_rows[:30],
        )
    )
    cancellation_rate = round((len(cancelled_rows) / len(booking_rows)) * 100, 1) if booking_rows else None
    booking_pred_cancellation = (
        _empty_predict()
        if cancellation_rate is None
        else _block(
            kpis=[{"label": "Historical cancellation rate %", "value": cancellation_rate}],
            chart=[],
            drilldown=cancelled_rows[:30] if cancelled_rows else booking_rows[:10],
        )
    )

    # 4) Shipment Tracking
    shipment_rows = []
    delivery_hours: list[float] = []
    for b in bookings:
        trip = trips_by_booking.get(b.id)
        label = _shipment_category(b, trip, ctx["delay_logs"])
        hours = None
        if trip and trip.departure_time and trip.completed_at:
            hours = max(0.0, (trip.completed_at - trip.departure_time).total_seconds() / 3600)
            delivery_hours.append(hours)
        shipment_rows.append(
            {
                "booking_id": b.id,
                "trip_id": trip.id if trip else None,
                "route": _route_key(b.pickup_location, b.dropoff_location),
                "date": b.scheduled_date.isoformat() if b.scheduled_date else "—",
                "delivery_hours": round(hours, 2) if hours is not None else None,
                "status": label,
                "delay_reason": (ctx["delay_logs"].get(trip.id) if trip else None) or "—",
            }
        )
    shipment_rows.sort(key=lambda r: r["date"], reverse=True)
    track_desc_timeline = (
        _empty("No data available yet.")
        if not shipment_rows
        else _block(
            kpis=[{"label": "Tracked shipments", "value": len(shipment_rows)}],
            chart=[{"status": k, "count": v} for k, v in sorted(status_counts.items(), key=lambda x: -x[1])],
            drilldown=shipment_rows[:50],
        )
    )
    track_desc_performance = (
        _empty("Insufficient data.")
        if not delivery_hours
        else _block(
            kpis=[
                {"label": "Completed with time logs", "value": len(delivery_hours)},
                {"label": "Avg delivery hours", "value": round(sum(delivery_hours) / len(delivery_hours), 2)},
            ],
            chart=[{"index": i + 1, "hours": round(v, 2)} for i, v in enumerate(delivery_hours[:12])],
            drilldown=shipment_rows[:50],
        )
    )
    track_desc_updates = (
        _empty("No data available yet.")
        if not shipment_rows
        else _block(
            kpis=[{"label": "Status updates", "value": len(shipment_rows)}],
            chart=[],
            drilldown=shipment_rows[:50],
        )
    )

    delay_rows = [r for r in shipment_rows if r["status"] == "delayed"]
    track_pred_delay = (
        _empty_predict()
        if not shipment_rows
        else _block(
            kpis=[{"label": "Historical delay rate %", "value": round((len(delay_rows) / len(shipment_rows)) * 100, 1)}],
            chart=[{"status": "delayed", "count": len(delay_rows)}, {"status": "non_delayed", "count": len(shipment_rows) - len(delay_rows)}],
            drilldown=delay_rows[:30] if delay_rows else shipment_rows[:10],
        )
    )
    track_pred_eta = (
        _empty_predict()
        if len(delivery_hours) < 2
        else _block(
            kpis=[{"label": "Expected delivery hours", "value": round(sum(delivery_hours) / len(delivery_hours), 2)}],
            chart=[{"sample": i + 1, "hours": round(v, 2)} for i, v in enumerate(delivery_hours[:12])],
            drilldown=shipment_rows[:30],
            note="Estimate from historical completed-trip durations.",
        )
    )

    return {
        "account_management": {
            "descriptive": {
                "account_activity": account_desc_activity,
                "payment_profile": account_desc_payments,
                "profile_summary": account_desc_profile,
            },
            "predictive": {
                "booking_activity_forecast": account_pred_activity,
                "payment_success_trend": account_pred_payment,
            },
        },
        "service_selection": {
            "descriptive": {
                "service_preferences": service_desc_preferences,
                "cost_estimate_history": service_desc_estimates,
                "route_interest": service_desc_routes,
            },
            "predictive": {
                "service_recommendation": service_pred_route,
                "budget_projection": service_pred_budget,
            },
        },
        "booking_management": {
            "descriptive": {
                "booking_status_overview": booking_desc_status,
                "payment_history": booking_desc_payments,
                "cancellation_records": booking_desc_cancellations,
            },
            "predictive": {
                "booking_completion_forecast": booking_pred_completion,
                "cancellation_risk": booking_pred_cancellation,
            },
        },
        "shipment_tracking": {
            "descriptive": {
                "shipment_status_timeline": track_desc_timeline,
                "delivery_performance": track_desc_performance,
                "tracking_updates": track_desc_updates,
            },
            "predictive": {
                "delay_likelihood": track_pred_delay,
                "eta_projection": track_pred_eta,
            },
        },
    }
