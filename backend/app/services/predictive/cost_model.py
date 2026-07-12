"""Regression-backed operational cost prediction.

The estimator keeps the existing deterministic formulas as a safe fallback,
then fits independent linear regressions for fuel, toll, driver, helper, and
total operational cost when at least five usable historical trips exist.
Only trip characteristics are used as features; cost components are never
used as predictors for the total, avoiding target leakage in the R² score.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sqlalchemy.orm import Session

from app.models.entities import FuelLog, TollLog, Trip, Truck
from app.schemas.predict import (
    CostRegressionSummary,
    CostRegressionTarget,
    FuelPredictRequest,
    MaintenancePredictRequest,
    TripCostPredictRequest,
    TripCostPredictResponse,
)
from app.services.predictive.fuel_model import predict_fuel_consumption
from app.services.predictive.maintenance_model import predict_maintenance


MIN_REGRESSION_SAMPLES = 5
FEATURES = ["distance_km", "duration_hours", "cargo_weight_tons"]
TARGETS = {
    "fuel_cost": "Fuel Cost",
    "toll_cost": "Toll Cost",
    "driver_cost": "Driver Cost",
    "helper_cost": "Helper Cost",
    "total_operational_cost": "Total Operational Cost",
}


@dataclass
class _RegressionBundle:
    frame: pd.DataFrame
    models: dict[str, LinearRegression]
    scores: dict[str, float | None]


def _vehicle_specs(db: Session, vehicle_id: int | None) -> tuple[float, float, float, float]:
    """Return (efficiency_kmpl, capacity_tons, age_years, odometer_km)."""
    if vehicle_id:
        truck = db.query(Truck).filter(Truck.id == vehicle_id).first()
        if truck:
            return (
                max(1.0, float(truck.fuel_efficiency_kmpl or 4.0)),
                max(1.0, float(truck.capacity_tons or 20.0)),
                float(truck.age_years or 1.0),
                float(truck.odometer_km or 0.0),
            )
    return (4.0, 20.0, 1.0, 0.0)


def _historical_frame(db: Session) -> pd.DataFrame:
    trips = db.query(Trip).filter(Trip.completed_at.isnot(None)).all()
    fuel_by_trip: dict[int, float] = {}
    for row in db.query(FuelLog).all():
        fuel_by_trip[row.trip_id] = fuel_by_trip.get(row.trip_id, 0.0) + float(row.cost or 0)
    toll_by_trip: dict[int, float] = {}
    for row in db.query(TollLog).all():
        toll_by_trip[row.trip_id] = toll_by_trip.get(row.trip_id, 0.0) + float(row.amount or 0)

    rows: list[dict[str, float]] = []
    for trip in trips:
        distance = float(trip.distance_km or 0)
        if distance <= 0:
            continue
        duration = float(trip.duration_hours or 0) or distance / 50.0
        cargo = float(trip.booking.cargo_weight_tons or 0) if trip.booking else 0.0
        fuel = fuel_by_trip.get(trip.id) or float(trip.fuel_cost or 0)
        toll = toll_by_trip.get(trip.id) or float(trip.toll_actual_total or trip.toll_cost or 0)
        driver = float(trip.labor_cost or 0) + float(trip.driver_allowance_php or 0)
        helper = float(trip.helper_allowance_php or 0)
        rows.append(
            {
                "distance_km": distance,
                "duration_hours": max(duration, 0.1),
                "cargo_weight_tons": max(cargo, 0.0),
                "fuel_cost": max(fuel, 0.0),
                "toll_cost": max(toll, 0.0),
                "driver_cost": max(driver, 0.0),
                "helper_cost": max(helper, 0.0),
                "total_operational_cost": max(fuel + toll + driver + helper, 0.0),
            }
        )
    return pd.DataFrame(rows, columns=[*FEATURES, *TARGETS.keys()])


def _fit_regressions(db: Session) -> _RegressionBundle | None:
    frame = _historical_frame(db)
    if len(frame) < MIN_REGRESSION_SAMPLES:
        return None
    x = frame[FEATURES]
    models: dict[str, LinearRegression] = {}
    scores: dict[str, float | None] = {}
    for target in TARGETS:
        model = LinearRegression().fit(x, frame[target])
        models[target] = model
        scores[target] = (
            round(float(model.score(x, frame[target])), 4)
            if len(frame) > 1 and float(frame[target].var()) > 0
            else None
        )
    return _RegressionBundle(frame=frame, models=models, scores=scores)


def _summary(
    db: Session,
    prediction_features: list[float] | None = None,
) -> tuple[CostRegressionSummary, dict[str, float]]:
    bundle = _fit_regressions(db)
    if bundle is None:
        sample_size = len(_historical_frame(db))
        reason = f"Need at least {MIN_REGRESSION_SAMPLES} completed trips with distance data; found {sample_size}."
        return (
            CostRegressionSummary(
                method="Multiple linear regression with deterministic fallback",
                trained=False,
                regression_used=False,
                sample_size=sample_size,
                minimum_samples=MIN_REGRESSION_SAMPLES,
                features=FEATURES,
                targets=[CostRegressionTarget(target=k, label=v) for k, v in TARGETS.items()],
                interpretation=reason,
                recommendation="Continue capturing completed-trip distance, duration, cargo, and actual cost records, then rerun the model.",
                fallback_reason=reason,
            ),
            {},
        )

    predictions: dict[str, float] = {}
    target_rows: list[CostRegressionTarget] = []
    for target, label in TARGETS.items():
        model = bundle.models[target]
        predicted = None
        if prediction_features is not None:
            predicted = max(0.0, float(model.predict(pd.DataFrame([prediction_features], columns=FEATURES))[0]))
            predictions[target] = predicted
        target_rows.append(
            CostRegressionTarget(
                target=target,
                label=label,
                prediction=round(predicted, 2) if predicted is not None else None,
                r_squared=bundle.scores[target],
                coefficients={name: round(float(value), 6) for name, value in zip(FEATURES, model.coef_)},
                intercept=round(float(model.intercept_), 6),
            )
        )

    finite_scores = [score for score in bundle.scores.values() if score is not None and np.isfinite(score)]
    average_r2 = sum(finite_scores) / len(finite_scores) if finite_scores else None
    interpretation = (
        f"Regression is fitted on {len(bundle.frame)} completed trips. Mean in-sample R² is {average_r2:.3f}; "
        "R² describes historical fit and should be interpreted cautiously for small samples."
        if average_r2 is not None
        else f"Regression is fitted on {len(bundle.frame)} completed trips; constant targets do not have a meaningful R²."
    )
    return (
        CostRegressionSummary(
            method="Multiple linear regression (distance, duration, cargo weight)",
            trained=True,
            regression_used=prediction_features is not None,
            sample_size=len(bundle.frame),
            minimum_samples=MIN_REGRESSION_SAMPLES,
            features=FEATURES,
            targets=target_rows,
            interpretation=interpretation,
            recommendation="Review R² by cost component and compare predictions with actual trip costs before changing rates or budgets.",
        ),
        predictions,
    )


def predict_trip_cost(
    req: TripCostPredictRequest,
    db: Session | None = None,
) -> TripCostPredictResponse:
    efficiency, max_load, age_years, mileage = _vehicle_specs(db, req.vehicle_id) if db else (4.0, 20.0, 1.0, 0.0)
    fuel = predict_fuel_consumption(
        FuelPredictRequest(
            distance_km=req.distance_km,
            cargo_weight_tons=req.cargo_weight_tons,
            avg_speed_kmh=req.avg_speed_kmh,
            road_condition=req.road_condition,
            fuel_price_per_liter=req.fuel_price_per_liter,
            vehicle_fuel_efficiency_kmpl=efficiency,
            max_load_tons=max_load,
        )
    )
    travel_hours = max(req.distance_km / max(1.0, req.avg_speed_kmh), 1.0)
    baseline = {
        "fuel_cost": float(fuel.fuel_cost),
        "toll_cost": round(req.distance_km * req.toll_rate_per_km, 2),
        "driver_cost": round(travel_hours * req.labor_rate_per_hour, 2),
        "helper_cost": round(travel_hours * req.helper_rate_per_hour, 2),
    }
    baseline["total_operational_cost"] = sum(baseline.values())

    if db is not None:
        regression, predicted = _summary(
            db,
            [float(req.distance_km), float(travel_hours), float(req.cargo_weight_tons)],
        )
    else:
        reason = "A database session is required to fit historical regression models."
        regression = CostRegressionSummary(
            method="Deterministic cost formula",
            trained=False,
            regression_used=False,
            sample_size=0,
            minimum_samples=MIN_REGRESSION_SAMPLES,
            features=FEATURES,
            targets=[CostRegressionTarget(target=k, label=v) for k, v in TARGETS.items()],
            interpretation=reason,
            recommendation="Use the authenticated analytics endpoint to enable historical regression.",
            fallback_reason=reason,
        )
        predicted = {}

    costs = baseline.copy()
    if predicted:
        component_sum = sum(predicted.get(key, 0.0) for key in ("fuel_cost", "toll_cost", "driver_cost", "helper_cost"))
        direct_total = predicted.get("total_operational_cost", component_sum)
        scale = direct_total / component_sum if component_sum > 0 else 1.0
        for key in ("fuel_cost", "toll_cost", "driver_cost", "helper_cost"):
            costs[key] = round(max(0.0, predicted.get(key, baseline[key]) * scale), 2)
        costs["total_operational_cost"] = round(sum(costs[key] for key in ("fuel_cost", "toll_cost", "driver_cost", "helper_cost")), 2)
        prediction_by_target = {row.target: row for row in regression.targets}
        for key in ("fuel_cost", "toll_cost", "driver_cost", "helper_cost", "total_operational_cost"):
            prediction_by_target[key].prediction = round(costs[key], 2)

    maintenance = predict_maintenance(
        MaintenancePredictRequest(
            vehicle_id=req.vehicle_id,
            mileage_km=mileage,
            age_years=age_years,
            engine_hours=0,
            has_recurring_issue=False,
        )
    )
    maintenance_risk_cost = round(maintenance.estimated_cost * 0.05, 2)
    labor_cost = round(costs["driver_cost"] + costs["helper_cost"], 2)
    total_cost = round(costs["total_operational_cost"] + maintenance_risk_cost, 2)
    method_line = (
        f"Regression used with {regression.sample_size} historical completed trips."
        if regression.regression_used
        else f"Formula fallback used: {regression.fallback_reason}"
    )
    explanation = [
        f"Fuel cost prediction: ₱{round(costs['fuel_cost'], 2)} ({fuel.fuel_liters} L formula reference)",
        f"Toll cost prediction: ₱{round(costs['toll_cost'], 2)}",
        f"Driver cost prediction: ₱{round(costs['driver_cost'], 2)}",
        f"Helper cost prediction: ₱{round(costs['helper_cost'], 2)}",
        f"Operational cost prediction: ₱{round(costs['total_operational_cost'], 2)}",
        f"Maintenance risk surcharge: ₱{maintenance_risk_cost} ({maintenance.priority_level})",
        method_line,
    ]
    return TripCostPredictResponse(
        fuel_liters=fuel.fuel_liters,
        fuel_cost=round(costs["fuel_cost"], 2),
        toll_cost=round(costs["toll_cost"], 2),
        driver_cost=round(costs["driver_cost"], 2),
        helper_cost=round(costs["helper_cost"], 2),
        labor_cost=labor_cost,
        maintenance_risk_cost=maintenance_risk_cost,
        total_operational_cost=round(costs["total_operational_cost"], 2),
        total_cost=total_cost,
        load_factor=fuel.load_factor,
        speed_factor=fuel.speed_factor,
        road_factor=fuel.road_factor,
        explanation=explanation,
        regression=regression,
    )


def train_cost_regression(db: Session) -> dict:
    """Return auditable component-model diagnostics for the current history."""
    summary, _ = _summary(db)
    payload = summary.model_dump()
    scores = [target.r_squared for target in summary.targets if target.r_squared is not None]
    # Backward-compatible fields consumed by the existing manager dashboard.
    payload["score"] = round(sum(scores) / len(scores), 4) if scores else None
    payload["reason"] = summary.fallback_reason
    return payload
