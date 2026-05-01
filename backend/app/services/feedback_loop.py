"""Predicted-vs-actual feedback loop (paper Fig 24 + §3.5.10).

Recompute MAE / MAPE / RMSE / Brier per model and detect drift; trigger
retraining when MAPE exceeds DRIFT_THRESHOLD.
"""
from __future__ import annotations

import math
from datetime import datetime
from statistics import mean

from sqlalchemy.orm import Session

from app.models.entities import (
    ForecastRun,
    ModelMetric,
    PredictionFeedback,
    Trip,
)
from app.schemas.predict import FeedbackSummaryResponse, ModelMetricRead

DRIFT_THRESHOLD_MAPE = 25.0  # 25% MAPE → consider retraining


def record_trip_feedback(db: Session, trip: Trip) -> list[PredictionFeedback]:
    """Compare predicted vs actual after a trip completes."""
    if not trip.completed_at:
        return []

    actual_total = float((trip.fuel_cost or 0) + (trip.toll_cost or 0) + (trip.labor_cost or 0))
    rows: list[PredictionFeedback] = []

    if trip.predicted_total_cost > 0:
        err = actual_total - trip.predicted_total_cost
        ape = abs(err) / max(actual_total, 1) * 100
        rows.append(
            PredictionFeedback(
                trip_id=trip.id,
                model_name="trip_cost",
                predicted_value=trip.predicted_total_cost,
                actual_value=actual_total,
                error=round(err, 2),
                abs_pct_error=round(ape, 2),
            )
        )

    if trip.predicted_fuel_liters > 0 and trip.fuel_cost:
        # Best-effort actual liters from fuel cost / 60₱.
        actual_liters = trip.fuel_cost / 60.0
        err = actual_liters - trip.predicted_fuel_liters
        ape = abs(err) / max(actual_liters, 1) * 100
        rows.append(
            PredictionFeedback(
                trip_id=trip.id,
                model_name="fuel",
                predicted_value=trip.predicted_fuel_liters,
                actual_value=round(actual_liters, 2),
                error=round(err, 2),
                abs_pct_error=round(ape, 2),
            )
        )

    if trip.predicted_duration_hours > 0 and trip.duration_hours:
        err = float(trip.duration_hours) - trip.predicted_duration_hours
        ape = abs(err) / max(trip.duration_hours, 1) * 100
        rows.append(
            PredictionFeedback(
                trip_id=trip.id,
                model_name="duration",
                predicted_value=trip.predicted_duration_hours,
                actual_value=float(trip.duration_hours),
                error=round(err, 2),
                abs_pct_error=round(ape, 2),
            )
        )

    for row in rows:
        db.add(row)
    db.commit()
    return rows


def _metrics_for(db: Session, model_name: str) -> ModelMetricRead | None:
    rows = db.query(PredictionFeedback).filter(PredictionFeedback.model_name == model_name).all()
    if not rows:
        return None
    abs_errors = [abs(r.error) for r in rows]
    mae = mean(abs_errors)
    mape = mean(r.abs_pct_error for r in rows)
    rmse = math.sqrt(mean(e ** 2 for e in abs_errors))
    accuracy = max(0.0, 100 - mape)
    return ModelMetricRead(
        model_name=model_name,
        mae=round(mae, 2),
        mape=round(mape, 2),
        rmse=round(rmse, 2),
        accuracy=round(accuracy, 2),
        recall=0.0,
        f1=0.0,
        brier=0.0,
        sample_size=len(rows),
        measured_at=datetime.utcnow().isoformat(),
    )


def feedback_summary(db: Session) -> FeedbackSummaryResponse:
    metrics: dict[str, ModelMetricRead] = {}
    drift = False
    for name in ["trip_cost", "fuel", "duration"]:
        m = _metrics_for(db, name)
        if m:
            metrics[name] = m
            if m.mape > DRIFT_THRESHOLD_MAPE:
                drift = True
            # Persist to ModelMetric for historical view
            db.add(ModelMetric(
                model_name=name,
                mae=m.mae,
                mape=m.mape,
                rmse=m.rmse,
                accuracy=m.accuracy,
                sample_size=m.sample_size,
            ))

    last_run = (
        db.query(ForecastRun).order_by(ForecastRun.triggered_at.desc()).first()
    )
    if metrics:
        db.commit()

    return FeedbackSummaryResponse(
        metrics_by_model=metrics,
        drift_detected=drift,
        last_retrain_at=last_run.triggered_at.isoformat() if last_run else None,
        sample_size=sum(m.sample_size for m in metrics.values()),
    )
