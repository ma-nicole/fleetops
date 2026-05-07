"""Resolve diesel / driver / helper knobs for booking estimates (DB row or app Settings)."""

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
        truck_fuel_efficiency_kmpl=float(cfg.truck_fuel_efficiency_kmpl),
        trip_wear_misc_php_per_km=float(cfg.trip_wear_misc_php_per_km),
        trip_depreciation_rate=float(cfg.trip_depreciation_rate),
        helper_pay_php_per_trip=float(cfg.helper_pay_php_per_trip),
        driver_freight_commission_rate=float(cfg.driver_freight_commission_rate),
        cargo_weight_multiplier_per_ton=float(cfg.cargo_weight_multiplier_per_ton),
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
        "truck_fuel_efficiency_kmpl": float(row.truck_fuel_efficiency_kmpl),
        "trip_wear_misc_php_per_km": float(row.trip_wear_misc_php_per_km),
        "trip_depreciation_rate": float(row.trip_depreciation_rate),
        "helper_pay_php_per_trip": float(row.helper_pay_php_per_trip),
        "driver_freight_commission_rate": float(row.driver_freight_commission_rate),
        "cargo_weight_multiplier_per_ton": float(row.cargo_weight_multiplier_per_ton),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
