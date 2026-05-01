"""Weekly schedule board endpoints (paper Fig 16, 17)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import User, UserRole
from app.services.scheduler import (
    driver_week_board,
    find_available_driver,
    find_available_helper,
    find_available_truck,
    truck_week_board,
)


router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("/trucks")
def trucks_week_view(
    week: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    return truck_week_board(db, week)


@router.get("/drivers")
def drivers_week_view(
    week: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    return driver_week_board(db, week)


@router.get("/availability")
def availability_for_date(
    scheduled_date: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    from datetime import date as date_cls

    target = date_cls.fromisoformat(scheduled_date)
    truck = find_available_truck(db, target)
    driver = find_available_driver(db, target)
    helper = find_available_helper(db, target)
    return {
        "date": scheduled_date,
        "truck": {"id": truck.id, "code": truck.code, "capacity_tons": truck.capacity_tons} if truck else None,
        "driver": {"id": driver.id, "name": driver.full_name} if driver else None,
        "helper": {"id": helper.id, "name": helper.full_name} if helper else None,
    }
