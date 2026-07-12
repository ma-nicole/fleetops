"""Automatic diesel price retrieval with cache fallback for booking quotations.

No stable public DOE API exists for retail pump prices. This service:
1. Fetches from a configurable trusted URL (JSON preferred).
2. Falls back to a bundled seed file when the URL is unset or fails.
3. Always caches the latest successful price on BookingFreightSettings so
   quotations never break when the external source is unavailable.
4. Preserves the existing (km / 4) × diesel_₱/L fuel formula.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.core.config import Settings, settings as app_settings
from app.models.entities import BookingFreightSettings
from app.services.booking_freight_knobs import ensure_booking_freight_row

logger = logging.getLogger(__name__)

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "fuel_price_cache.json"
SOURCE_ADMIN_MANUAL = "admin_manual"
SOURCE_ENV_SEED = "env_seed"
SOURCE_BUNDLED_CACHE = "bundled_cache"
SOURCE_EXTERNAL_PREFIX = "external:"


@dataclass
class FuelPriceSnapshot:
    diesel_price_php_per_liter: float
    source: str
    fetched_at: datetime
    from_cache: bool
    refresh_attempted: bool
    refresh_ok: bool
    message: str | None = None


def _parse_price(raw: Any) -> float | None:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if not (1.0 <= value <= 500.0):
        return None
    return round(value, 2)


def _load_seed_file() -> dict[str, Any] | None:
    if not SEED_PATH.is_file():
        return None
    try:
        return json.loads(SEED_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("fuel price seed unreadable: %s", exc)
        return None


def _parse_json_payload(payload: dict[str, Any]) -> tuple[float, str, datetime] | None:
    price = None
    for key in (
        "diesel_php_per_liter",
        "diesel_price_php_per_liter",
        "diesel_common_price",
        "diesel",
        "price",
    ):
        if key in payload:
            price = _parse_price(payload.get(key))
            if price is not None:
                break
    if price is None and isinstance(payload.get("prices"), dict):
        prices = payload["prices"]
        for key in ("diesel", "DIESEL", "Diesel"):
            price = _parse_price(prices.get(key))
            if price is not None:
                break
    if price is None:
        return None

    source = str(payload.get("source") or payload.get("source_name") or "external_json").strip() or "external_json"
    as_of_raw = payload.get("as_of") or payload.get("updated_at") or payload.get("fetched_at")
    fetched_at = datetime.utcnow()
    if isinstance(as_of_raw, str) and as_of_raw.strip():
        try:
            text = as_of_raw.strip().replace("Z", "+00:00")
            fetched_at = datetime.fromisoformat(text[:19])
        except ValueError:
            pass
    return price, source, fetched_at


def _parse_html_diesel_common(html: str) -> float | None:
    """Best-effort extract of DOE-style 'Diesel ... Common Price' tables."""
    # Prefer an explicit common-price cell near Diesel.
    patterns = [
        r"Diesel[^0-9]{0,80}?Common Price[^0-9]{0,40}?(\d{2,3}(?:\.\d{1,2})?)",
        r"Diesel\s*\|\s*[\d.]+\s*\|\s*[\d.]+\s*\|\s*(\d{2,3}(?:\.\d{1,2})?)",
        r'"Diesel"\s*:\s*(\d{2,3}(?:\.\d{1,2})?)',
        r"DIESEL[^0-9]{0,40}?(\d{2,3}(?:\.\d{1,2})?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
        if match:
            price = _parse_price(match.group(1))
            if price is not None:
                return price
    return None


def fetch_fuel_price_from_url(url: str, *, timeout_sec: float = 8.0) -> tuple[float, str, datetime] | None:
    req = Request(url, headers={"User-Agent": "FleetOpsFuelPriceService/1.0", "Accept": "application/json,text/html,*/*"})
    try:
        with urlopen(req, timeout=timeout_sec) as resp:
            raw = resp.read()
            content_type = (resp.headers.get("Content-Type") or "").lower()
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        logger.warning("fuel price fetch failed url=%s err=%s", url, exc)
        return None

    text = raw.decode("utf-8", errors="replace")
    if "json" in content_type or text.lstrip().startswith(("{", "[")):
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            payload = None
        if isinstance(payload, list) and payload and isinstance(payload[0], dict):
            payload = payload[0]
        if isinstance(payload, dict):
            parsed = _parse_json_payload(payload)
            if parsed:
                price, source, fetched_at = parsed
                return price, f"{SOURCE_EXTERNAL_PREFIX}{source}", fetched_at

    price = _parse_html_diesel_common(text)
    if price is None:
        return None
    return price, f"{SOURCE_EXTERNAL_PREFIX}html", datetime.utcnow()


def _apply_price(
    row: BookingFreightSettings,
    *,
    price: float,
    source: str,
    fetched_at: datetime,
) -> BookingFreightSettings:
    row.diesel_price_php_per_liter = float(price)
    row.diesel_price_source = (source or SOURCE_BUNDLED_CACHE)[:128]
    row.diesel_price_fetched_at = fetched_at
    row.updated_at = datetime.utcnow()
    return row


def _snapshot_from_row(
    row: BookingFreightSettings,
    *,
    from_cache: bool,
    refresh_attempted: bool,
    refresh_ok: bool,
    message: str | None = None,
) -> FuelPriceSnapshot:
    fetched_at = row.diesel_price_fetched_at or row.updated_at or datetime.utcnow()
    source = (row.diesel_price_source or SOURCE_ADMIN_MANUAL).strip() or SOURCE_ADMIN_MANUAL
    return FuelPriceSnapshot(
        diesel_price_php_per_liter=float(row.diesel_price_php_per_liter),
        source=source,
        fetched_at=fetched_at,
        from_cache=from_cache,
        refresh_attempted=refresh_attempted,
        refresh_ok=refresh_ok,
        message=message,
    )


def fuel_price_meta_dict(snap: FuelPriceSnapshot) -> dict[str, Any]:
    return {
        "diesel_price_php_per_liter": snap.diesel_price_php_per_liter,
        "fuel_price_source": snap.source,
        "fuel_price_fetched_at": snap.fetched_at.isoformat() if snap.fetched_at else None,
        "fuel_price_from_cache": snap.from_cache,
        "fuel_price_refresh_ok": snap.refresh_ok,
        "fuel_price_message": snap.message,
    }


def ensure_fuel_price_for_quote(
    db: Session,
    app: Settings | None = None,
    *,
    force_refresh: bool = False,
) -> FuelPriceSnapshot:
    """Ensure diesel ₱/L is available for quotations. Never raises for network failures."""
    cfg = app if app is not None else app_settings
    row = ensure_booking_freight_row(db, cfg)

    # First-time source annotation when seeded from env only.
    if not (row.diesel_price_source or "").strip():
        row.diesel_price_source = SOURCE_ENV_SEED
        row.diesel_price_fetched_at = row.updated_at or datetime.utcnow()
        db.add(row)
        db.commit()
        db.refresh(row)

    ttl_hours = max(1.0, float(getattr(cfg, "fuel_price_cache_ttl_hours", 24.0) or 24.0))
    fetched_at = row.diesel_price_fetched_at or row.updated_at
    is_fresh = bool(fetched_at and datetime.utcnow() - fetched_at < timedelta(hours=ttl_hours))
    source = (row.diesel_price_source or "").strip()
    # Do not auto-overwrite an explicit admin override unless forced.
    if source == SOURCE_ADMIN_MANUAL and not force_refresh:
        return _snapshot_from_row(
            row,
            from_cache=True,
            refresh_attempted=False,
            refresh_ok=True,
            message="Using admin-configured diesel price.",
        )
    if is_fresh and not force_refresh:
        return _snapshot_from_row(
            row,
            from_cache=True,
            refresh_attempted=False,
            refresh_ok=True,
            message="Using cached diesel price.",
        )

    url = (getattr(cfg, "fuel_price_source_url", None) or "").strip()
    refresh_attempted = True
    if url:
        fetched = fetch_fuel_price_from_url(url, timeout_sec=float(getattr(cfg, "fuel_price_fetch_timeout_sec", 8.0) or 8.0))
        if fetched:
            price, src, at = fetched
            _apply_price(row, price=price, source=src, fetched_at=at)
            db.add(row)
            db.commit()
            db.refresh(row)
            return _snapshot_from_row(
                row,
                from_cache=False,
                refresh_attempted=True,
                refresh_ok=True,
                message="Diesel price refreshed from configured source.",
            )

    seed = _load_seed_file()
    if seed:
        parsed = _parse_json_payload(seed)
        if parsed:
            price, src, at = parsed
            # Only apply seed when we have no usable cached price, or force refresh failed.
            if force_refresh or not fetched_at or float(row.diesel_price_php_per_liter or 0) <= 0:
                _apply_price(row, price=price, source=f"{SOURCE_BUNDLED_CACHE}:{src}", fetched_at=at)
                db.add(row)
                db.commit()
                db.refresh(row)
                return _snapshot_from_row(
                    row,
                    from_cache=False,
                    refresh_attempted=refresh_attempted,
                    refresh_ok=True,
                    message="Diesel price loaded from bundled cache seed.",
                )

    # Always fall back to the most recently cached DB price.
    return _snapshot_from_row(
        row,
        from_cache=True,
        refresh_attempted=refresh_attempted,
        refresh_ok=False,
        message="External fuel source unavailable; using last cached diesel price.",
    )


def mark_admin_manual_fuel_price(row: BookingFreightSettings) -> None:
    row.diesel_price_source = SOURCE_ADMIN_MANUAL
    row.diesel_price_fetched_at = datetime.utcnow()
