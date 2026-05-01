"""Predictive analytics endpoints (paper §3.2.8 Fig 23 + §3.5.10)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import ForecastRun, User, UserRole
from app.schemas.predict import (
    FuelPredictRequest,
    FuelPredictResponse,
    MaintenancePredictRequest,
    MaintenancePredictResponse,
    MonthlyForecastResponse,
    TripCostPredictRequest,
    TripCostPredictResponse,
    FeedbackSummaryResponse,
)
from app.services.analytics_pipeline import run_pipeline
from app.services.feedback_loop import feedback_summary
from app.services.predictive.cost_model import predict_trip_cost, train_cost_regression
from app.services.predictive.demand_model import forecast_monthly_cost
from app.services.predictive.fuel_model import predict_fuel_consumption
from app.services.predictive.maintenance_model import predict_maintenance


router = APIRouter(prefix="/analytics", tags=["analytics-predict"])


@router.get("/dashboard")
def analytics_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.DISPATCHER)),
):
    """Aggregated analytics view (paper §3.2.8 Fig 23 marts)."""
    return run_pipeline(db)


@router.post("/predict-trip-cost", response_model=TripCostPredictResponse)
def predict_trip_cost_endpoint(
    payload: TripCostPredictRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.CUSTOMER, UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN
    )),
):
    db.add(ForecastRun(model_name="trip_cost", triggered_by_id=user.id, sample_size=1))
    db.commit()
    return predict_trip_cost(payload, db=db)


@router.post("/predict-fuel", response_model=FuelPredictResponse)
def predict_fuel_endpoint(
    payload: FuelPredictRequest,
    _: User = Depends(require_roles(
        UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN, UserRole.DRIVER
    )),
):
    return predict_fuel_consumption(payload)


@router.post("/predict-maintenance", response_model=MaintenancePredictResponse)
def predict_maintenance_endpoint(
    payload: MaintenancePredictRequest,
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.DISPATCHER)),
):
    return predict_maintenance(payload)


@router.get("/forecast-monthly", response_model=MonthlyForecastResponse)
def monthly_forecast_endpoint(
    horizon: int = 6,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    return forecast_monthly_cost(db, periods=horizon)


@router.post("/train-cost-model")
def train_cost_model_endpoint(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    db.add(ForecastRun(model_name="cost_regression", triggered_by_id=user.id))
    db.commit()
    return train_cost_regression(db)


@router.get("/feedback-summary", response_model=FeedbackSummaryResponse)
def feedback_summary_endpoint(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    return feedback_summary(db)
