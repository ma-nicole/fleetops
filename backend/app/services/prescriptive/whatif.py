"""What-if simulation (paper Fig 24 — interactive what-if tool)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.predict import (
    TripCostPredictRequest,
    WhatIfRequest,
    WhatIfResponse,
)
from app.services.predictive.cost_model import predict_trip_cost


def run_whatif(req: WhatIfRequest, db: Session | None = None) -> WhatIfResponse:
    base_pred = predict_trip_cost(req.base, db=db)

    sim = TripCostPredictRequest(
        distance_km=req.base.distance_km * (1 + req.distance_delta_pct / 100),
        cargo_weight_tons=req.base.cargo_weight_tons * (1 + req.cargo_delta_pct / 100),
        vehicle_id=req.base.vehicle_id,
        avg_speed_kmh=req.base.avg_speed_kmh,
        road_condition=req.road_condition_override or req.base.road_condition,
        fuel_price_per_liter=req.base.fuel_price_per_liter * (1 + req.fuel_price_delta_pct / 100),
        labor_rate_per_hour=req.base.labor_rate_per_hour,
        toll_rate_per_km=req.base.toll_rate_per_km,
    )
    sim_pred = predict_trip_cost(sim, db=db)

    delta = round(sim_pred.total_cost - base_pred.total_cost, 2)
    base_total = base_pred.total_cost or 1
    delta_pct = round(delta / base_total * 100, 2)

    return WhatIfResponse(base=base_pred, simulated=sim_pred, delta_total=delta, delta_pct=delta_pct)
