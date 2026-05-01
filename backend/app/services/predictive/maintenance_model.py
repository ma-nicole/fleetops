"""Maintenance prediction model (paper §3.2.8.2, Table 8).

Steps (from the paper):
1. Input vehicle data (mileage, age, engine hours, history)
2. Retrieve base maintenance cost
3. Mileage factor = current_mileage / standard_mileage
4. Age factor     = vehicle_age / expected_life
5. If recurring issue → add adjustment cost (Base × 0.25)
6. Maintenance cost = (Base × Mileage × Age) + adjustment
7. Determine priority level (low/medium/high)
"""
from app.schemas.predict import MaintenancePredictRequest, MaintenancePredictResponse


def _priority(risk: float) -> str:
    if risk >= 0.7:
        return "high_risk"
    if risk >= 0.4:
        return "medium_risk"
    return "low_risk"


def predict_maintenance(req: MaintenancePredictRequest) -> MaintenancePredictResponse:
    mileage_factor = round(max(0.1, float(req.mileage_km) / max(1.0, req.standard_mileage)), 3)
    age_factor = round(max(0.1, float(req.age_years) / max(1.0, req.expected_life_years)), 3)

    issue_factor = 0.25 if req.has_recurring_issue else 0.0
    issue_adjustment = req.base_maintenance_cost * issue_factor

    estimated_cost = round(req.base_maintenance_cost * mileage_factor * age_factor + issue_adjustment, 2)

    # Composite risk in [0,1]: blend of mileage, age, recurring-issue and engine hours.
    engine_hours_factor = min(1.0, float(req.engine_hours) / 5000.0)
    risk = min(
        1.0,
        0.45 * mileage_factor + 0.35 * age_factor + 0.10 * engine_hours_factor + (0.30 if req.has_recurring_issue else 0.0),
    )
    priority = _priority(risk)

    # Suggested days until next service: invert risk (higher risk → sooner).
    next_service_in_days = max(7, int((1.0 - risk) * 90))

    explanation = [
        f"Mileage factor: {mileage_factor}",
        f"Age factor: {age_factor}",
        f"Engine-hours factor: {round(engine_hours_factor, 3)}",
        f"Recurring issue surcharge: {issue_factor:.0%}",
        f"Composite risk score: {round(risk, 3)} → priority {priority}",
    ]

    return MaintenancePredictResponse(
        risk_score=round(risk, 3),
        priority_level=priority,
        estimated_cost=estimated_cost,
        next_service_in_days=next_service_in_days,
        mileage_factor=mileage_factor,
        age_factor=age_factor,
        explanation=explanation,
    )
