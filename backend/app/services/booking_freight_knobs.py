"""Resolve diesel / driver / helper knobs for customer freight quotes (DB row or app Settings)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import Settings, settings as app_settings
from app.models.entities import BookingFreightSettings


def ensure_booking_freight_row(db: Session, app: Settings | None = None) -> BookingFreightSettings:
    """Ensure singleton id=1 exists, seeded from Settings when first needed."""
    cfg = app if app is not None else app_settings
    row = db.query(BookingFreightSettings).filter(BookingFreightSettings.id == 1).first()
    if row:
        return row
    row = BookingFreightSettings(
        id=1,
        diesel_price_php_per_liter=float(cfg.diesel_price_php_per_liter),
        diesel_price_source="env_seed",
        diesel_price_fetched_at=None,
        toll_fees_php_per_trip=float(cfg.toll_fees_php_per_trip),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def resolve_booking_freight_knobs(db: Session, app: Settings | None = None) -> BookingFreightSettings:
    return ensure_booking_freight_row(db, app)


def booking_freight_knobs_to_dict(row: BookingFreightSettings) -> dict:
    return {
        "id": row.id,
        "diesel_price_php_per_liter": float(row.diesel_price_php_per_liter),
        "diesel_price_source": row.diesel_price_source,
        "diesel_price_fetched_at": row.diesel_price_fetched_at.isoformat() if row.diesel_price_fetched_at else None,
        "toll_fees_php_per_trip": float(row.toll_fees_php_per_trip),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
