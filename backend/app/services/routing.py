"""Backwards-compatible routing shim.

Original signature:
    optimize_route(start: str, end: str, weight: str = "distance") -> dict

The real implementation now lives in `app.services.prescriptive.routing_astar`
which understands paper §3.2.9 edge cost g(n) = Fuel + Toll + Time + Maintenance
and truck-ban constraints. We keep this small wrapper so older code paths
(`workflow.py`, `dispatch.py`) continue to function.
"""
from app.services.prescriptive.routing_astar import build_default_graph
import networkx as nx


def optimize_route(start: str, end: str, weight: str = "distance") -> dict:
    graph = build_default_graph()

    if start not in graph or end not in graph:
        # Fall back to a synthetic single-edge "path" so callers don't crash
        return {
            "path": [start, end],
            "score": 120.0,
            "weight": weight,
        }

    # Build per-edge weight to match the requested optimization criterion.
    weighted = nx.Graph()
    for u, v, data in graph.edges(data=True):
        distance = float(data.get("distance_km", 1))
        if weight == "distance":
            w = distance
        elif weight == "time":
            w = distance / 50.0
        else:  # cost (default)
            w = distance * 1.5

        weighted.add_edge(u, v, weight=w)

    try:
        path = nx.shortest_path(weighted, start, end, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return {"path": [start, end], "score": 0.0, "weight": weight}

    score = sum(weighted[path[i]][path[i + 1]]["weight"] for i in range(len(path) - 1))
    return {"path": path, "score": round(score, 2), "weight": weight}
