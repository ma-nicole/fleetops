import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    DriverProfile,
    JobOrder,
    MaintenanceRecord,
    Payment,
    PaymentStatus,
    PricingConfig,
    TripStatus,
    Trip,
    User,
    UserRole,
)
from app.schemas.manager import DriverProfilePayload, PricingConfigPayload
from app.services.analytics import forecast_demand, maintenance_risk_snapshot, train_cost_model
from app.services.analytics_pipeline import run_pipeline


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
        "pipeline": run_pipeline(db),
    }


@router.get("/finance")
def finance_overview(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    payments = db.query(Payment).all()
    paid = sum(p.amount for p in payments if p.status == PaymentStatus.PAID)
    refunded = sum(p.amount for p in payments if p.status == PaymentStatus.REFUNDED)
    pending = sum(p.amount for p in payments if p.status in {PaymentStatus.PENDING, PaymentStatus.PROCESSING})
    completed_total = (
        db.query(func.sum(Booking.estimated_cost))
        .filter(Booking.status == BookingStatus.COMPLETED)
        .scalar()
        or 0
    )
    receivables = max(0.0, float(completed_total) - float(paid))
    return {
        "paid": round(float(paid), 2),
        "pending": round(float(pending), 2),
        "refunded": round(float(refunded), 2),
        "receivables": round(receivables, 2),
        "total_revenue_committed": round(float(completed_total), 2),
    }


@router.get("/finance.csv")
def finance_csv(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    payments = db.query(Payment).all()
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["id", "booking_id", "customer_id", "method", "amount", "status", "reference", "created_at"])
    for p in payments:
        writer.writerow([
            p.id, p.booking_id, p.customer_id, p.method,
            f"{p.amount}", p.status.value, p.reference, p.created_at.isoformat(),
        ])
    stream.seek(0)
    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")


@router.get("/maintenance.csv")
def maintenance_csv(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    rows = db.query(MaintenanceRecord).all()
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow([
        "id", "truck_id", "issue", "severity", "status", "predicted_risk_score",
        "estimated_cost", "actual_cost", "scheduled_date", "next_service_date",
    ])
    for r in rows:
        writer.writerow([
            r.id, r.truck_id, r.reported_issue, r.severity,
            r.status.value if hasattr(r.status, "value") else str(r.status),
            r.predicted_risk_score, r.estimated_cost, r.actual_cost,
            r.scheduled_date.isoformat() if r.scheduled_date else "",
            r.next_service_date.isoformat() if r.next_service_date else "",
        ])
    stream.seek(0)
    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")


@router.post("/job-orders/{booking_id}")
def issue_job_order(
    booking_id: int,
    instructions: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    job = db.query(JobOrder).filter(JobOrder.booking_id == booking_id).first()
    if not job:
        job = JobOrder(
            booking_id=booking_id,
            issued_by_manager_id=user.id,
            instructions=instructions,
        )
        db.add(job)
    else:
        job.instructions = instructions
    db.commit()
    db.refresh(job)
    return {
        "id": job.id,
        "booking_id": job.booking_id,
        "issued_by_manager_id": job.issued_by_manager_id,
        "instructions": job.instructions,
        "issued_at": job.issued_at.isoformat(),
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
