"""Predictive & prescriptive request/response schemas (paper §3.2.8 + §3.2.9)."""
from pydantic import BaseModel, field_validator


# -----------------------------------------------------------------
# Trip-level cost prediction (paper Table 7 / Fig 25)
# -----------------------------------------------------------------

class TripCostPredictRequest(BaseModel):
    distance_km: float
    cargo_weight_tons: float
    vehicle_id: int | None = None
    avg_speed_kmh: float = 50
    road_condition: str = "highway"  # highway | urban | rough
    fuel_price_per_liter: float = 60.0
    labor_rate_per_hour: float = 100.0
    toll_rate_per_km: float = 1.5

    @field_validator("distance_km", "cargo_weight_tons", "fuel_price_per_liter")
    @classmethod
    def positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Must be positive")
        return float(v)

    @field_validator("road_condition")
    @classmethod
    def road(cls, v: str) -> str:
        v = (v or "highway").lower().strip()
        if v not in {"highway", "urban", "rough"}:
            raise ValueError("road_condition must be highway | urban | rough")
        return v


class TripCostPredictResponse(BaseModel):
    fuel_liters: float
    fuel_cost: float
    toll_cost: float
    labor_cost: float
    maintenance_risk_cost: float
    total_cost: float
    load_factor: float
    speed_factor: float
    road_factor: float
    explanation: list[str]


# -----------------------------------------------------------------
# Fuel-only prediction (paper §3.2.8.1)
# -----------------------------------------------------------------

class FuelPredictRequest(BaseModel):
    distance_km: float
    cargo_weight_tons: float
    avg_speed_kmh: float = 50
    road_condition: str = "highway"
    fuel_price_per_liter: float = 60.0
    vehicle_fuel_efficiency_kmpl: float = 4.0
    max_load_tons: float = 30.0


class FuelPredictResponse(BaseModel):
    fuel_liters: float
    fuel_cost: float
    load_factor: float
    speed_factor: float
    road_factor: float


# -----------------------------------------------------------------
# Maintenance prediction (paper §3.2.8.2)
# -----------------------------------------------------------------

class MaintenancePredictRequest(BaseModel):
    vehicle_id: int | None = None
    mileage_km: float
    age_years: float
    engine_hours: float = 0
    has_recurring_issue: bool = False
    base_maintenance_cost: float = 5000.0
    expected_life_years: float = 10.0
    standard_mileage: float = 50000.0


class MaintenancePredictResponse(BaseModel):
    risk_score: float
    priority_level: str  # low_risk | medium_risk | high_risk
    estimated_cost: float
    next_service_in_days: int
    mileage_factor: float
    age_factor: float
    explanation: list[str]


# -----------------------------------------------------------------
# Routing optimization (A*)
# -----------------------------------------------------------------

class RouteOptimizeRequest(BaseModel):
    origin: str
    destination: str
    weight: str = "cost"  # cost | distance | time
    vehicle_id: int | None = None
    cargo_weight_tons: float = 5
    departure_hour: int = 8

    @field_validator("weight")
    @classmethod
    def w(cls, v: str) -> str:
        v = (v or "cost").lower()
        if v not in {"cost", "distance", "time"}:
            raise ValueError("weight must be cost | distance | time")
        return v


class RouteEdge(BaseModel):
    from_node: str
    to_node: str
    distance_km: float
    fuel_cost: float
    toll_cost: float
    time_penalty: float
    maintenance_penalty: float


class RouteCandidate(BaseModel):
    rank: int
    path: list[str]
    distance_km: float
    fuel_cost: float
    toll_cost: float
    time_penalty: float
    maintenance_penalty: float
    total_cost: float
    edges: list[RouteEdge]
    explanation: list[str]


class RouteOptimizeResponse(BaseModel):
    candidates: list[RouteCandidate]
    selected_rank: int
    constraints_applied: list[str]


# -----------------------------------------------------------------
# Assignment recommendation (paper Fig 25 prescriptive)
# -----------------------------------------------------------------

class AssignmentRecommendRequest(BaseModel):
    booking_id: int


class AssignmentCandidate(BaseModel):
    truck_id: int
    truck_code: str
    driver_id: int
    driver_name: str
    helper_id: int | None
    helper_name: str | None
    score: float
    reasoning: list[str]


class AssignmentRecommendResponse(BaseModel):
    booking_id: int
    best: AssignmentCandidate | None
    alternatives: list[AssignmentCandidate]


# -----------------------------------------------------------------
# What-if simulation (paper Fig 24)
# -----------------------------------------------------------------

class WhatIfRequest(BaseModel):
    base: TripCostPredictRequest
    fuel_price_delta_pct: float = 0
    distance_delta_pct: float = 0
    cargo_delta_pct: float = 0
    road_condition_override: str | None = None


class WhatIfResponse(BaseModel):
    base: TripCostPredictResponse
    simulated: TripCostPredictResponse
    delta_total: float
    delta_pct: float


# -----------------------------------------------------------------
# Forecast / model metrics
# -----------------------------------------------------------------

class MonthlyForecastPoint(BaseModel):
    period: str
    value: float


class MonthlyForecastResponse(BaseModel):
    horizon_months: int
    points: list[MonthlyForecastPoint]


class ModelMetricRead(BaseModel):
    model_name: str
    mae: float
    mape: float
    rmse: float
    accuracy: float
    recall: float
    f1: float
    brier: float
    sample_size: int
    measured_at: str


class FeedbackSummaryResponse(BaseModel):
    metrics_by_model: dict[str, ModelMetricRead]
    drift_detected: bool
    last_retrain_at: str | None
    sample_size: int
