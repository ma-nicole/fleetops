from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import (
    AttendanceRecord,
    DriverProfile,
    HelperProfile,
    Trip,
    User,
    UserRole,
)


router = APIRouter(prefix="/driver", tags=["driver"])


@router.get("/trips")
def my_trips(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.HELPER)),
):
    q = db.query(Trip).options(joinedload(Trip.booking), joinedload(Trip.truck))
    if user.role == UserRole.DRIVER:
        q = q.filter(Trip.driver_id == user.id)
    else:
        q = q.filter(Trip.helper_id == user.id)
    trips = q.order_by(Trip.id.desc()).limit(100).all()
    out = []
    for t in trips:
        bk = t.booking
        tk = t.truck
        out.append(
            {
                "id": t.id,
                "booking_id": t.booking_id,
                "truck_id": t.truck_id,
                "driver_id": t.driver_id,
                "dispatcher_id": t.dispatcher_id,
                "route_path": t.route_path,
                "distance_km": t.distance_km,
                "toll_cost": t.toll_cost,
                "fuel_cost": t.fuel_cost,
                "labor_cost": t.labor_cost,
                "duration_hours": t.duration_hours,
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "assigned_at": t.assigned_at.isoformat() if t.assigned_at else None,
                "accepted_at": t.accepted_at.isoformat() if t.accepted_at else None,
                "departure_time": t.departure_time.isoformat() if t.departure_time else None,
                "arrival_pickup_time": t.arrival_pickup_time.isoformat() if t.arrival_pickup_time else None,
                "loading_start_time": t.loading_start_time.isoformat() if t.loading_start_time else None,
                "loading_end_time": t.loading_end_time.isoformat() if t.loading_end_time else None,
                "departure_delivery_time": t.departure_delivery_time.isoformat() if t.departure_delivery_time else None,
                "arrival_delivery_time": t.arrival_delivery_time.isoformat() if t.arrival_delivery_time else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "proof_of_delivery": t.proof_of_delivery,
                "pod_notes": t.pod_notes,
                "current_latitude": t.current_latitude,
                "current_longitude": t.current_longitude,
                "estimated_delivery_time": t.estimated_delivery_time.isoformat()
                if t.estimated_delivery_time
                else None,
                "helper_id": t.helper_id,
                "helper_progress_status": getattr(t, "helper_progress_status", None),
                "helper_last_proof_path": getattr(t, "helper_last_proof_path", None),
                "booking": (
                    {
                        "id": bk.id,
                        "customer_id": bk.customer_id,
                        "pickup_location": bk.pickup_location,
                        "dropoff_location": bk.dropoff_location,
                        "scheduled_date": bk.scheduled_date.isoformat(),
                        "scheduled_time_slot": bk.scheduled_time_slot,
                        "cargo_weight_tons": bk.cargo_weight_tons,
                        "cargo_description": bk.cargo_description,
                        "estimated_cost": bk.estimated_cost,
                        "status": bk.status.value if hasattr(bk.status, "value") else str(bk.status),
                    }
                    if bk
                    else None
                ),
                "truck": (
                    {"id": tk.id, "code": tk.code, "capacity_tons": float(tk.capacity_tons or 0)}
                    if tk
                    else None
                ),
            }
        )
    return out


@router.post("/attendance/check-in")
def check_in(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.HELPER)),
):
    record = AttendanceRecord(user_id=user.id, check_in_time=datetime.utcnow(), status="present")
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"checked_in": True, "timestamp": record.check_in_time.isoformat()}


@router.get("/salary")
def salary_breakdown(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.HELPER)),
):
    if user.role == UserRole.DRIVER:
        profile = db.query(DriverProfile).filter(DriverProfile.user_id == user.id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Driver profile not found")
        deductions = profile.deduction_amount
        base_salary = float(profile.base_salary or 1200.0)
        net_salary = max(base_salary - deductions, 0)
        return {
            "user_id": user.id,
            "role": "driver",
            "base_salary": base_salary,
            "deductions": deductions,
            "net_salary": net_salary,
            "rating": profile.rating,
            "compliance_status": profile.compliance_status,
        }

    helper = db.query(HelperProfile).filter(HelperProfile.user_id == user.id).first()
    if not helper:
        raise HTTPException(status_code=404, detail="Helper profile not found")
    base_salary = float(helper.base_salary or 800.0)
    return {
        "user_id": user.id,
        "role": "helper",
        "base_salary": base_salary,
        "deductions": 0,
        "net_salary": base_salary,
        "rating": helper.rating,
    }


@router.get("/me")
def my_profile(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.full_name,
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
    }
