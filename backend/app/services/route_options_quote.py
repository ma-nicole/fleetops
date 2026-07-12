"""Build customer-facing multi-route quote options from road alternatives + freight pricing."""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.constants.fleet_capacity import DEFAULT_ROAD_SPEED_KMH_FOR_ETA, MIN_TRIP_DURATION_HOURS
from app.core.config import Settings
from app.services.booking_pricing import pricing_with_toll_matrix
from app.services.geocoding import geocode_coordinates
from app.services.road_routing import RoadRouteOption, driving_route_alternatives
from app.services.route_estimate import PreciseDistanceUnavailable, estimate_road_distance_km
from app.services.toll_matrix import DEFAULT_VEHICLE_CLASS


def format_travel_time_label(hours: float) -> str:
    total_min = max(1, int(round(float(hours) * 60)))
    h, m = divmod(total_min, 60)
    if h <= 0:
        return f"{m} min"
    if m <= 0:
        return f"{h} hr"
    return f"{h} hr {m} min"


def travel_hours_for_option(opt: RoadRouteOption) -> float:
    if opt.duration_seconds is not None and opt.duration_seconds > 0:
        return max(0.05, float(opt.duration_seconds) / 3600.0)
    return max(MIN_TRIP_DURATION_HOURS, float(opt.distance_km) / DEFAULT_ROAD_SPEED_KMH_FOR_ETA)


def route_option_id(provider: str, index: int) -> str:
    return f"{provider}:{index}"


@dataclass(frozen=True)
class PricedRouteOption:
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
    summary: str | None


def _label_for_rank(rank: int, *, is_recommended: bool, summary: str | None) -> str:
    if is_recommended:
        base = "Recommended"
    else:
        base = f"Alternative {rank - 1}" if rank > 1 else "Route option"
    if summary:
        return f"{base} ({summary})"
    return base


def resolve_road_alternatives_for_quote(
    pickup: str,
    dropoff: str,
    settings: Settings,
) -> tuple[list[RoadRouteOption], str, str, str]:
    """
    Returns (options, routing_method, pickup_provider, dropoff_provider).
    Raises PreciseDistanceUnavailable when strict routing cannot produce a path.
    """
    plat, plon, pprov = geocode_coordinates(pickup, settings)
    dlat, dlon, dprov = geocode_coordinates(dropoff, settings)
    if plat is None or plon is None or dlat is None or dlon is None:
        # Fall through to existing single-route estimator (raises when strict).
        est = estimate_road_distance_km(pickup, dropoff, settings)
        opt = RoadRouteOption(
            distance_km=float(est.distance_km),
            duration_seconds=None,
            provider=est.routing_method,
            index=0,
            summary=None,
        )
        return [opt], est.routing_method, est.pickup_provider, est.dropoff_provider

    if abs(float(plat) - float(dlat)) < 1e-7 and abs(float(plon) - float(dlon)) < 1e-7:
        opt = RoadRouteOption(
            distance_km=0.0,
            duration_seconds=0.0,
            provider="same_location",
            index=0,
            summary=None,
        )
        return [opt], "same_location", pprov, dprov

    opts, provider = driving_route_alternatives(
        float(plat),
        float(plon),
        float(dlat),
        float(dlon),
        settings,
        max_options=3,
        want_alternatives=True,
    )
    if opts and provider != "unavailable":
        return opts, provider, pprov, dprov

    # Preserve existing single-route behavior when alternates are unavailable.
    est = estimate_road_distance_km(pickup, dropoff, settings)
    opt = RoadRouteOption(
        distance_km=float(est.distance_km),
        duration_seconds=None,
        provider=est.routing_method,
        index=0,
        summary=None,
    )
    return [opt], est.routing_method, est.pickup_provider, est.dropoff_provider


def build_priced_route_options(
    db: Session,
    *,
    pickup_location: str,
    dropoff_location: str,
    cargo_weight_tons: float,
    settings: Settings,
    vehicle_class: str = DEFAULT_VEHICLE_CLASS,
    manual_entry: str | None = None,
    manual_exit: str | None = None,
    road_options: list[RoadRouteOption],
    routing_method: str,
    selected_option_id: str | None = None,
) -> list[PricedRouteOption]:
    """Price each road option with existing freight + toll matrix helpers."""
    if not road_options:
        return []

    # Routing optimization: provider's first path is the recommended route.
    recommended_raw_id = route_option_id(road_options[0].provider, road_options[0].index)

    priced: list[PricedRouteOption] = []
    for rank, opt in enumerate(road_options, start=1):
        oid = route_option_id(opt.provider, opt.index)
        pricing, _toll_meta = pricing_with_toll_matrix(
            db,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            cargo_weight_tons=cargo_weight_tons,
            distance_km=float(opt.distance_km),
            settings=settings,
            vehicle_class=vehicle_class,
            manual_entry=manual_entry,
            manual_exit=manual_exit,
        )
        hours = travel_hours_for_option(opt)
        is_recommended = oid == recommended_raw_id
        priced.append(
            PricedRouteOption(
                id=oid,
                label=_label_for_rank(rank, is_recommended=is_recommended, summary=opt.summary),
                rank=rank,
                is_recommended=is_recommended,
                distance_km=round(float(opt.distance_km), 2),
                travel_time_hours=round(hours, 2),
                travel_time_label=format_travel_time_label(hours),
                estimated_fuel_cost_php=round(float(pricing["diesel_cost_php"]), 2),
                estimated_toll_cost_php=round(float(pricing["toll_fees_php"]), 2),
                quoted_total_php=round(float(pricing["quoted_total"]), 2),
                routing_method=routing_method or opt.provider,
                summary=opt.summary,
            )
        )

    # Keep recommended first; preserve relative order of the rest.
    priced.sort(key=lambda r: (0 if r.is_recommended else 1, r.rank))

    rebuilt: list[PricedRouteOption] = []
    for i, row in enumerate(priced, start=1):
        rebuilt.append(
            PricedRouteOption(
                id=row.id,
                label=_label_for_rank(i, is_recommended=row.is_recommended, summary=row.summary),
                rank=i,
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
    return rebuilt


def pick_selected_option(
    options: list[PricedRouteOption],
    selected_option_id: str | None,
) -> PricedRouteOption | None:
    if not options:
        return None
    if selected_option_id:
        for opt in options:
            if opt.id == selected_option_id:
                return opt
    for opt in options:
        if opt.is_recommended:
            return opt
    return options[0]
