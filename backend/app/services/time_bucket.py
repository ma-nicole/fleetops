"""Shared time bucketing for analytics rollups (Y-Q-M-W-D)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any, Literal

Granularity = Literal["daily", "weekly", "monthly", "quarterly", "yearly"]

GRANULARITY_OPTIONS: list[Granularity] = [
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
]


def period_key(dt: date | datetime | None, granularity: str) -> str | None:
    if dt is None:
        return None
    d = dt.date() if isinstance(dt, datetime) else dt
    if granularity == "daily":
        return d.isoformat()
    if granularity == "yearly":
        return str(d.year)
    if granularity == "quarterly":
        return f"{d.year}-Q{(d.month - 1) // 3 + 1}"
    if granularity == "monthly":
        return d.strftime("%Y-%m")
    if granularity == "weekly":
        iso = d.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    return None


def sort_period_keys(keys: list[str], granularity: str) -> list[str]:
    if granularity == "quarterly":
        return sorted(keys, key=lambda k: (int(k.split("-Q")[0]), int(k.split("-Q")[1])))
    if granularity == "weekly":
        return sorted(keys, key=lambda k: (int(k.split("-W")[0]), int(k.split("-W")[1])))
    if granularity == "daily":
        return sorted(keys)
    if granularity == "yearly":
        return sorted(keys, key=lambda k: int(k))
    return sorted(keys)


def series_from_buckets(
    buckets: dict[str, float],
    granularity: str,
    limit: int = 24,
    *,
    value_key: str = "value",
) -> list[dict[str, Any]]:
    keys = sort_period_keys(list(buckets.keys()), granularity)
    return [{**period_chart_row(k), value_key: round(buckets[k], 2)} for k in keys[-limit:]]


def period_chart_row(period: str, **fields: Any) -> dict[str, Any]:
    """Build a chart row with period axis; include month alias when monthly-shaped."""
    row: dict[str, Any] = {"period": period, **fields}
    if len(period) == 7 and period[4] == "-":
        row["month"] = period
    return row


def rollup_count_series(
    buckets: dict[str, int],
    granularity: str,
    limit: int = 24,
    *,
    count_key: str = "count",
) -> list[dict[str, Any]]:
    keys = sort_period_keys(list(buckets.keys()), granularity)
    return [period_chart_row(k, **{count_key: buckets[k]}) for k in keys[-limit:]]


def rollup_nested_series(
    buckets: dict[str, dict[str, float]],
    granularity: str,
    limit: int = 24,
) -> list[dict[str, Any]]:
    keys = sort_period_keys(list(buckets.keys()), granularity)
    rows: list[dict[str, Any]] = []
    for key in keys[-limit:]:
        bucket = buckets[key]
        row = period_chart_row(key, **{k: round(v, 2) for k, v in bucket.items()})
        rows.append(row)
    return rows


def add_to_bucket(buckets: dict[str, float], dt: date | datetime | None, granularity: str, amount: float) -> None:
    key = period_key(dt, granularity)
    if key:
        buckets[key] += amount


def add_to_count(buckets: dict[str, int], dt: date | datetime | None, granularity: str, count: int = 1) -> None:
    key = period_key(dt, granularity)
    if key:
        buckets[key] += count
