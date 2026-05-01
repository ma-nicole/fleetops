"""Backwards-compatible analytics shim.

The real implementations now live in `app.services.predictive.*`. This
module keeps the historical function names alive so existing routers
(e.g. `/api/manager/dashboard`) keep working.
"""
from sqlalchemy.orm import Session

from app.models.entities import MaintenanceRecord
from app.schemas.analytics import ForecastPoint
from app.services.predictive.cost_model import train_cost_regression
from app.services.predictive.demand_model import forecast_monthly_cost


def train_cost_model(db: Session) -> dict:
    return train_cost_regression(db)


def forecast_demand(db: Session, periods: int = 6) -> list[ForecastPoint]:
    response = forecast_monthly_cost(db, periods=periods)
    return [ForecastPoint(period=p.period, value=p.value) for p in response.points]


def maintenance_risk_snapshot(db: Session) -> list[dict]:
    records = db.query(MaintenanceRecord).all()
    return [
        {
            "truck_id": rec.truck_id,
            "issue": rec.reported_issue,
            "risk": rec.predicted_risk_score,
            "severity": rec.severity,
            "status": rec.status.value if hasattr(rec.status, "value") else str(rec.status),
            "next_service_date": rec.next_service_date.isoformat() if rec.next_service_date else None,
        }
        for rec in records
    ]
