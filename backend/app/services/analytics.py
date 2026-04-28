import pandas as pd
from sklearn.linear_model import LinearRegression
from sqlalchemy.orm import Session
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from app.models.entities import MaintenanceRecord, Trip
from app.schemas.analytics import ForecastPoint


def train_cost_model(db: Session) -> dict:
    trips = db.query(Trip).all()
    if len(trips) < 5:
        return {"trained": False, "reason": "Not enough trip history"}

    frame = pd.DataFrame(
        [
            {
                "distance": item.distance_km,
                "duration": item.duration_hours,
                "fuel": item.fuel_cost,
                "toll": item.toll_cost,
                "labor": item.labor_cost,
                "total": item.fuel_cost + item.toll_cost + item.labor_cost,
            }
            for item in trips
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
    }


def forecast_demand(db: Session, periods: int = 6) -> list[ForecastPoint]:
    trips = db.query(Trip).order_by(Trip.id.asc()).all()
    if len(trips) < 8:
        base = [10 + (i % 3) for i in range(8)]
        series = pd.Series(base)
    else:
        series = pd.Series([trip.distance_km for trip in trips])

    model = ExponentialSmoothing(series, trend="add").fit()
    prediction = model.forecast(periods)
    period_labels = pd.period_range(start=pd.Timestamp.utcnow().to_period("M") + 1, periods=periods, freq="M")

    return [
        ForecastPoint(period=str(period_labels[i].strftime("%Y-%m")), value=float(v))
        for i, v in enumerate(prediction)
    ]


def maintenance_risk_snapshot(db: Session) -> list[dict]:
    records = db.query(MaintenanceRecord).all()
    return [
        {
            "truck_id": rec.truck_id,
            "issue": rec.reported_issue,
            "risk": rec.predicted_risk_score,
            "severity": rec.severity,
        }
        for rec in records
    ]
