"""A* routing optimization (paper §3.2.9 + §3.2.9.1).

Edge cost g(n) = FuelCost + TollCost + TimePenalty + MaintenancePenalty
Heuristic h(n) = great-circle-style distance × cost-per-km estimate
Constraints: truck-ban windows (paper Fig 25) filter out edges that pass
through a banned segment in the requested departure window.
"""
from __future__ import annotations

import json
import os
from typing import Iterable

import networkx as nx
from sqlalchemy.orm import Session

from app.models.entities import TruckBanRule
from app.schemas.predict import (
    RouteCandidate,
    RouteEdge,
    RouteOptimizeRequest,
    RouteOptimizeResponse,
)


# A small Northern-Luzon flavored network usable when no external graph
# is provided. Coordinates are illustrative (used only for the heuristic).
DEFAULT_NODES: dict[str, tuple[float, float]] = {
    "Warehouse-Tarlac": (15.48, 120.59),
    "Hub-Pampanga": (15.04, 120.69),
    "SMC-Plant-Bulacan": (14.82, 120.97),
    "Hub-Manila-North": (14.65, 121.03),
    "Hub-Cabanatuan": (15.49, 120.97),
    "Hub-Baguio": (16.41, 120.59),
    "Customer-Pasig": (14.58, 121.06),
    "Customer-QC": (14.66, 121.04),
    "Customer-Makati": (14.55, 121.02),
    "Customer-Manila": (14.59, 120.98),
    "Customer-Caloocan": (14.65, 120.97),
}

DEFAULT_EDGES: list[tuple[str, str, dict]] = [
    ("Warehouse-Tarlac", "Hub-Pampanga", {"distance_km": 60, "road_class": "highway"}),
    ("Warehouse-Tarlac", "Hub-Cabanatuan", {"distance_km": 75, "road_class": "highway"}),
    ("Warehouse-Tarlac", "Hub-Baguio", {"distance_km": 110, "road_class": "rough"}),
    ("Hub-Pampanga", "SMC-Plant-Bulacan", {"distance_km": 45, "road_class": "highway"}),
    ("Hub-Pampanga", "Hub-Manila-North", {"distance_km": 70, "road_class": "urban"}),
    ("Hub-Cabanatuan", "Hub-Manila-North", {"distance_km": 95, "road_class": "highway"}),
    ("SMC-Plant-Bulacan", "Hub-Manila-North", {"distance_km": 30, "road_class": "urban"}),
    ("Hub-Manila-North", "Customer-QC", {"distance_km": 12, "road_class": "urban"}),
    ("Hub-Manila-North", "Customer-Caloocan", {"distance_km": 8, "road_class": "urban"}),
    ("Customer-QC", "Customer-Pasig", {"distance_km": 10, "road_class": "urban"}),
    ("Customer-QC", "Customer-Makati", {"distance_km": 15, "road_class": "urban"}),
    ("Customer-Makati", "Customer-Manila", {"distance_km": 7, "road_class": "urban"}),
    ("Customer-Pasig", "Customer-Makati", {"distance_km": 9, "road_class": "urban"}),
    ("SMC-Plant-Bulacan", "Customer-Caloocan", {"distance_km": 22, "road_class": "highway"}),
]

ROAD_FACTORS = {"highway": 1.00, "urban": 1.08, "rough": 1.15}


def _load_external_graph() -> tuple[dict, list] | None:
    """Allow operators to drop a `data/road_graph.json` file at runtime."""
    here = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    candidates = [
        os.path.join(here, "data", "road_graph.json"),
        os.path.join(os.getcwd(), "data", "road_graph.json"),
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as handle:
                    payload = json.load(handle)
                return payload.get("nodes", DEFAULT_NODES), payload.get("edges", DEFAULT_EDGES)
            except Exception:
                return None
    return None


def build_default_graph() -> nx.Graph:
    nodes_data, edges_data = _load_external_graph() or (DEFAULT_NODES, DEFAULT_EDGES)
    graph = nx.Graph()
    for name, coords in nodes_data.items():
        graph.add_node(name, lat=coords[0], lng=coords[1])
    for src, dst, attrs in edges_data:
        graph.add_edge(src, dst, **attrs)
    return graph


def _ban_segments(db: Session, departure_hour: int) -> set[str]:
    """Return road-segment names banned at the requested hour."""
    rules: Iterable[TruckBanRule] = db.query(TruckBanRule).filter(TruckBanRule.is_active.is_(True)).all()
    banned: set[str] = set()
    for rule in rules:
        if rule.start_hour <= departure_hour < rule.end_hour:
            banned.add(rule.road_segment)
    return banned


def _edge_costs(
    distance_km: float,
    road_class: str,
    cargo_weight_tons: float,
    fuel_price: float = 60.0,
    fuel_efficiency: float = 4.0,
    toll_rate: float = 1.5,
    labor_rate_per_hour: float = 100.0,
    avg_speed_kmh: float = 50.0,
) -> tuple[float, float, float, float, float]:
    """Compute (fuel, toll, time_penalty, maintenance_penalty, total) for one edge.

    Matches paper §3.2.9 step 18 — g(n) = FuelCost + TollCost + TimePenalty + MaintenancePenalty.
    """
    road_factor = ROAD_FACTORS.get(road_class, 1.0)
    load_factor = 1 + (cargo_weight_tons * 0.02)
    fuel_liters = (distance_km / max(1.0, fuel_efficiency)) * load_factor * road_factor
    fuel_cost = fuel_liters * fuel_price
    toll_cost = distance_km * toll_rate
    time_hours = distance_km / max(1.0, avg_speed_kmh)
    time_penalty = time_hours * labor_rate_per_hour * 0.10  # 10% of labor used as time penalty
    maintenance_penalty = distance_km * 0.5 * road_factor  # rough roads wear faster
    total = fuel_cost + toll_cost + time_penalty + maintenance_penalty
    return (
        round(fuel_cost, 2),
        round(toll_cost, 2),
        round(time_penalty, 2),
        round(maintenance_penalty, 2),
        round(total, 2),
    )


def _heuristic_factory(end: str, graph: nx.Graph):
    end_node = graph.nodes.get(end, {})
    end_lat, end_lng = end_node.get("lat"), end_node.get("lng")

    def heuristic(node: str, _target: str) -> float:
        n = graph.nodes.get(node, {})
        lat, lng = n.get("lat"), n.get("lng")
        if None in (lat, lng, end_lat, end_lng):
            return 0.0
        # ~111km per degree (rough)
        return ((lat - end_lat) ** 2 + (lng - end_lng) ** 2) ** 0.5 * 111.0 * 30.0

    return heuristic


def _path_cost(
    graph: nx.Graph,
    path: list[str],
    cargo_weight_tons: float,
) -> tuple[float, float, float, float, float, list[RouteEdge]]:
    fuel_total = toll_total = time_total = maint_total = total = 0.0
    edges: list[RouteEdge] = []
    for i in range(len(path) - 1):
        a, b = path[i], path[i + 1]
        edge = graph[a][b]
        fuel, toll, t_pen, m_pen, sub = _edge_costs(
            distance_km=edge.get("distance_km", 1),
            road_class=edge.get("road_class", "highway"),
            cargo_weight_tons=cargo_weight_tons,
        )
        fuel_total += fuel
        toll_total += toll
        time_total += t_pen
        maint_total += m_pen
        total += sub
        edges.append(RouteEdge(
            from_node=a,
            to_node=b,
            distance_km=edge.get("distance_km", 1),
            fuel_cost=fuel,
            toll_cost=toll,
            time_penalty=t_pen,
            maintenance_penalty=m_pen,
        ))
    return fuel_total, toll_total, time_total, maint_total, total, edges


def optimize_route(req: RouteOptimizeRequest, db: Session) -> RouteOptimizeResponse:
    graph = build_default_graph()

    if req.origin not in graph or req.destination not in graph:
        return RouteOptimizeResponse(
            candidates=[],
            selected_rank=0,
            constraints_applied=[
                f"origin '{req.origin}' or destination '{req.destination}' not present in the road graph",
            ],
        )

    banned = _ban_segments(db, req.departure_hour)

    # Apply constraints by removing banned edges (paper Fig 25)
    constraint_log: list[str] = []
    if banned:
        constraint_log.append(f"Truck-ban active: {sorted(banned)} at hour {req.departure_hour}")
        for rule_name in banned:
            for u, v, data in list(graph.edges(data=True)):
                if rule_name.lower() in (u.lower(), v.lower()):
                    graph.remove_edge(u, v)

    if not nx.has_path(graph, req.origin, req.destination):
        return RouteOptimizeResponse(
            candidates=[],
            selected_rank=0,
            constraints_applied=constraint_log + ["No feasible path after constraints applied"],
        )

    # Build a cost-weighted view for A*
    weighted = nx.Graph()
    for u, v, data in graph.edges(data=True):
        _, _, _, _, total = _edge_costs(
            distance_km=data.get("distance_km", 1),
            road_class=data.get("road_class", "highway"),
            cargo_weight_tons=req.cargo_weight_tons,
        )
        weight_value = {
            "cost": total,
            "distance": data.get("distance_km", 1),
            "time": data.get("distance_km", 1) / 50.0,
        }.get(req.weight, total)
        weighted.add_edge(u, v, weight=weight_value)

    heuristic = _heuristic_factory(req.destination, graph)
    primary = nx.astar_path(weighted, req.origin, req.destination, heuristic=heuristic, weight="weight")

    # Generate top-3 alternative simple paths up to 7 nodes (cap exploration)
    alt_paths: list[list[str]] = []
    try:
        for path in nx.shortest_simple_paths(weighted, req.origin, req.destination, weight="weight"):
            if path == primary:
                continue
            alt_paths.append(path)
            if len(alt_paths) >= 2:
                break
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        pass

    candidates: list[RouteCandidate] = []
    for rank, path in enumerate([primary, *alt_paths], start=1):
        fuel_total, toll_total, time_total, maint_total, total, edges = _path_cost(
            graph, path, req.cargo_weight_tons
        )
        explanation = [
            f"Hops: {len(path)}",
            f"Distance: {round(sum(e.distance_km for e in edges), 1)} km",
            f"Time penalty: ₱{round(time_total, 2)}",
            f"Maintenance penalty: ₱{round(maint_total, 2)}",
        ]
        candidates.append(
            RouteCandidate(
                rank=rank,
                path=path,
                distance_km=round(sum(e.distance_km for e in edges), 2),
                fuel_cost=round(fuel_total, 2),
                toll_cost=round(toll_total, 2),
                time_penalty=round(time_total, 2),
                maintenance_penalty=round(maint_total, 2),
                total_cost=round(total, 2),
                edges=edges,
                explanation=explanation,
            )
        )

    return RouteOptimizeResponse(
        candidates=candidates,
        selected_rank=1,
        constraints_applied=constraint_log or ["No active truck-ban constraints"],
    )
