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
    weight_tons: float = Field(default=1.0, ge=0.1, le=50.0)

    @field_validator("pickup_location", "dropoff_location", mode="before")
    @classmethod
    def strip_strings(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class RouteEstimateResponse(BaseModel):
    distance_km: float
    diesel_liters: float
    diesel_cost_php: float
    wear_misc_php: float
    depreciation_php: float
    helper_pay_php: float
    freight_base_php: float
    fuel_route_charge: float
    driver_fee: float
    estimated_total: float
    diesel_price_per_liter: float
    driver_commission_pct: float
    pickup_resolution: str
    dropoff_resolution: str
    estimate_tier: str


@router.post("/route-estimate", response_model=RouteEstimateResponse)
def estimate_customer_route(
    payload: RouteEstimateRequest,
    db: Session = Depends(get_db),
    _customer: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    km, p_res, d_res, tier = estimate_road_distance_km(
        payload.pickup_location,
        payload.dropoff_location,
        settings,
    )
    knobs = resolve_booking_freight_knobs(db, settings)
    pricing = customer_freight_pricing(km, payload.weight_tons, knobs)
    return RouteEstimateResponse(
        distance_km=pricing["distance_km"],
        diesel_liters=pricing["diesel_liters"],
        diesel_cost_php=pricing["diesel_cost_php"],
        wear_misc_php=pricing["wear_misc_php"],
        depreciation_php=pricing["depreciation_php"],
        helper_pay_php=pricing["helper_pay_php"],
        freight_base_php=pricing["freight_base_php"],
        fuel_route_charge=pricing["fuel_route_charge"],
        driver_fee=pricing["driver_fee"],
        estimated_total=pricing["estimated_total"],
        diesel_price_per_liter=pricing["diesel_price_per_liter"],
        driver_commission_pct=pricing["driver_commission_pct"],
        pickup_resolution=p_res,
        dropoff_resolution=d_res,
        estimate_tier=tier,
    )
