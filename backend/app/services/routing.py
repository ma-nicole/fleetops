import networkx as nx


def build_route_graph() -> nx.Graph:
    graph = nx.Graph()

    # Example network graph. In production, these can be loaded from uploaded route data.
    edges = [
        ("Warehouse", "Hub-A", {"distance": 30, "time": 45, "cost": 25}),
        ("Hub-A", "Hub-B", {"distance": 20, "time": 30, "cost": 18}),
        ("Hub-B", "City-1", {"distance": 25, "time": 35, "cost": 20}),
        ("Warehouse", "City-2", {"distance": 60, "time": 80, "cost": 50}),
        ("City-2", "City-1", {"distance": 18, "time": 25, "cost": 14}),
    ]
    graph.add_edges_from(edges)
    return graph


def optimize_route(start: str, end: str, weight: str = "distance") -> dict:
    graph = build_route_graph()

    if start not in graph or end not in graph:
        return {"path": [], "score": 0}

    path = nx.astar_path(graph, start, end, weight=weight)
    score = 0
    for index in range(len(path) - 1):
        score += graph[path[index]][path[index + 1]].get(weight, 0)

    return {"path": path, "score": score, "weight": weight}
