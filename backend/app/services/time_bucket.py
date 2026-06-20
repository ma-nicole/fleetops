"""Shared time bucketing for analytics rollups (Y-Q-M-W-D)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Literal

Granularity = Literal["daily", "weekly", "monthly", "quarterly", "yearly"]

GRANULARITY_OPTIONS: list[Granularity] = [
    "yearly",
    "quarterly",
    "monthly",
    "weekly",
    "daily",
]


def advance_period(period: str, granularity: str, steps: int = 1) -> str:
    """Advance a period label by ``steps`` at the given granularity."""
    token = str(period or "").strip()
    if granularity == "yearly":
        return str(int(token) + steps)
    if granularity == "quarterly":
        year_s, quarter_s = token.split("-Q")
        year = int(year_s)
        quarter = int(quarter_s) + steps
        while quarter > 4:
            quarter -= 4
            year += 1
        while quarter < 1:
            quarter += 4
            year -= 1
        return f"{year}-Q{quarter}"
    if granularity == "monthly":
        year = int(token[:4])
        month = int(token[5:7])
        total = (year * 12 + (month - 1)) + steps
        return f"{total // 12:04d}-{total % 12 + 1:02d}"
    if granularity == "weekly":
        year_s, week_s = token.split("-W")
        year = int(year_s)
        week = int(week_s) + steps
        while week > 52:
            week -= 52
            year += 1
        while week < 1:
            week += 52
            year -= 1
        return f"{year}-W{week:02d}"
    if granularity == "daily":
        d = date.fromisoformat(token[:10])
        return (d + timedelta(days=steps)).isoformat()
    return token


def period_date_range(period: str, granularity: str) -> tuple[str, str] | None:
    """Return inclusive ISO date range (from, to) for a period label."""
    token = str(period or "").strip()
    if granularity == "yearly" and len(token) == 4 and token.isdigit():
        return f"{token}-01-01", f"{token}-12-31"
    if granularity == "quarterly" and "-Q" in token:
        year_s, quarter_s = token.split("-Q")
        year = int(year_s)
        quarter = int(quarter_s)
        start_month = (quarter - 1) * 3 + 1
        end_month = start_month + 2
        if end_month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, end_month + 1, 1)
        last_day = next_month - timedelta(days=1)
        return date(year, start_month, 1).isoformat(), last_day.isoformat()
    if granularity == "monthly" and len(token) == 7 and token[4] == "-":
        year = int(token[:4])
        month = int(token[5:7])
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        last_day = next_month - timedelta(days=1)
        return date(year, month, 1).isoformat(), last_day.isoformat()
    if granularity == "daily" and len(token) >= 10:
        return token[:10], token[:10]
    if granularity == "weekly" and "-W" in token:
        year_s, week_s = token.split("-W")
        year = int(year_s)
        week = int(week_s)
        jan4 = date(year, 1, 4)
        monday_week1 = jan4 - timedelta(days=jan4.isoweekday() - 1)
        monday = monday_week1 + timedelta(weeks=week - 1)
        sunday = monday + timedelta(days=6)
        return monday.isoformat(), sunday.isoformat()
    return None


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
