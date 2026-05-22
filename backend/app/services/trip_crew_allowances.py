"""Per-trip driver/helper allowance resolution (cost tracking only — not payroll)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import PricingConfig, ServiceType

DEFAULT_DRIVER_ALLOWANCE_PHP = 120.0
DEFAULT_HELPER_ALLOWANCE_PHP = 80.0


def _default_driver_allowance(db: Session) -> float:
    cfg = db.query(PricingConfig).filter(PricingConfig.service_type == ServiceType.FIXED).first()
    if cfg and float(cfg.labor_rate or 0) > 0:
        return float(cfg.labor_rate)
    return DEFAULT_DRIVER_ALLOWANCE_PHP


def _default_helper_allowance(db: Session) -> float:
    cfg = db.query(PricingConfig).filter(PricingConfig.service_type == ServiceType.FIXED).first()
    if cfg and float(cfg.helper_rate or 0) > 0:
        return float(cfg.helper_rate)
    return DEFAULT_HELPER_ALLOWANCE_PHP


def resolve_trip_crew_allowances(
    db: Session,
    *,
    driver_allowance_php: float | None = None,
    helper_allowance_php: float | None = None,
) -> tuple[float, float]:
    """Return (driver_allowance_php, helper_allowance_php) for a new or updated trip leg."""
    driver = (
        round(max(0.0, float(driver_allowance_php)), 2)
        if driver_allowance_php is not None
        else round(max(0.0, _default_driver_allowance(db)), 2)
    )
    helper = (
        round(max(0.0, float(helper_allowance_php)), 2)
        if helper_allowance_php is not None
        else round(max(0.0, _default_helper_allowance(db)), 2)
    )
    return driver, helper
