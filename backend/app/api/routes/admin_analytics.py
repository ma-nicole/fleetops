"""Admin analytics center — real DB records only."""
from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import User, UserRole
from app.services.admin_analytics import AnalyticsFilters, build_admin_analytics
from app.services.ai_interpretation import generate_chart_interpretation, generate_expense_interpretation

router = APIRouter(prefix="/admin/analytics", tags=["admin-analytics"])
logger = logging.getLogger(__name__)


class ExpenseInterpretationCategory(BaseModel):
    key: str
    label: str
    amount_php: float = Field(ge=0)
    percentage: float = Field(ge=0)


class ExpenseInterpretationRequest(BaseModel):
    context_year: int
    quarter: int = Field(ge=1, le=4)
    quarter_label: str
    total_php: float = Field(ge=0)
    categories: list[ExpenseInterpretationCategory]
    largest: ExpenseInterpretationCategory
    smallest: ExpenseInterpretationCategory
    concentration: str


class ExpenseInterpretationResponse(BaseModel):
    interpretation: str


class ChartInterpretationItem(BaseModel):
    label: str | None = None
    status: str | None = None
    count: float | None = None
    value: float | None = None
    amount_php: float | None = None
    client_name: str | None = None
    truck_code: str | None = None
    driver_name: str | None = None
    route: str | None = None
    month: str | None = None


class ChartInterpretationRequest(BaseModel):
    section_title: str
    selection_label: str
    chart_type: str = "bar"
    items: list[ChartInterpretationItem] = Field(default_factory=list)
    record_count: int = Field(ge=0)
    statistics: dict[str, float | int | None] | None = None


class ChartInterpretationResponse(BaseModel):
    interpretation: str


def _parse_filters(
    date_from: date | None,
    date_to: date | None,
    driver_id: int | None,
    truck_id: int | None,
    route: str | None,
    shipment_status: str | None,
    granularity: str | None = None,
) -> AnalyticsFilters:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")
    valid_gran = {"daily", "weekly", "monthly", "quarterly", "yearly"}
    gran = (granularity or "monthly").strip().lower()
    if gran not in valid_gran:
        raise HTTPException(status_code=400, detail=f"Invalid granularity. Use one of: {', '.join(sorted(valid_gran))}")
    return AnalyticsFilters(
        date_from=date_from,
        date_to=date_to,
        driver_id=driver_id,
        truck_id=truck_id,
        route=route.strip() if route else None,
        shipment_status=shipment_status.strip().lower() if shipment_status else None,
        granularity=gran,  # type: ignore[arg-type]
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
    granularity: str | None = Query(default="monthly"),
):
    """Company-wide analytics for admin/manager; operational subset for dispatcher."""
    filters = _parse_filters(date_from, date_to, driver_id, truck_id, route, shipment_status, granularity)

    try:
        if user.role == UserRole.DISPATCHER:
            return build_admin_analytics(
                db,
                filters=filters,
                include_financial=False,
                include_clients=False,
                viewer=user,
            )

        if user.role not in {UserRole.ADMIN, UserRole.MANAGER}:
            raise HTTPException(status_code=403, detail="Analytics access not permitted for this role.")

        return build_admin_analytics(
            db,
            filters=filters,
            include_financial=True,
            include_clients=True,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Admin analytics dashboard build failed role=%s user_id=%s error=%s",
            getattr(user.role, "value", user.role),
            user.id,
            type(exc).__name__,
        )
        raise HTTPException(status_code=500, detail="Analytics service error") from exc


@router.get("/operational")
def dispatcher_operational_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.ADMIN, UserRole.MANAGER)),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    driver_id: int | None = Query(default=None),
    truck_id: int | None = Query(default=None),
    route: str | None = Query(default=None),
    shipment_status: str | None = Query(default=None),
    granularity: str | None = Query(default="monthly"),
):
    """Operational analytics without revenue, profit, or client contribution."""
    filters = _parse_filters(date_from, date_to, driver_id, truck_id, route, shipment_status, granularity)
    return build_admin_analytics(
        db,
        filters=filters,
        include_financial=False,
        include_clients=False,
        viewer=user,
    )


@router.post("/expense-interpretation", response_model=ExpenseInterpretationResponse)
def expense_interpretation(
    body: ExpenseInterpretationRequest,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.DISPATCHER)),
):
    if not body.categories:
        raise HTTPException(status_code=400, detail="No category data supplied for interpretation.")
    text = generate_expense_interpretation(
        context_year=body.context_year,
        quarter=body.quarter,
        quarter_label=body.quarter_label,
        total_php=body.total_php,
        categories=[c.model_dump() for c in body.categories],
        largest=body.largest.model_dump(),
        smallest=body.smallest.model_dump(),
        concentration=body.concentration,
    )
    return ExpenseInterpretationResponse(interpretation=text)


@router.post("/chart-interpretation", response_model=ChartInterpretationResponse)
def chart_interpretation(
    body: ChartInterpretationRequest,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.DISPATCHER)),
):
    text = generate_chart_interpretation(
        section_title=body.section_title,
        selection_label=body.selection_label,
        chart_type=body.chart_type,
        items=[i.model_dump(exclude_none=True) for i in body.items],
        record_count=body.record_count,
        statistics=body.statistics,
    )
    return ChartInterpretationResponse(interpretation=text)
