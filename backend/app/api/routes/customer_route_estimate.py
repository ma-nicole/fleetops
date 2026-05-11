from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_roles
from app.db import get_db
from app.models.entities import User, UserRole
from app.services.booking_freight_knobs import resolve_booking_freight_knobs
from app.services.route_estimate import customer_freight_pricing, estimate_road_distance_km

router = APIRouter(prefix="/customer", tags=["customer"])


class RouteEstimateRequest(BaseModel):
    pickup_location: str = Field(..., max_length=4000)
    dropoff_location: str = Field(..., max_length=4000)
    weight_tons: float = Field(default=1.0, ge=0.1, le=168.0)

    @field_validator("pickup_location", "dropoff_location", mode="before")
    @classmethod
    def strip_strings(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class TruckLoadLine(BaseModel):
    truck_index: int
    weight_tons: float
    distance_km: float
    cargo_gross_php: float
    diesel_liters: float
    diesel_cost_php: float
    driver_share_php: float
    helper_share_php: float
    toll_fees_php: float
    additives_total_php: float
    net_profit_php: float


class RouteQuoteResponse(BaseModel):
    distance_km: float
    weight_tons: float
    total_trucks: int
    cargo_rate_php_per_ton: float
    cargo_gross_php: float
    diesel_liters: float
    diesel_cost_php: float
    driver_share_php: float
    helper_share_php: float
    toll_fees_php: float
    additives_total_php: float
    net_profit_total_php: float
    quoted_total: float
    diesel_price_per_liter: float
    driver_freight_share_pct: float
    helper_freight_share_pct: float
    truck_loads: list[TruckLoadLine]
    pickup_resolution: str
    dropoff_resolution: str
    pricing_tier: str
    routing_method: str


@router.post("/route-quote", response_model=RouteQuoteResponse)
def quote_customer_route(
    payload: RouteEstimateRequest,
    db: Session = Depends(get_db),
    _customer: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    est = estimate_road_distance_km(
        payload.pickup_location,
        payload.dropoff_location,
        settings,
    )
    km = est.distance_km
    p_res = est.pickup_provider
    d_res = est.dropoff_provider
    tier = est.tier
    routing_method = est.routing_method
    knobs = resolve_booking_freight_knobs(db, settings)
    pricing = customer_freight_pricing(km, payload.weight_tons, knobs)
    loads_raw = pricing["truck_loads"]
    truck_loads = [
        TruckLoadLine(
            truck_index=int(row["truck_index"]),
            weight_tons=float(row["weight_tons"]),
            distance_km=float(row["distance_km"]),
            cargo_gross_php=float(row["cargo_gross_php"]),
            diesel_liters=float(row["diesel_liters"]),
            diesel_cost_php=float(row["diesel_cost_php"]),
            driver_share_php=float(row["driver_share_php"]),
            helper_share_php=float(row["helper_share_php"]),
            toll_fees_php=float(row["toll_fees_php"]),
            additives_total_php=float(row["additives_total_php"]),
            net_profit_php=float(row["net_profit_php"]),
        )
        for row in loads_raw
    ]
    return RouteQuoteResponse(
        distance_km=float(pricing["distance_km"]),
        weight_tons=float(pricing["weight_tons"]),
        total_trucks=int(pricing["total_trucks"]),
        cargo_rate_php_per_ton=float(pricing["cargo_rate_php_per_ton"]),
        cargo_gross_php=float(pricing["cargo_gross_php"]),
        diesel_liters=float(pricing["diesel_liters"]),
        diesel_cost_php=float(pricing["diesel_cost_php"]),
        driver_share_php=float(pricing["driver_share_php"]),
        helper_share_php=float(pricing["helper_share_php"]),
        toll_fees_php=float(pricing["toll_fees_php"]),
        additives_total_php=float(pricing["additives_total_php"]),
        net_profit_total_php=float(pricing["net_profit_total_php"]),
        quoted_total=float(pricing["quoted_total"]),
        diesel_price_per_liter=float(pricing["diesel_price_per_liter"]),
        driver_freight_share_pct=float(pricing["driver_freight_share_pct"]),
        helper_freight_share_pct=float(pricing["helper_freight_share_pct"]),
        truck_loads=truck_loads,
        pickup_resolution=p_res,
        dropoff_resolution=d_res,
        pricing_tier=tier,
        routing_method=routing_method,
    )
