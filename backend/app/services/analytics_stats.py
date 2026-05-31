"""Statistical summaries and empty-state helpers for analytics reports."""
from __future__ import annotations

import math
from typing import Any

MIN_SAMPLES_FOR_SPREAD = 2


def compute_statistics(values: list[float], *, min_samples: int = 1) -> dict[str, float] | None:
    """Return min/max/avg/median/subtotal/std_dev from real values only."""
    if len(values) < min_samples:
        return None
    sorted_v = sorted(values)
    n = len(sorted_v)
    subtotal = sum(sorted_v)
    avg = subtotal / n
    if n % 2:
        median = sorted_v[n // 2]
    else:
        median = (sorted_v[n // 2 - 1] + sorted_v[n // 2]) / 2
    if n >= MIN_SAMPLES_FOR_SPREAD:
        variance = sum((x - avg) ** 2 for x in sorted_v) / n
        std_dev = math.sqrt(variance)
    else:
        std_dev = None
    result: dict[str, Any] = {
        "minimum": round(sorted_v[0], 2),
        "maximum": round(sorted_v[-1], 2),
        "average": round(avg, 2),
        "median": round(median, 2),
        "subtotal": round(subtotal, 2),
        "count": n,
    }
    if std_dev is not None:
        result["standard_deviation"] = round(std_dev, 2)
    else:
        result["standard_deviation"] = None
        result["insufficient_for_spread"] = True
    return result


def empty_module(message: str = "No data available yet.") -> dict[str, Any]:
    return {"empty": True, "message": message}


def insufficient_metric() -> None:
    return None
