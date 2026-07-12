"""Auditable time-series forecasts for the four thesis analytics areas."""
from __future__ import annotations

from datetime import date, datetime
from statistics import mean, pstdev

import pandas as pd
from sqlalchemy.orm import Session
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from app.models.entities import Booking, FuelLog, MaintenanceRecord, Trip
from app.schemas.predict import (
    ForecastStatistics,
    MonthlyForecastPoint,
    OperationalForecastResponse,
    OperationalForecastSeries,
)


PERIOD_FREQ = {
    "daily": "D",
    "weekly": "W-SUN",
    "monthly": "M",
    "quarterly": "Q",
    "yearly": "Y",
}


def _in_range(value: datetime | date | None, date_from: date | None, date_to: date | None) -> bool:
    if value is None:
        return False
    current = value.date() if isinstance(value, datetime) else value
    return (date_from is None or current >= date_from) and (date_to is None or current <= date_to)


def _aggregate(
    observations: list[tuple[datetime | date, float]],
    granularity: str,
) -> pd.Series:
    if not observations:
        return pd.Series(dtype=float)
    frame = pd.DataFrame(observations, columns=["date", "value"])
    frame["date"] = pd.to_datetime(frame["date"])
    frame["period"] = frame["date"].dt.to_period(PERIOD_FREQ[granularity])
    grouped = frame.groupby("period")["value"].sum().sort_index()
    if grouped.empty:
        return grouped
    full_index = pd.period_range(grouped.index.min(), grouped.index.max(), freq=PERIOD_FREQ[granularity])
    return grouped.reindex(full_index, fill_value=0.0)


def _forecast_values(series: pd.Series, horizon: int) -> tuple[list[float], str]:
    values = [float(v) for v in series.tolist()]
    if not values:
        return [], "Unavailable — no historical records match the filters"
    if len(values) >= 4 and len(set(round(v, 6) for v in values)) > 1:
        try:
            fitted = ExponentialSmoothing(values, trend="add", initialization_method="estimated").fit(optimized=True)
            predicted = [max(0.0, float(v)) for v in fitted.forecast(horizon)]
            return predicted, "Holt-Winters exponential smoothing with additive trend"
        except Exception:
            pass
    window = values[-min(3, len(values)):]
    return [max(0.0, mean(window))] * horizon, "Three-period moving average fallback (limited history)"


def _statistics(values: list[float]) -> ForecastStatistics | None:
    if not values:
        return None
    return ForecastStatistics(
        minimum=round(min(values), 2),
        maximum=round(max(values), 2),
        average=round(mean(values), 2),
        total=round(sum(values), 2),
        standard_deviation=round(pstdev(values), 2) if len(values) > 1 else None,
        count=len(values),
    )


def _narrative(title: str, unit: str, history: list[float], forecast: list[float]) -> tuple[str, str]:
    if not history or not forecast:
        return (
            f"{title} cannot be forecast reliably because no historical records match the selected filters.",
            "Capture and complete operational records consistently before making a planning decision from this panel.",
        )
    recent = mean(history[-min(3, len(history)):])
    expected = mean(forecast)
    change = ((expected - recent) / abs(recent) * 100.0) if recent else None
    direction = "increase" if change is not None and change > 1 else "decrease" if change is not None and change < -1 else "remain stable"
    detail = f" by {abs(change):.1f}%" if change is not None and abs(change) > 1 else ""
    interpretation = f"{title} is expected to {direction}{detail} over the forecast horizon (average {expected:.2f} {unit} per period)."
    recommendations = {
        "Booking Demand": "Align truck, driver, and helper availability with the forecast; verify capacity before accepting peak-period bookings.",
        "Fuel Usage": "Review fuel purchasing and route-efficiency controls for the forecast period, prioritizing routes with high liters per delivery.",
        "Fleet Maintenance": "Reserve workshop capacity and parts inventory for the forecast event volume, while prioritizing high-risk vehicles.",
        "Delivery Trends": "Adjust dispatch coverage to the projected delivery volume and investigate delays if deliveries do not track demand.",
    }
    return interpretation, recommendations[title]


def _series_payload(
    *,
    key: str,
    title: str,
    unit: str,
    chart_type: str,
    observations: list[tuple[datetime | date, float]],
    granularity: str,
    horizon: int,
) -> OperationalForecastSeries:
    series = _aggregate(observations, granularity)
    forecast_values, method = _forecast_values(series, horizon)
    historical = [MonthlyForecastPoint(period=str(period), value=round(float(value), 2)) for period, value in series.items()]
    if len(series.index):
        future_periods = pd.period_range(series.index[-1] + 1, periods=horizon, freq=PERIOD_FREQ[granularity])
    else:
        future_periods = []
    forecast = [
        MonthlyForecastPoint(period=str(period), value=round(float(value), 2))
        for period, value in zip(future_periods, forecast_values)
    ]
    history_values = [point.value for point in historical]
    interpretation, recommendation = _narrative(title, unit, history_values, forecast_values)
    return OperationalForecastSeries(
        key=key,
        title=title,
        unit=unit,
        chart_type=chart_type,
        historical=historical,
        forecast=forecast,
        method=method,
        interpretation=interpretation,
        recommendation=recommendation,
        statistics=_statistics(history_values),
    )


def forecast_operations(
    db: Session,
    *,
    granularity: str = "monthly",
    horizon: int = 3,
    date_from: date | None = None,
    date_to: date | None = None,
) -> OperationalForecastResponse:
    bookings = [
        (row.created_at, 1.0)
        for row in db.query(Booking).all()
        if _in_range(row.created_at, date_from, date_to)
    ]
    fuel = [
        (row.recorded_at, float(row.liters or 0))
        for row in db.query(FuelLog).all()
        if _in_range(row.recorded_at, date_from, date_to)
    ]
    maintenance = [
        (row.created_at, 1.0)
        for row in db.query(MaintenanceRecord).all()
        if _in_range(row.created_at, date_from, date_to)
    ]
    deliveries = [
        (row.completed_at, 1.0)
        for row in db.query(Trip).filter(Trip.completed_at.isnot(None)).all()
        if _in_range(row.completed_at, date_from, date_to)
    ]
    return OperationalForecastResponse(
        granularity=granularity,
        horizon=horizon,
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
        series=[
            _series_payload(key="booking_demand", title="Booking Demand", unit="bookings", chart_type="line", observations=bookings, granularity=granularity, horizon=horizon),
            _series_payload(key="fuel_usage", title="Fuel Usage", unit="liters", chart_type="area", observations=fuel, granularity=granularity, horizon=horizon),
            _series_payload(key="fleet_maintenance", title="Fleet Maintenance", unit="events", chart_type="bar", observations=maintenance, granularity=granularity, horizon=horizon),
            _series_payload(key="delivery_trends", title="Delivery Trends", unit="deliveries", chart_type="line", observations=deliveries, granularity=granularity, horizon=horizon),
        ],
    )
