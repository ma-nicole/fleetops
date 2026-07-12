from fastapi import APIRouter, Depends, HTTPException
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
    paid = sum(p.amount for p in payments if p.status == PaymentStatus.VERIFIED)
    refunded = sum(p.amount for p in payments if p.status == PaymentStatus.REFUNDED)
    pending = sum(p.amount for p in payments if p.status == PaymentStatus.FOR_VERIFICATION)
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


@router.get("/finance-report")
def finance_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    payments = db.query(Payment).all()
    rows = [
        {
            "id": p.id,
            "booking_id": p.booking_id,
            "customer_id": p.customer_id,
            "method": p.method,
            "amount": float(p.amount) if p.amount is not None else None,
            "status": p.status.value,
            "reference": p.reference,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payments
    ]
    return {
        "report_name": "Financial Reports",
        "module_name": "Financial Reports",
        "columns": [
            {"key": "id", "label": "Payment ID"},
            {"key": "booking_id", "label": "Booking ID"},
            {"key": "customer_id", "label": "Customer ID"},
            {"key": "method", "label": "Method"},
            {"key": "amount", "label": "Amount (PHP)"},
            {"key": "status", "label": "Status"},
            {"key": "reference", "label": "Reference"},
            {"key": "created_at", "label": "Created at"},
        ],
        "rows": rows,
        "record_count": len(rows),
    }


@router.get("/maintenance-report")
def maintenance_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    records = db.query(MaintenanceRecord).all()
    rows = [
        {
            "id": r.id,
            "truck_id": r.truck_id,
            "issue": r.reported_issue,
            "severity": r.severity,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "predicted_risk_score": r.predicted_risk_score,
            "estimated_cost": float(r.estimated_cost) if r.estimated_cost is not None else None,
            "actual_cost": float(r.actual_cost) if r.actual_cost is not None else None,
            "scheduled_date": r.scheduled_date.isoformat() if r.scheduled_date else None,
            "next_service_date": r.next_service_date.isoformat() if r.next_service_date else None,
        }
        for r in records
    ]
    return {
        "report_name": "Maintenance Reports",
        "module_name": "Maintenance Reports",
        "columns": [
            {"key": "id", "label": "Record ID"},
            {"key": "truck_id", "label": "Truck ID"},
            {"key": "issue", "label": "Issue"},
            {"key": "severity", "label": "Severity"},
            {"key": "status", "label": "Status"},
            {"key": "predicted_risk_score", "label": "Predicted risk"},
            {"key": "estimated_cost", "label": "Estimated cost (PHP)"},
            {"key": "actual_cost", "label": "Actual cost (PHP)"},
            {"key": "scheduled_date", "label": "Scheduled date"},
            {"key": "next_service_date", "label": "Next service"},
        ],
        "rows": rows,
        "record_count": len(rows),
    }


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
