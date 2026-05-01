"""Fuel consumption prediction (paper §3.2.8.1, Table 7).

Steps (from the paper):
1. Input trip data (distance, weight, vehicle type, avg speed, road condition, fuel price)
2. Retrieve base fuel rate (vehicle fuel efficiency)
3. Compute load factor   = 1 + (cargo_weight / max_load)
4. Compute speed factor  = avg_speed / standard_speed (50)
5. Apply road factor (rough × 1.15, urban × 1.08, highway × 1.0)
6. Fuel consumption = distance / efficiency × load_factor / speed_factor × road_factor
7. Fuel cost        = consumption × fuel_price
"""
from app.schemas.predict import FuelPredictRequest, FuelPredictResponse


STANDARD_SPEED_KMH = 50.0
ROAD_FACTORS = {
    "highway": 1.00,
    "urban": 1.08,
    "rough": 1.15,
}


def predict_fuel_consumption(req: FuelPredictRequest) -> FuelPredictResponse:
    distance = max(0.0, float(req.distance_km))
    efficiency = max(1.0, float(req.vehicle_fuel_efficiency_kmpl))
    max_load = max(1.0, float(req.max_load_tons))

    load_factor = 1.0 + (max(0.0, req.cargo_weight_tons) / max_load)
    speed_factor = max(0.5, min(2.0, float(req.avg_speed_kmh) / STANDARD_SPEED_KMH))
    road_factor = ROAD_FACTORS.get(req.road_condition, 1.0)

    base_liters = distance / efficiency
    liters = base_liters * load_factor / speed_factor * road_factor
    cost = liters * float(req.fuel_price_per_liter)

    return FuelPredictResponse(
        fuel_liters=round(liters, 2),
        fuel_cost=round(cost, 2),
        load_factor=round(load_factor, 3),
        speed_factor=round(speed_factor, 3),
        road_factor=round(road_factor, 3),
    )
