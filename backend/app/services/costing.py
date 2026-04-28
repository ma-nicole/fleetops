from app.schemas.analytics import CostPredictionRequest, CostPredictionResponse


# Baseline formula that can be replaced by model-based estimation once enough historical data exists.
def estimate_trip_cost(request: CostPredictionRequest) -> CostPredictionResponse:
    estimated_fuel = request.distance_km * 0.28 * request.fuel_price_per_liter
    estimated_toll = request.distance_km * request.toll_rate
    estimated_labor = max(request.distance_km / 45.0, 1.0) * request.labor_rate
    load_factor = 1 + (request.cargo_weight_tons * 0.02)

    estimated_total = (estimated_fuel + estimated_toll + estimated_labor) * load_factor
    return CostPredictionResponse(
        estimated_fuel=round(estimated_fuel, 2),
        estimated_toll=round(estimated_toll, 2),
        estimated_labor=round(estimated_labor, 2),
        estimated_total=round(estimated_total, 2),
    )
