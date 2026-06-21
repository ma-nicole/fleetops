"""Procedural helpers for seed_db.py — history span and booking schedule (no hardcoded dates)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from app.models.entities import BookingStatus


@dataclass(frozen=True)
class SeedHistoryConfig:
    history_start: date
    history_end: date
    interval_days: int = 6
    min_recent_days: int = 14

    def __post_init__(self) -> None:
        if self.history_end < self.history_start:
            raise ValueError("history_end must be on or after history_start")
        if self.interval_days < 1:
            raise ValueError("interval_days must be at least 1")
        if self.min_recent_days < 0:
            raise ValueError("min_recent_days must be non-negative")

    @property
    def span_days(self) -> int:
        return (self.history_end - self.history_start).days


def booking_count_for_span(config: SeedHistoryConfig) -> int:
    """Auto-compute booking count to cover history_start..history_end at interval_days spacing."""
    usable = max(config.span_days - config.min_recent_days, config.interval_days)
    return max(96, usable // config.interval_days + 1)


def days_ago_for_seq(seq: int, total: int, config: SeedHistoryConfig) -> int:
    """
    Map seq 0 → oldest (near history_start), seq total-1 → newest (~min_recent_days before history_end).
    """
    if total <= 1:
        return config.min_recent_days
    max_days_ago = max(config.span_days, config.min_recent_days)
    min_days_ago = config.min_recent_days
    progress = seq / (total - 1)
    return int(min_days_ago + progress * (max_days_ago - min_days_ago))


def scheduled_date_for_seq(seq: int, total: int, config: SeedHistoryConfig) -> date:
    days_ago = days_ago_for_seq(seq, total, config)
    scheduled = config.history_end - timedelta(days=days_ago)
    if scheduled < config.history_start:
        return config.history_start
    return scheduled


def booking_status_for(seq: int, days_ago: int, total: int) -> BookingStatus:
    """Deterministic status mix — older bookings complete; recent window keeps active deliveries."""
    if days_ago > 90:
        return BookingStatus.COMPLETED
    if days_ago > 45:
        return BookingStatus.COMPLETED if seq % 4 != 0 else BookingStatus.ASSIGNED
    if days_ago > 21:
        mix = (
            BookingStatus.COMPLETED,
            BookingStatus.ASSIGNED,
            BookingStatus.LOADING,
            BookingStatus.OUT_FOR_DELIVERY,
        )
        return mix[seq % len(mix)]
    if days_ago > 7:
        mix = (
            BookingStatus.OUT_FOR_DELIVERY,
            BookingStatus.LOADING,
            BookingStatus.ASSIGNED,
            BookingStatus.COMPLETED,
        )
        return mix[seq % len(mix)]
    mix = (
        BookingStatus.OUT_FOR_DELIVERY,
        BookingStatus.LOADING,
        BookingStatus.ASSIGNED,
        BookingStatus.ASSIGNED,
    )
    status = mix[seq % len(mix)]

    if seq >= total - 2:
        status = BookingStatus.PENDING_APPROVAL
    return status


def maintenance_days_ago(idx: int, total: int, config: SeedHistoryConfig) -> int:
    """Spread maintenance records across the full history span."""
    if total <= 1:
        return 0
    max_days = max(config.span_days, 1)
    return int(idx * max_days / (total - 1))


def parse_seed_date(value: str) -> date:
    return date.fromisoformat(value.strip())
