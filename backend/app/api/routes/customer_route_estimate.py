from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_roles
from app.db import get_db
from app.models.entities import User, UserRole
from app.services.booking_freight_knobs import resolve_booking_freight_knobs
from app.services.booking_pricing import pricing_with_toll_matrix
from app.services.route_distance_resolution import (
    DISTANCE_UNVERIFIED_WARNING,
    QUOTE_STATUS_CONFIRMED,
    QUOTE_STATUS_PENDING,
    resolve_quote_distance_km,
)
from app.services.route_estimate import PreciseDistanceUnavailable, heuristic_fallback_km
from app.services.route_options_quote import (
    build_priced_route_options,
    pick_selected_option,
    resolve_road_alternatives_for_quote,
)
from app.services.road_routing import RoadRouteOption
from app.services.toll_matrix import DEFAULT_VEHICLE_CLASS

router = APIRouter(prefix="/customer", tags=["customer"])


class RouteEstimateRequest(BaseModel):
    pickup_location: str = Field(..., max_length=4000)
    dropoff_location: str = Field(..., max_length=4000)
    weight_tons: float = Field(default=1.0, ge=0.1, le=168.0)
    toll_entry_point: str | None = Field(default=None, max_length=255)
    toll_exit_point: str | None = Field(default=None, max_length=255)
    vehicle_class: str | None = Field(default=None, max_length=32)
    distance_km_override: float | None = Field(default=None, gt=0, le=5000)
    selected_route_option_id: str | None = Field(default=None, max_length=64)

    @field_validator(
        "pickup_location",
        "dropoff_location",
        "toll_entry_point",
        "toll_exit_point",
        "vehicle_class",
        "selected_route_option_id",
        mode="before",
    )
    @classmethod
    def strip_strings(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip() or None
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


class RouteOptionQuote(BaseModel):
    id: str
    label: str
    rank: int
    is_recommended: bool
    distance_km: float
    travel_time_hours: float
    travel_time_label: str
    estimated_fuel_cost_php: float
    estimated_toll_cost_php: float
    quoted_total_php: float
    routing_method: str
    summary: str | None = None


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
    toll_matrix_matched: bool = False
    toll_estimate_message: str | None = None
    toll_entry_point: str | None = None
    toll_exit_point: str | None = None
    toll_effective_date: str | None = None
    estimated_toll_budget_per_truck: float | None = None
    estimated_toll_budget_total: float | None = None
    toll_plaza_options: list[str] = Field(default_factory=list)
    suggested_toll_entry_point: str | None = None
    suggested_toll_exit_point: str | None = None
    toll_match_method: str | None = None
    toll_source: str | None = None
    toll_segments: list[dict] = Field(default_factory=list)
    toll_is_estimated: bool = False
    maintenance_cost_php: float = 0.0
    service_fee_php: float = 0.0
    fuel_price_source: str | None = None
    fuel_price_fetched_at: str | None = None
    fuel_price_from_cache: bool = True
    fuel_price_message: str | None = None
    distance_confirmed: bool = True
    distance_warning: str | None = None
    quote_status: str | None = None
    route_options: list[RouteOptionQuote] = Field(default_factory=list)
    recommended_route_option_id: str | None = None
    selected_route_option_id: str | None = None
    travel_time_hours: float | None = None
    travel_time_label: str | None = None


def _truck_loads(pricing: dict) -> list[TruckLoadLine]:
    return [
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
        for row in pricing["truck_loads"]
    ]


@router.post("/route-quote", response_model=RouteQuoteResponse)
def quote_customer_route(
    payload: RouteEstimateRequest,
    db: Session = Depends(get_db),
    _customer: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    has_manual_toll = bool(payload.toll_entry_point and payload.toll_exit_point)
    vehicle_class = payload.vehicle_class or DEFAULT_VEHICLE_CLASS
    resolve_booking_freight_knobs(db, settings)

    route_options_out: list[RouteOptionQuote] = []
    recommended_id: str | None = None
    selected_id: str | None = payload.selected_route_option_id
    travel_hours: float | None = None
    travel_label: str | None = None

    # Manual distance override: keep existing single-path pricing, still expose one option card.
    if payload.distance_km_override is not None and float(payload.distance_km_override) > 0:
        dist = resolve_quote_distance_km(
            payload.pickup_location,
            payload.dropoff_location,
            settings,
            distance_km_override=payload.distance_km_override,
            allow_unverified_with_manual_toll=has_manual_toll,
        )
        km = dist.distance_km
        p_res = dist.pickup_resolution
        d_res = dist.dropoff_resolution
        tier = dist.pricing_tier
        routing_method = dist.routing_method
        distance_confirmed = dist.distance_confirmed
        distance_warning = dist.distance_warning
        quote_status = dist.quote_status
        synthetic = [
            RoadRouteOption(
                distance_km=float(km),
                duration_seconds=None,
                provider="distance_override",
                index=0,
                summary="Confirmed distance",
            )
        ]
        priced = build_priced_route_options(
            db,
            pickup_location=payload.pickup_location,
            dropoff_location=payload.dropoff_location,
            cargo_weight_tons=payload.weight_tons,
            settings=settings,
            vehicle_class=vehicle_class,
            manual_entry=payload.toll_entry_point,
            manual_exit=payload.toll_exit_point,
            road_options=synthetic,
            routing_method=routing_method,
            selected_option_id=selected_id,
        )
    else:
        try:
            road_opts, routing_method, p_res, d_res = resolve_road_alternatives_for_quote(
                payload.pickup_location,
                payload.dropoff_location,
                settings,
            )
            priced = build_priced_route_options(
                db,
                pickup_location=payload.pickup_location,
                dropoff_location=payload.dropoff_location,
                cargo_weight_tons=payload.weight_tons,
                settings=settings,
                vehicle_class=vehicle_class,
                manual_entry=payload.toll_entry_point,
                manual_exit=payload.toll_exit_point,
                road_options=road_opts,
                routing_method=routing_method,
                selected_option_id=selected_id,
            )
            chosen = pick_selected_option(priced, selected_id)
            km = float(chosen.distance_km) if chosen else float(road_opts[0].distance_km)
            tier = "geocoded"
            distance_confirmed = True
            distance_warning = None
            quote_status = QUOTE_STATUS_CONFIRMED
        except PreciseDistanceUnavailable:
            if has_manual_toll:
                km = heuristic_fallback_km(payload.pickup_location, payload.dropoff_location)
                p_res = d_res = "unavailable"
                tier = "distance_unverified"
                routing_method = "heuristic_fallback"
                distance_confirmed = False
                distance_warning = DISTANCE_UNVERIFIED_WARNING
                quote_status = QUOTE_STATUS_PENDING
                priced = build_priced_route_options(
                    db,
                    pickup_location=payload.pickup_location,
                    dropoff_location=payload.dropoff_location,
                    cargo_weight_tons=payload.weight_tons,
                    settings=settings,
                    vehicle_class=vehicle_class,
                    manual_entry=payload.toll_entry_point,
                    manual_exit=payload.toll_exit_point,
                    road_options=[
                        RoadRouteOption(
                            distance_km=float(km),
                            duration_seconds=None,
                            provider="heuristic_fallback",
                            index=0,
                            summary=None,
                        )
                    ],
                    routing_method=routing_method,
                )
            else:
                raise

    for row in priced:
        route_options_out.append(
            RouteOptionQuote(
                id=row.id,
                label=row.label,
                rank=row.rank,
                is_recommended=row.is_recommended,
                distance_km=row.distance_km,
                travel_time_hours=row.travel_time_hours,
                travel_time_label=row.travel_time_label,
                estimated_fuel_cost_php=row.estimated_fuel_cost_php,
                estimated_toll_cost_php=row.estimated_toll_cost_php,
                quoted_total_php=row.quoted_total_php,
                routing_method=row.routing_method,
                summary=row.summary,
            )
        )
        if row.is_recommended:
            recommended_id = row.id

    chosen = pick_selected_option(priced, selected_id)
    if chosen:
        selected_id = chosen.id
        km = float(chosen.distance_km)
        travel_hours = float(chosen.travel_time_hours)
        travel_label = chosen.travel_time_label

    pricing, toll_meta = pricing_with_toll_matrix(
        db,
        pickup_location=payload.pickup_location,
        dropoff_location=payload.dropoff_location,
        cargo_weight_tons=payload.weight_tons,
        distance_km=km,
        settings=settings,
        vehicle_class=vehicle_class,
        manual_entry=payload.toll_entry_point,
        manual_exit=payload.toll_exit_point,
    )

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
        truck_loads=_truck_loads(pricing),
        pickup_resolution=p_res,
        dropoff_resolution=d_res,
        pricing_tier=tier,
        routing_method=routing_method,
        toll_matrix_matched=bool(toll_meta.get("matched")),
        toll_estimate_message=toll_meta.get("message"),
        toll_entry_point=toll_meta.get("entry_point"),
        toll_exit_point=toll_meta.get("exit_point"),
        toll_effective_date=toll_meta.get("effective_date"),
        estimated_toll_budget_per_truck=toll_meta.get("toll_budget_per_truck"),
        estimated_toll_budget_total=toll_meta.get("toll_budget_total"),
        toll_plaza_options=toll_meta.get("plaza_options") or [],
        suggested_toll_entry_point=toll_meta.get("suggested_entry_point"),
        suggested_toll_exit_point=toll_meta.get("suggested_exit_point"),
        toll_match_method=toll_meta.get("match_method"),
        toll_source=toll_meta.get("toll_source"),
        toll_segments=toll_meta.get("segments") or [],
        toll_is_estimated=bool(toll_meta.get("is_estimated")),
        maintenance_cost_php=float(pricing.get("maintenance_cost_php") or 0),
        service_fee_php=float(pricing.get("service_fee_php") or 0),
        fuel_price_source=(pricing.get("fuel_price_meta") or {}).get("fuel_price_source"),
        fuel_price_fetched_at=(pricing.get("fuel_price_meta") or {}).get("fuel_price_fetched_at"),
        fuel_price_from_cache=bool((pricing.get("fuel_price_meta") or {}).get("fuel_price_from_cache", True)),
        fuel_price_message=(pricing.get("fuel_price_meta") or {}).get("fuel_price_message"),
        distance_confirmed=distance_confirmed,
        distance_warning=distance_warning,
        quote_status=quote_status,
        route_options=route_options_out,
        recommended_route_option_id=recommended_id,
        selected_route_option_id=selected_id,
        travel_time_hours=travel_hours,
        travel_time_label=travel_label,
    )
