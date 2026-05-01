"""Monthly cost / demand forecasting (paper §3.2.8 — time series)."""
from __future__ import annotations

import pandas as pd
from sqlalchemy.orm import Session
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from app.models.entities import Trip
from app.schemas.predict import MonthlyForecastPoint, MonthlyForecastResponse


def forecast_monthly_cost(db: Session, periods: int = 6) -> MonthlyForecastResponse:
    trips = db.query(Trip).filter(Trip.completed_at.isnot(None)).all()

    if len(trips) >= 12:
        frame = pd.DataFrame(
            [
                {
                    "month": pd.Timestamp(t.completed_at).to_period("M"),
                    "total": float((t.fuel_cost or 0) + (t.toll_cost or 0) + (t.labor_cost or 0)),
                }
                for t in trips
                if t.completed_at
            ]
        )
        series = frame.groupby("month")["total"].sum().sort_index()
    else:
        # Synthetic seed so the chart still renders for new installs.
        base = [12000 + (i % 4) * 1500 for i in range(12)]
        series = pd.Series(base)

    try:
        model = ExponentialSmoothing(series.values, trend="add").fit()
        prediction = model.forecast(periods)
    except Exception:
        # Fallback: rolling mean
        avg = series.tail(3).mean() if not series.empty else 0
        prediction = [avg] * periods

    period_labels = pd.period_range(
        start=pd.Timestamp.utcnow().to_period("M") + 1,
        periods=periods,
        freq="M",
    )

    points = [
        MonthlyForecastPoint(period=str(period_labels[i].strftime("%Y-%m")), value=float(round(v, 2)))
        for i, v in enumerate(prediction)
    ]

    return MonthlyForecastResponse(horizon_months=periods, points=points)
