from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
    if user.role == UserRole.DRIVER:
        return db.query(Trip).filter(Trip.driver_id == user.id).all()
    return db.query(Trip).filter(Trip.helper_id == user.id).all()


@router.post("/attendance/check-in")
def check_in(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.HELPER)),
):
    record = AttendanceRecord(user_id=user.id, check_in_time=datetime.utcnow(), status="present")
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"checked_in": True, "timestamp": record.check_in_time}


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
