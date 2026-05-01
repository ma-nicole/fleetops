"""Prescriptive analytics package (paper §3.2.8 part 2 + §3.2.9 A*)."""
from .routing_astar import optimize_route, build_default_graph
from .assignment import recommend_assignment
from .whatif import run_whatif

__all__ = [
    "optimize_route",
    "build_default_graph",
    "recommend_assignment",
    "run_whatif",
]
