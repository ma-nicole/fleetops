from pydantic import BaseModel


class CostPredictionRequest(BaseModel):
    distance_km: float
    cargo_weight_tons: float
    fuel_price_per_liter: float
    labor_rate: float
    toll_rate: float


class CostPredictionResponse(BaseModel):
    estimated_fuel: float
    estimated_toll: float
    estimated_labor: float
    estimated_total: float


class ForecastPoint(BaseModel):
    period: str
    value: float
