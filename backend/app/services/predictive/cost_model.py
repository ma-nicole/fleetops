"""Trip-level cost prediction (paper §3.2.8 Fig 23, Fig 25 input feature set).

Combines the rule-based fuel formula (paper §3.2.8.1), a labor cost term,
a toll cost term, and a maintenance-risk surcharge into a single
prediction. If at least 5 historical trips exist a linear regression is
fitted on top to refine the totals (`train_cost_regression`).
"""
from __future__ import annotations

import pandas as pd
from sklearn.linear_model import LinearRegression
from sqlalchemy.orm import Session

from app.models.entities import Trip, Truck
from app.schemas.predict import (
    FuelPredictRequest,
    TripCostPredictRequest,
    TripCostPredictResponse,
)
from app.services.predictive.fuel_model import predict_fuel_consumption
from app.services.predictive.maintenance_model import predict_maintenance
from app.schemas.predict import MaintenancePredictRequest


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
    labor_cost = round(travel_hours * req.labor_rate_per_hour, 2)
    toll_cost = round(req.distance_km * req.toll_rate_per_km, 2)

    maintenance = predict_maintenance(
        MaintenancePredictRequest(
            vehicle_id=req.vehicle_id,
            mileage_km=mileage,
            age_years=age_years,
            engine_hours=0,
            has_recurring_issue=False,
        )
    )
    # Per-trip share of the predicted maintenance cost (~5% of full estimate).
    maintenance_risk_cost = round(maintenance.estimated_cost * 0.05, 2)

    base_total = round(fuel.fuel_cost + toll_cost + labor_cost + maintenance_risk_cost, 2)

    # Refine with regression coefficients if available
    refined_total = base_total
    if db is not None:
        delta = _regression_adjustment(db, req.distance_km, req.cargo_weight_tons, base_total)
        refined_total = round(base_total + delta, 2)

    explanation = [
        f"Fuel: {fuel.fuel_liters}L × ₱{req.fuel_price_per_liter}/L = ₱{fuel.fuel_cost}",
        f"Toll: {req.distance_km}km × ₱{req.toll_rate_per_km}/km = ₱{toll_cost}",
        f"Labor: {round(travel_hours, 2)}h × ₱{req.labor_rate_per_hour}/h = ₱{labor_cost}",
        f"Maintenance risk surcharge: ₱{maintenance_risk_cost} (priority {maintenance.priority_level})",
        f"Refined with regression: Δ ₱{round(refined_total - base_total, 2)}",
    ]

    return TripCostPredictResponse(
        fuel_liters=fuel.fuel_liters,
        fuel_cost=fuel.fuel_cost,
        toll_cost=toll_cost,
        labor_cost=labor_cost,
        maintenance_risk_cost=maintenance_risk_cost,
        total_cost=refined_total,
        load_factor=fuel.load_factor,
        speed_factor=fuel.speed_factor,
        road_factor=fuel.road_factor,
        explanation=explanation,
    )


def _regression_adjustment(
    db: Session, distance_km: float, weight: float, base_total: float
) -> float:
    """Use historical trip totals to learn a residual correction."""
    trips = db.query(Trip).filter(Trip.completed_at.isnot(None)).all()
    if len(trips) < 5:
        return 0.0
    frame = pd.DataFrame(
        [
            {
                "distance": float(t.distance_km or 0),
                "weight": float(t.booking.cargo_weight_tons or 0) if t.booking else 0,
                "total": float(t.fuel_cost + t.toll_cost + t.labor_cost),
            }
            for t in trips
        ]
    )
    if frame["total"].sum() <= 0:
        return 0.0
    model = LinearRegression()
    x = frame[["distance", "weight"]]
    y = frame["total"]
    model.fit(x, y)
    predicted = float(model.predict([[distance_km, weight]])[0])
    return max(-base_total * 0.5, min(base_total * 0.5, predicted - base_total))


def train_cost_regression(db: Session) -> dict:
    """Fit a regression on historical trip totals (paper §3.2.8 Fig 23)."""
    trips = db.query(Trip).all()
    if len(trips) < 5:
        return {"trained": False, "reason": "Not enough trip history (need 5+)"}

    frame = pd.DataFrame(
        [
            {
                "distance": float(t.distance_km or 0),
                "duration": float(t.duration_hours or 0),
                "fuel": float(t.fuel_cost or 0),
                "toll": float(t.toll_cost or 0),
                "labor": float(t.labor_cost or 0),
                "total": float(t.fuel_cost + t.toll_cost + t.labor_cost),
            }
            for t in trips
        ]
    )
    model = LinearRegression()
    x = frame[["distance", "duration", "fuel", "toll", "labor"]]
    y = frame["total"]
    model.fit(x, y)
    return {
        "trained": True,
        "score": float(model.score(x, y)),
        "coefficients": dict(zip(x.columns.tolist(), model.coef_.tolist())),
        "intercept": float(model.intercept_),
        "sample_size": len(trips),
    }
