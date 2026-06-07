"""Toll analytics from historical toll records and live trip data."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import HistoricalTollRecord
from app.services.analytics_stats import compute_statistics, empty_module


def build_toll_analytics(db: Session) -> dict[str, Any]:
    rows = db.query(HistoricalTollRecord).order_by(HistoricalTollRecord.completed_at.desc()).all()
    if not rows:
        return empty_module("No historical toll records yet.")

    estimated_total = round(sum(float(r.estimated_toll or 0) for r in rows), 2)
    actual_total = round(sum(float(r.actual_toll or 0) for r in rows), 2)
    variance_total = round(actual_total - estimated_total, 2)

    actual_values = [float(r.actual_toll or 0) for r in rows]
    record_count = len(rows)
    stats = compute_statistics(actual_values, min_samples=1)

    data_messages: list[str] = []
    if record_count == 1:
        data_messages.append(
            "Limited data available. Statistics may not represent long-term trends."
        )
    elif record_count < 3:
        data_messages.append(
            f"Only {record_count} completed trips on record. Trends may shift as more data is collected."
        )
    if stats and stats.get("insufficient_for_spread"):
        data_messages.append("Standard deviation requires at least two completed trips.")

    route_totals: dict[str, float] = defaultdict(float)
    monthly: dict[str, dict[str, float]] = defaultdict(lambda: {"estimated": 0.0, "actual": 0.0, "count": 0})

    for rec in rows:
        key = rec.route_label or (
            f"{rec.entry_point} → {rec.exit_point}"
            if rec.entry_point and rec.exit_point
            else f"{rec.origin} → {rec.destination}"
        )
        route_totals[key] += float(rec.actual_toll or 0)
        month = rec.completed_at.strftime("%Y-%m") if rec.completed_at else "unknown"
        monthly[month]["estimated"] += float(rec.estimated_toll or 0)
        monthly[month]["actual"] += float(rec.actual_toll or 0)
        monthly[month]["count"] += 1

    most_expensive = sorted(
        [{"route": k, "actual_toll_php": round(v, 2)} for k, v in route_totals.items()],
        key=lambda x: -x["actual_toll_php"],
    )[:10]

    trend = []
    for month in sorted(monthly.keys())[-12:]:
        m = monthly[month]
        trend.append(
            {
                "month": month,
                "estimated_toll_php": round(m["estimated"], 2),
                "actual_toll_php": round(m["actual"], 2),
                "variance_php": round(m["actual"] - m["estimated"], 2),
                "trip_count": int(m["count"]),
            }
        )

    return {
        "summary": {
            "record_count": record_count,
            "estimated_toll_total_php": estimated_total,
            "actual_toll_total_php": actual_total,
            "toll_variance_total_php": variance_total,
        },
        "data_sufficiency": {
            "limited_data": record_count < 3,
            "single_record": record_count == 1,
            "messages": data_messages,
        },
        "statistics": stats,
        "most_expensive_routes": most_expensive,
        "route_trends": trend,
        "drilldown": [
            {
                "trip_id": r.trip_id,
                "booking_id": r.booking_id,
                "route": r.route_label,
                "entry_point": r.entry_point,
                "exit_point": r.exit_point,
                "vehicle_class": r.vehicle_class,
                "effective_date": r.effective_date.isoformat() if r.effective_date else None,
                "estimated_toll": round(float(r.estimated_toll or 0), 2),
                "actual_toll": round(float(r.actual_toll or 0), 2),
                "variance": round(float(r.toll_variance or 0), 2),
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in rows[:100]
        ],
    }
