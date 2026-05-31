"""Admin analytics center — real DB records only."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import User, UserRole
from app.services.admin_analytics import AnalyticsFilters, build_admin_analytics

router = APIRouter(prefix="/admin/analytics", tags=["admin-analytics"])


def _parse_filters(
    date_from: date | None,
    date_to: date | None,
    driver_id: int | None,
    truck_id: int | None,
    route: str | None,
    shipment_status: str | None,
) -> AnalyticsFilters:
    return AnalyticsFilters(
        date_from=date_from,
        date_to=date_to,
        driver_id=driver_id,
        truck_id=truck_id,
        route=route.strip() if route else None,
        shipment_status=shipment_status.strip().lower() if shipment_status else None,
    )


@router.get("")
def admin_analytics_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    driver_id: int | None = Query(default=None),
    truck_id: int | None = Query(default=None),
    route: str | None = Query(default=None),
    shipment_status: str | None = Query(default=None),
):
    """Company-wide analytics for admin/manager; operational subset for dispatcher."""
    filters = _parse_filters(date_from, date_to, driver_id, truck_id, route, shipment_status)

    if user.role == UserRole.DISPATCHER:
        return build_admin_analytics(
            db,
            filters=filters,
            include_financial=False,
            include_clients=False,
        )

    if user.role not in {UserRole.ADMIN, UserRole.MANAGER}:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Analytics access not permitted for this role.")

    return build_admin_analytics(
        db,
        filters=filters,
        include_financial=True,
        include_clients=True,
    )


@router.get("/operational")
def dispatcher_operational_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.ADMIN, UserRole.MANAGER)),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    driver_id: int | None = Query(default=None),
    truck_id: int | None = Query(default=None),
    route: str | None = Query(default=None),
    shipment_status: str | None = Query(default=None),
):
    """Operational analytics without revenue, profit, or client contribution."""
    filters = _parse_filters(date_from, date_to, driver_id, truck_id, route, shipment_status)
    return build_admin_analytics(
        db,
        filters=filters,
        include_financial=False,
        include_clients=False,
    )
