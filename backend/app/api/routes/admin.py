from datetime import datetime, timedelta
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.security import hash_password, require_roles
from app.db import get_db
from app.models.entities import (
    PricingConfig,
    ServiceType,
    Truck,
    User,
    UserRole,
)


router = APIRouter(prefix="/admin", tags=["admin"])


# ---------- Schemas ----------

class UserCreatePayload(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole
    phone: str | None = None
    password: str = Field(..., min_length=6, max_length=72)


class UserUpdatePayload(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: UserRole | None = None
    phone: str | None = None


class PricingUpdatePayload(BaseModel):
    base_rate: float | None = Field(default=None, ge=0)
    labor_rate: float | None = Field(default=None, ge=0)
    helper_rate: float | None = Field(default=None, ge=0)


def _serialize_user(user: User) -> dict:
    is_locked = bool(user.locked_until and user.locked_until > datetime.utcnow())
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "phone": user.phone,
        "failed_login_count": user.failed_login_count,
        "is_locked": is_locked,
        "locked_until": user.locked_until.isoformat() if user.locked_until else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


# ---------- Users (Account Management) ----------

@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_serialize_user(u) for u in users]


@router.post("/users", status_code=201)
def create_user(
    payload: UserCreatePayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="A user with that email already exists.")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdatePayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.phone is not None:
        user.phone = payload.phone

    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate a 12-char temp password (letters + digits)
    alphabet = string.ascii_letters + string.digits
    new_password = "".join(secrets.choice(alphabet) for _ in range(12))
    user.password_hash = hash_password(new_password)
    user.failed_login_count = 0
    user.locked_until = None
    db.commit()
    return {
        "user_id": user.id,
        "email": user.email,
        "temporary_password": new_password,
        "message": "Share this temporary password securely with the user.",
    }


@router.post("/users/{user_id}/lock")
def lock_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.locked_until = datetime.utcnow() + timedelta(days=365 * 10)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.post("/users/{user_id}/unlock")
def unlock_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.locked_until = None
    user.failed_login_count = 0
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(UserRole.ADMIN)),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"deleted": True}


# ---------- Stats (Authentication & dashboard widgets) ----------

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    users = db.query(User).all()
    now = datetime.utcnow()

    by_role: dict[str, int] = {}
    locked = 0
    failed_total = 0
    for u in users:
        role = u.role.value if hasattr(u.role, "value") else str(u.role)
        by_role[role] = by_role.get(role, 0) + 1
        if u.locked_until and u.locked_until > now:
            locked += 1
        failed_total += u.failed_login_count or 0

    return {
        "total_users": len(users),
        "by_role": by_role,
        "locked_accounts": locked,
        "total_failed_logins": failed_total,
    }


# ---------- Pricing config (Settings page) ----------

@router.get("/pricing")
def list_pricing(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    configs = db.query(PricingConfig).order_by(PricingConfig.id.asc()).all()
    if not configs:
        # Seed defaults if missing so the Settings UI always has rows to edit.
        configs = [
            PricingConfig(service_type=ServiceType.FIXED, base_rate=2000, labor_rate=120, helper_rate=80),
            PricingConfig(service_type=ServiceType.CUSTOMIZED, base_rate=3500, labor_rate=180, helper_rate=120),
        ]
        db.add_all(configs)
        db.commit()
        for c in configs:
            db.refresh(c)
    return [
        {
            "id": c.id,
            "service_type": c.service_type.value if hasattr(c.service_type, "value") else str(c.service_type),
            "base_rate": c.base_rate,
            "labor_rate": c.labor_rate,
            "helper_rate": c.helper_rate,
        }
        for c in configs
    ]


@router.patch("/pricing/{pricing_id}")
def update_pricing(
    pricing_id: int,
    payload: PricingUpdatePayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    config = db.query(PricingConfig).filter(PricingConfig.id == pricing_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Pricing config not found")

    if payload.base_rate is not None:
        config.base_rate = payload.base_rate
    if payload.labor_rate is not None:
        config.labor_rate = payload.labor_rate
    if payload.helper_rate is not None:
        config.helper_rate = payload.helper_rate

    db.commit()
    db.refresh(config)
    return {
        "id": config.id,
        "service_type": config.service_type.value if hasattr(config.service_type, "value") else str(config.service_type),
        "base_rate": config.base_rate,
        "labor_rate": config.labor_rate,
        "helper_rate": config.helper_rate,
    }


# ---------- Trucks (existing) ----------

@router.post("/trucks")
def add_truck(
    code: str,
    capacity_tons: float,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    truck = Truck(code=code, capacity_tons=capacity_tons)
    db.add(truck)
    db.commit()
    db.refresh(truck)
    return truck


@router.delete("/trucks/{truck_id}")
def remove_truck(
    truck_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")

    db.delete(truck)
    db.commit()
    return {"deleted": True}
