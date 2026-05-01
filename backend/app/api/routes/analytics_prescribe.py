"""Prescriptive analytics endpoints (paper §3.2.8 + §3.2.9 A*)."""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    RouteOption,
    User,
    UserRole,
)
from app.schemas.predict import (
    AssignmentRecommendRequest,
    AssignmentRecommendResponse,
    RouteOptimizeRequest,
    RouteOptimizeResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from app.services.prescriptive.assignment import recommend_assignment
from app.services.prescriptive.routing_astar import optimize_route
from app.services.prescriptive.whatif import run_whatif


router = APIRouter(prefix="/analytics", tags=["analytics-prescribe"])


@router.post("/optimize-route", response_model=RouteOptimizeResponse)
def optimize_route_endpoint(
    payload: RouteOptimizeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(
        UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN
    )),
):
    return optimize_route(payload, db)


@router.post("/optimize-route/{booking_id}/save")
def save_route_options_for_booking(
    booking_id: int,
    payload: RouteOptimizeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    response = optimize_route(payload, db)

    # Replace existing options for the booking
    db.query(RouteOption).filter(RouteOption.booking_id == booking_id).delete()
    for cand in response.candidates:
        db.add(RouteOption(
            booking_id=booking_id,
            rank=cand.rank,
            path_json=json.dumps(cand.path),
            distance_km=cand.distance_km,
            fuel_cost=cand.fuel_cost,
            toll_cost=cand.toll_cost,
            time_penalty=cand.time_penalty,
            maintenance_penalty=cand.maintenance_penalty,
            total_cost=cand.total_cost,
            is_selected=cand.rank == response.selected_rank,
        ))
    db.commit()
    return {"booking_id": booking_id, "saved": len(response.candidates)}


@router.post("/recommend-assignment", response_model=AssignmentRecommendResponse)
def recommend_assignment_endpoint(
    payload: AssignmentRecommendRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    return recommend_assignment(db, payload.booking_id)


@router.post("/whatif", response_model=WhatIfResponse)
def whatif_endpoint(
    payload: WhatIfRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.DISPATCHER)),
):
    return run_whatif(payload, db=db)
