"""Predictive analytics package (paper §3.2.8).

Exposes the trip-cost, fuel-consumption and maintenance models. Each
function is pure and rule-based by default so the rest of the system can
work before any historical data accumulates; once historical trips exist
the regression coefficients are blended in by `cost_model.train(...)`.
"""
from .cost_model import predict_trip_cost, train_cost_regression
from .fuel_model import predict_fuel_consumption
from .maintenance_model import predict_maintenance
from .demand_model import forecast_monthly_cost

__all__ = [
    "predict_trip_cost",
    "train_cost_regression",
    "predict_fuel_consumption",
    "predict_maintenance",
    "forecast_monthly_cost",
]
