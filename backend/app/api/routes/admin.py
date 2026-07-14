from datetime import datetime, timedelta
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.security import hash_password, require_roles
from app.db import get_db
from app.core.config import settings as app_settings
from app.models.entities import (
    Booking,
    BookingStatus,
    PricingConfig,
    ServiceType,
    Truck,
    User,
    UserRole,
)
from app.schemas.goods_declaration import GoodsDeclarationReviewRequest, goods_declaration_reason_catalog
from app.services.goods_declaration_review import (
    apply_goods_declaration_review,
    booking_has_goods_declaration,
    effective_goods_declaration_review_status,
    goods_declaration_review_customer_fields,
    goods_declaration_review_label,
    serialize_review_events,
)
from app.services.goods_declaration_notifications import notify_customer_document_review_decision
from app.services.dispatcher_booking_assignment import assign_booking_dispatcher, job_order_assignment_map
from app.models.entities import JobOrder
from app.schemas.dispatcher_assignment import DispatcherBookingAssignRequest
from app.services.booking_freight_knobs import (
    booking_freight_knobs_to_dict,
    ensure_booking_freight_row,
)
from app.services.fuel_price_service import ensure_fuel_price_for_quote, mark_admin_manual_fuel_price

from app.services.cargo_type_classification import (
    cargo_type_category_label,
    parse_cargo_restricted_reasons,
)
from app.services.cargo_type_validation_queue import (
    cargo_type_validation_queue_query,
    cargo_validation_status_chain,
)
from app.services.dispatch_assignment_readiness import dispatch_assignment_readiness


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


class BookingFreightSettingsUpdate(BaseModel):
    """Admin-editable values for booking quotes — cargo rate, km/L, and crew shares are fixed in code."""

    diesel_price_php_per_liter: float = Field(..., ge=1.0, le=500.0)
    toll_fees_php_per_trip: float = Field(..., ge=0.0, le=500_000.0)


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


# ---------- Booking freight: diesel + toll (other terms are code constants) ----------

@router.get("/booking-freight-settings")
def get_booking_freight_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    row = ensure_booking_freight_row(db, app_settings)
    return booking_freight_knobs_to_dict(row)


@router.put("/booking-freight-settings")
def put_booking_freight_settings(
    payload: BookingFreightSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    row = ensure_booking_freight_row(db, app_settings)
    row.diesel_price_php_per_liter = payload.diesel_price_php_per_liter
    row.toll_fees_php_per_trip = payload.toll_fees_php_per_trip
    mark_admin_manual_fuel_price(row)
    db.commit()
    db.refresh(row)
    return booking_freight_knobs_to_dict(row)


@router.post("/booking-freight-settings/refresh-fuel-price")
def refresh_booking_fuel_price(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Force-refresh diesel ₱/L from configured source (or bundled/cache fallback)."""
    snap = ensure_fuel_price_for_quote(db, app_settings, force_refresh=True)
    row = ensure_booking_freight_row(db, app_settings)
    data = booking_freight_knobs_to_dict(row)
    data["fuel_price_refresh"] = {
        "ok": snap.refresh_ok,
        "from_cache": snap.from_cache,
        "message": snap.message,
        "source": snap.source,
        "fetched_at": snap.fetched_at.isoformat() if snap.fetched_at else None,
    }
    return data


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


class TruckCreatePayload(BaseModel):
    model_name: str = Field(..., min_length=1, max_length=255)
    plate_number: str = Field(..., min_length=1, max_length=50)
    capacity_tons: float = Field(..., gt=0, le=100)
    status: str = Field(default="available", max_length=50)
    age_years: float = Field(default=1.0, ge=0, le=80)


# ---------- Trucks (admin / manager) ----------

@router.get("/trucks")
def list_trucks(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    rows = db.query(Truck).order_by(Truck.id.asc()).all()
    return [
        {
            "id": t.id,
            "code": t.code,
            "model_name": t.model_name,
            "capacity_tons": float(t.capacity_tons),
            "status": t.status,
            "fuel_efficiency_kmpl": float(t.fuel_efficiency_kmpl),
            "odometer_km": float(t.odometer_km or 0),
            "age_years": float(t.age_years or 0),
            "last_maintenance_date": t.last_maintenance_date.isoformat() if t.last_maintenance_date else None,
        }
        for t in rows
    ]


@router.post("/trucks", status_code=201)
def add_truck(
    payload: TruckCreatePayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    plate = payload.plate_number.strip().upper()
    if db.query(Truck).filter(Truck.code == plate).first():
        raise HTTPException(status_code=409, detail="A vehicle with this plate number already exists.")

    truck = Truck(
        code=plate,
        model_name=payload.model_name.strip(),
        capacity_tons=float(payload.capacity_tons),
        status=payload.status.strip().lower() or "available",
        age_years=float(payload.age_years),
    )
    db.add(truck)
    db.commit()
    db.refresh(truck)
    return {
        "id": truck.id,
        "code": truck.code,
        "model_name": truck.model_name,
        "capacity_tons": float(truck.capacity_tons),
        "status": truck.status,
        "fuel_efficiency_kmpl": float(truck.fuel_efficiency_kmpl),
        "odometer_km": float(truck.odometer_km or 0),
        "age_years": float(truck.age_years or 0),
        "last_maintenance_date": truck.last_maintenance_date.isoformat() if truck.last_maintenance_date else None,
    }


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


def _serialize_goods_declaration_row(db: Session, booking: Booking) -> dict:
    st = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    extra = goods_declaration_review_customer_fields(booking)
    return {
        "booking_id": booking.id,
        "customer_id": booking.customer_id,
        "status": st,
        "pickup_location": booking.pickup_location,
        "dropoff_location": booking.dropoff_location,
        "cargo_description": booking.cargo_description,
        "cargo_weight_tons": float(booking.cargo_weight_tons or 0),
        "cargo_declaration_original_filename": booking.cargo_declaration_original_filename,
        "cargo_declaration_uploaded_at": (
            booking.cargo_declaration_uploaded_at.isoformat() if booking.cargo_declaration_uploaded_at else None
        ),
        "cargo_declaration_file_url": booking.cargo_declaration_file_url,
        "goods_declaration_review_status": extra["goods_declaration_review_status"],
        "goods_declaration_review_status_label": extra["goods_declaration_review_status_label"],
        "goods_declaration_review_remarks": booking.goods_declaration_review_remarks,
        "goods_declaration_review_remarks_history": extra.get("goods_declaration_review_remarks_history"),
        "goods_declaration_revision_count": extra.get("goods_declaration_revision_count", 0),
        "goods_declaration_revision_limit": extra.get("goods_declaration_revision_limit", 3),
        "goods_declaration_reviewed_at": (
            booking.goods_declaration_reviewed_at.isoformat() if booking.goods_declaration_reviewed_at else None
        ),
        "goods_declaration_reviewed_by_id": booking.goods_declaration_reviewed_by_id,
        "review_history": serialize_review_events(db, booking.id),
    }


@router.get("/goods-declarations/reason-catalog")
def goods_declaration_reasons(
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    return goods_declaration_reason_catalog()


@router.get("/goods-declarations")
def list_goods_declaration_reviews(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    rows = (
        db.query(Booking)
        .filter(
            (Booking.cargo_declaration_storage_path.isnot(None))
            | (Booking.cargo_declaration_original_filename.isnot(None))
        )
        .order_by(Booking.cargo_declaration_uploaded_at.desc(), Booking.id.desc())
        .all()
    )
    return [_serialize_goods_declaration_row(db, b) for b in rows]


@router.patch("/goods-declarations/{booking_id}")
def review_goods_declaration(
    booking_id: int,
    payload: GoodsDeclarationReviewRequest,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not booking_has_goods_declaration(booking):
        raise HTTPException(status_code=400, detail="This booking has no goods declaration file.")

    try:
        apply_goods_declaration_review(
            booking,
            status=payload.status,
            reviewer=reviewer,
            remarks=payload.remarks,
            reason_code=payload.reason_code,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.commit()
    db.refresh(booking)
    notify_customer_document_review_decision(
        db,
        booking,
        status=payload.status,
        remarks=booking.goods_declaration_review_remarks,
    )
    return _serialize_goods_declaration_row(db, booking)


def _serialize_cargo_type_validation_row(db: Session, booking: Booking) -> dict:
    st = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    readiness = dispatch_assignment_readiness(db, booking)
    return {
        "booking_id": booking.id,
        "customer_id": booking.customer_id,
        "status": st,
        "pickup_location": booking.pickup_location,
        "dropoff_location": booking.dropoff_location,
        "cargo_description": booking.cargo_description,
        "cargo_weight_tons": float(booking.cargo_weight_tons or 0),
        "cargo_type_category": booking.cargo_type_category,
        "cargo_type_category_label": cargo_type_category_label(booking.cargo_type_category),
        "cargo_type_validated": bool(booking.cargo_type_validated),
        "cargo_type_admin_notes": booking.cargo_type_admin_notes,
        "cargo_restricted_flag": bool(booking.cargo_restricted_flag),
        "cargo_restricted_reasons": parse_cargo_restricted_reasons(booking.cargo_restricted_reasons),
        "cargo_type_validated_at": (
            booking.cargo_type_validated_at.isoformat() if booking.cargo_type_validated_at else None
        ),
        "cargo_type_validated_by_id": booking.cargo_type_validated_by_id,
        "active_trip_ids": readiness["active_trip_ids"],
        "ready_for_dispatch_assignment": readiness["ready"],
        "dispatch_blockers": readiness["blockers"],
        "dispatch_integrity_warning": readiness["dispatch_integrity_warning"],
        "payment_verified": readiness["payment_verified"],
        "goods_declaration_approved": readiness["goods_declaration_approved"],
    }


def _cargo_validation_sort_key(row: dict) -> tuple:
    """Active trips without cargo validation first — prevents admin/dispatch ID drift."""
    warning = 0 if row.get("dispatch_integrity_warning") else 1
    pending = 0 if not row.get("cargo_type_validated") else 1
    return (warning, pending, -int(row["booking_id"]))


@router.get("/cargo-type-validations")
def list_cargo_type_validations(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    # Heal booking.status lag when payment is already verified (legacy rows).
    from app.api.routes.bookings import _sync_bookings_approved_from_verified_payments

    _sync_bookings_approved_from_verified_payments(db, None)
    rows = cargo_type_validation_queue_query(db).all()
    serialized = [_serialize_cargo_type_validation_row(db, b) for b in rows]
    serialized.sort(key=_cargo_validation_sort_key)
    return serialized


@router.get("/cargo-type-validations/{booking_id}/status-chain")
def cargo_type_validation_status_chain(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return cargo_validation_status_chain(db, booking)


@router.get("/dispatchers")
def list_dispatchers(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    rows = (
        db.query(User)
        .filter(User.role == UserRole.DISPATCHER)
        .order_by(User.full_name.asc(), User.id.asc())
        .all()
    )
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
        }
        for u in rows
    ]


def _serialize_dispatcher_assignment_row(booking: Booking, job: JobOrder | None, dispatcher: User | None) -> dict:
    st = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    return {
        "booking_id": booking.id,
        "customer_id": booking.customer_id,
        "status": st,
        "pickup_location": booking.pickup_location,
        "dropoff_location": booking.dropoff_location,
        "cargo_description": booking.cargo_description,
        "cargo_weight_tons": float(booking.cargo_weight_tons or 0),
        "scheduled_date": booking.scheduled_date.isoformat(),
        "scheduled_time_slot": booking.scheduled_time_slot,
        "assigned_dispatcher_id": job.assigned_dispatcher_id if job else None,
        "assigned_dispatcher_name": dispatcher.full_name if dispatcher else None,
        "job_order_id": job.id if job else None,
        "job_issued_at": job.issued_at.isoformat() if job and job.issued_at else None,
    }


@router.get("/dispatcher-assignments")
def list_dispatcher_assignments(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    rows = (
        db.query(Booking)
        .filter(
            Booking.status.in_(
                [
                    BookingStatus.PAYMENT_VERIFIED,
                    BookingStatus.READY_FOR_ASSIGNMENT,
                    BookingStatus.APPROVED,
                    BookingStatus.ASSIGNED,
                    BookingStatus.ACCEPTED,
                    BookingStatus.ENROUTE,
                    BookingStatus.LOADING,
                    BookingStatus.OUT_FOR_DELIVERY,
                ]
            )
        )
        .order_by(Booking.updated_at.desc(), Booking.id.desc())
        .limit(300)
        .all()
    )
    job_map = job_order_assignment_map(db, [b.id for b in rows])
    dispatcher_ids = {
        int(j.assigned_dispatcher_id)
        for j in job_map.values()
        if j.assigned_dispatcher_id is not None
    }
    dispatchers = (
        db.query(User).filter(User.id.in_(dispatcher_ids)).all() if dispatcher_ids else []
    )
    dmap = {u.id: u for u in dispatchers}
    out = []
    for booking in rows:
        job = job_map.get(booking.id)
        disp = dmap.get(job.assigned_dispatcher_id) if job and job.assigned_dispatcher_id else None
        out.append(_serialize_dispatcher_assignment_row(booking, job, disp))
    return out


@router.patch("/dispatcher-assignments/{booking_id}")
def assign_dispatcher_to_booking(
    booking_id: int,
    payload: DispatcherBookingAssignRequest,
    db: Session = Depends(get_db),
    assigner: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    try:
        job = assign_booking_dispatcher(
            db,
            booking,
            dispatcher_id=payload.dispatcher_id,
            assigned_by=assigner,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.commit()
    db.refresh(booking)
    dispatcher = None
    if job.assigned_dispatcher_id:
        dispatcher = db.query(User).filter(User.id == job.assigned_dispatcher_id).first()
    return _serialize_dispatcher_assignment_row(booking, job, dispatcher)
