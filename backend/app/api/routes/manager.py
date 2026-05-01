from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import Booking, BookingStatus, DriverProfile, PricingConfig, Trip, User, UserRole
from app.schemas.manager import DriverProfilePayload, PricingConfigPayload
from app.services.analytics import forecast_demand, maintenance_risk_snapshot, train_cost_model


router = APIRouter(prefix="/manager", tags=["manager"])


@router.get("/dashboard")
def manager_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    total_bookings = db.query(func.count(Booking.id)).scalar() or 0
    ongoing_statuses = [
        BookingStatus.PENDING_APPROVAL,
        BookingStatus.APPROVED,
        BookingStatus.ASSIGNED,
        BookingStatus.ACCEPTED,
        BookingStatus.ENROUTE,
        BookingStatus.LOADING,
        BookingStatus.OUT_FOR_DELIVERY,
    ]
    ongoing = db.query(func.count(Booking.id)).filter(Booking.status.in_(ongoing_statuses)).scalar() or 0
    completed = db.query(func.count(Booking.id)).filter(Booking.status == BookingStatus.COMPLETED).scalar() or 0

    trip_cost = (
        db.query(func.sum(Trip.fuel_cost + Trip.toll_cost + Trip.labor_cost)).scalar() or 0
    )
    distance_sum = db.query(func.sum(Trip.distance_km)).scalar() or 0

    return {
        "kpis": {
            "total_bookings": total_bookings,
            "ongoing_bookings": ongoing,
            "completed_bookings": completed,
            "total_trip_cost": round(float(trip_cost), 2),
            "total_distance": round(float(distance_sum), 2),
        },
        "cost_model": train_cost_model(db),
        "demand_forecast": [item.model_dump() for item in forecast_demand(db)],
        "maintenance_risk": maintenance_risk_snapshot(db),
    }


@router.post("/pricing")
def upsert_pricing(
    payload: PricingConfigPayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    item = db.query(PricingConfig).filter(PricingConfig.service_type == payload.service_type).first()
    if not item:
        item = PricingConfig(service_type=payload.service_type)
        db.add(item)

    item.base_rate = payload.base_rate
    item.labor_rate = payload.labor_rate
    item.helper_rate = payload.helper_rate
    db.commit()
    db.refresh(item)
    return item


@router.post("/drivers/profile")
def upsert_driver_profile(
    payload: DriverProfilePayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    profile = db.query(DriverProfile).filter(DriverProfile.user_id == payload.user_id).first()
    if not profile:
        profile = DriverProfile(user_id=payload.user_id)
        db.add(profile)

    profile.compliance_status = payload.compliance_status
    profile.rating = payload.rating
    profile.deduction_amount = payload.deduction_amount
    db.commit()
    db.refresh(profile)
    return profile
