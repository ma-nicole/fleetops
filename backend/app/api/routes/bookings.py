from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    GeneralOperationalReport,
    OperationalLog,
    User,
    UserRole,
)
from app.schemas.booking import (
    BookingCreate,
    BookingCustomsValidate,
    BookingRead,
    BookingScheduleAvailabilityRead,
    PreDeliveryChecklistValidate,
)
from app.schemas.cargo_type import BookingCargoTypeValidate, CargoTypeScreeningRead
from app.services.pre_delivery_verification import build_pre_delivery_checklist
from app.services.dispatcher_booking_assignment import assert_dispatcher_booking_access
from app.services.cargo_type_classification import apply_cargo_type_validation, screen_cargo_type
from app.services.email_templates import EmailTemplate
from app.services.notifications import send_email_notification
from app.core.config import settings
from app.constants.booking_time_slots import BOOKING_TIME_SLOTS
from app.constants.fleet_capacity import cargo_exceeds_fleet
from app.services.booking_freight_knobs import resolve_booking_freight_knobs
from app.services.booking_capacity import get_available_truck_count
from app.services.booking_schedule import availability_for_date, available_trucks_by_slot_for_date
from app.services.route_estimate import estimate_road_distance_km, customer_freight_pricing
from app.constants.fleet_capacity import trucks_required_for_cargo
from app.models.entities import TruckSlotHold, TruckSlotHoldStatus
from app.services.booking_road_distance import booking_pickup_dropoff_distance_km
from app.services.booking_tracking_payload import build_assignments_for_booking
from app.services.booking_status_aggregate import aggregate_customer_display_from_assignment_rows
from app.services.general_operational_reports import list_general_operational_reports
from app.constants.general_operational_report import GENERAL_OPS_CATEGORY_LABELS, GENERAL_OPS_TRIP_STATUS_LABELS
from app.constants.operational_log import REPORT_TYPE_LABELS
from app.services.booking_documents import resolve_booking_document_path, save_booking_document
from app.services.upload_urls import media_type_for_path
from app.services.goods_declaration_review import mark_goods_declaration_pending


router = APIRouter(prefix="/bookings", tags=["bookings"])


def _sync_bookings_approved_from_verified_payments(db: Session, customer_id: int | None) -> None:
    """Set booking to approved when payment is already verified (fixes rows missed by ORM / legacy DB).

    Uses raw SQL so we never load Booking ORM rows while status text is still a legacy ENUM name
    (e.g. PENDING_APPROVAL) — that would raise LookupError before startup normalization runs.
    """
    extra = ""
    params: dict = {}
    if customer_id is not None:
        extra = " AND b.customer_id = :cid"
        params["cid"] = customer_id
    # Accept both normalized and legacy pending labels in WHERE
    stmt = text(
        """
        UPDATE bookings b
        INNER JOIN (
            SELECT booking_id, MAX(id) AS mid
            FROM payments
            WHERE status = 'verified'
            GROUP BY booking_id
        ) v ON v.booking_id = b.id
        INNER JOIN payments p ON p.id = v.mid
        SET
            b.status = 'payment_verified',
            b.approved_at = COALESCE(b.approved_at, p.reviewed_at, p.paid_at),
            b.approved_by_id = COALESCE(b.approved_by_id, p.reviewed_by_id)
        WHERE b.status IN ('pending_approval', 'PENDING_APPROVAL', 'payment_verification')
        """
        + extra
    )
    r = db.execute(stmt, params)
    rc = getattr(r, "rowcount", None)
    if rc is not None and rc > 0:
        db.commit()


def _create_booking_record(db: Session, user: User, payload: BookingCreate) -> Booking:
    """Shared booking creation logic (JSON or multipart customer submit)."""
    est = estimate_road_distance_km(
        payload.pickup_location,
        payload.dropoff_location,
        settings,
    )
    km = est.distance_km
    knobs = resolve_booking_freight_knobs(db, settings)
    pricing = customer_freight_pricing(km, payload.cargo_weight_tons, knobs)

    if cargo_exceeds_fleet(payload.cargo_weight_tons):
        raise HTTPException(
            status_code=400,
            detail="Cargo exceeds simultaneous fleet capacity (four trucks × 42 t). Split into multiple bookings.",
        )

    required_trucks = trucks_required_for_cargo(payload.cargo_weight_tons)
    availability = get_available_truck_count(
        db,
        payload.scheduled_date,
        payload.scheduled_time_slot,
        required_trucks=required_trucks,
        lock_rows=False,
    )
    if not availability.can_book:
        raise HTTPException(
            status_code=409,
            detail="Not enough trucks available for this schedule. Please choose another date/time.",
        )

    recheck = get_available_truck_count(
        db,
        payload.scheduled_date,
        payload.scheduled_time_slot,
        required_trucks=required_trucks,
        lock_rows=True,
    )
    if not recheck.can_book:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Not enough trucks available for this schedule. Please choose another date/time.",
        )

    booking = Booking(
        customer_id=user.id,
        pickup_location=payload.pickup_location,
        dropoff_location=payload.dropoff_location,
        service_type=payload.service_type,
        scheduled_date=payload.scheduled_date,
        scheduled_time_slot=payload.scheduled_time_slot,
        cargo_weight_tons=payload.cargo_weight_tons,
        required_truck_count=required_trucks,
        cargo_description=payload.cargo_description,
        estimated_cost=pricing["quoted_total"],
        status=BookingStatus.PAYMENT_VERIFICATION,
    )
    db.add(booking)
    db.flush()

    hold = TruckSlotHold(
        booking_id=booking.id,
        schedule_date=payload.scheduled_date,
        time_slot=payload.scheduled_time_slot,
        required_truck_count=required_trucks,
        hold_status=TruckSlotHoldStatus.ON_HOLD,
    )
    db.add(hold)
    return booking


def _finalize_new_booking(db: Session, user: User, booking: Booking) -> Booking:
    db.commit()
    db.refresh(booking)
    subject, html_body = EmailTemplate.booking_confirmation(
        booking_id=booking.id,
        quoted_amount_php=float(booking.estimated_cost or 0),
        scheduled_date=str(booking.scheduled_date),
    )
    send_email_notification(to_email=user.email, subject=subject, html_body=html_body)
    return booking


def _assert_booking_document_access(booking: Booking, user: User) -> None:
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if user.role not in {
        UserRole.CUSTOMER,
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.DISPATCHER,
    }:
        raise HTTPException(status_code=403, detail="Not allowed")


@router.post("", response_model=BookingRead)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Create a new booking with routed road distance and cargo-based customer quote."""
    try:
        booking = _create_booking_record(db, user, payload)
        return _finalize_new_booking(db, user, booking)
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/with-documents", response_model=BookingRead)
async def create_booking_with_documents(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.MANAGER, UserRole.ADMIN)),
    pickup_location: str = Form(...),
    dropoff_location: str = Form(...),
    service_type: str = Form("fixed"),
    scheduled_date: date = Form(...),
    scheduled_time_slot: str = Form(...),
    cargo_weight_tons: float = Form(...),
    cargo_description: str | None = Form(default=None),
    terms_agreed: str = Form(...),
    cargo_declaration: UploadFile = File(...),
    terms_agreement: UploadFile = File(...),
):
    """Customer booking submit with required cargo declaration and terms agreement uploads."""
    if (terms_agreed or "").strip().lower() not in {"true", "1", "yes", "on"}:
        raise HTTPException(status_code=400, detail="You must accept the Terms & Agreement.")

    try:
        payload = BookingCreate(
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            service_type=service_type,
            scheduled_date=scheduled_date,
            scheduled_time_slot=scheduled_time_slot,
            cargo_weight_tons=cargo_weight_tons,
            cargo_description=cargo_description,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        booking = _create_booking_record(db, user, payload)
        decl_name, decl_path, decl_at = await save_booking_document(
            booking.id, cargo_declaration, prefix="declaration"
        )
        terms_name, terms_path, terms_at = await save_booking_document(
            booking.id, terms_agreement, prefix="terms"
        )
        booking.cargo_declaration_original_filename = decl_name
        booking.cargo_declaration_storage_path = decl_path
        booking.cargo_declaration_uploaded_at = decl_at
        mark_goods_declaration_pending(booking)
        booking.terms_agreement_original_filename = terms_name
        booking.terms_agreement_storage_path = terms_path
        booking.terms_agreement_uploaded_at = terms_at
        booking.terms_agreed_at = datetime.utcnow()
        return _finalize_new_booking(db, user, booking)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.get("/{booking_id}/documents/cargo-declaration", response_class=FileResponse)
def download_cargo_declaration(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _assert_booking_document_access(booking, user)
    path = resolve_booking_document_path(booking.cargo_declaration_storage_path)
    fname = booking.cargo_declaration_original_filename or path.name
    return FileResponse(path, filename=fname, media_type=media_type_for_path(path))


@router.get("/{booking_id}/documents/terms-agreement", response_class=FileResponse)
def download_terms_agreement(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _assert_booking_document_access(booking, user)
    path = resolve_booking_document_path(booking.terms_agreement_storage_path)
    fname = booking.terms_agreement_original_filename or path.name
    return FileResponse(path, filename=fname, media_type=media_type_for_path(path))


@router.get("/schedule-availability", response_model=BookingScheduleAvailabilityRead)
def booking_schedule_availability(
    scheduled_date: date,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
    cargo_weight_tons: float = Query(default=1.0, ge=0.1, le=168.0),
    pickup_location: str = Query(default=""),
    dropoff_location: str = Query(default=""),
):
    """Open slots account for weight and reserved truck-count (overlap when route is known)."""
    required_trucks = trucks_required_for_cargo(cargo_weight_tons)
    has_route = len(pickup_location.strip()) >= 3 and len(dropoff_location.strip()) >= 3

    if has_route:
        slots = availability_for_date(
            db,
            scheduled_date,
            cargo_weight_tons,
            pickup_location.strip(),
            dropoff_location.strip(),
        )
        available_by_slot = available_trucks_by_slot_for_date(
            db,
            scheduled_date,
            pickup_location.strip(),
            dropoff_location.strip(),
        )
        return BookingScheduleAvailabilityRead(
            scheduled_date=scheduled_date,
            slots=slots,
            required_trucks=required_trucks,
            available_trucks_by_slot=available_by_slot,
        )

    slots: dict[str, bool] = {}
    available_by_slot: dict[str, int] = {}
    for slot in BOOKING_TIME_SLOTS:
        cap = get_available_truck_count(
            db,
            scheduled_date,
            slot,
            required_trucks=required_trucks,
            lock_rows=False,
        )
        slots[slot] = cap.can_book
        available_by_slot[slot] = cap.available_trucks
    return BookingScheduleAvailabilityRead(
        scheduled_date=scheduled_date,
        slots=slots,
        required_trucks=required_trucks,
        available_trucks_by_slot=available_by_slot,
    )


@router.get("", response_model=list[BookingRead])
def list_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cid = user.id if user.role == UserRole.CUSTOMER else None
    _sync_bookings_approved_from_verified_payments(db, cid)
    query = db.query(Booking)
    if user.role == UserRole.CUSTOMER:
        query = query.filter(Booking.customer_id == user.id)
    return query.order_by(Booking.created_at.desc()).all()


@router.get("/{booking_id}", response_model=BookingRead)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cid = user.id if user.role == UserRole.CUSTOMER else None
    _sync_bookings_approved_from_verified_payments(db, cid)
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if user.role == UserRole.DISPATCHER:
        assert_dispatcher_booking_access(db, user, booking.id)
    return booking


@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if user.role == UserRole.CUSTOMER:
        if booking.status not in (BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_VERIFICATION):
            raise HTTPException(
                status_code=400,
                detail="Cancellation is only allowed before payment is verified.",
            )

    booking.status = BookingStatus.CANCELLED
    db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
        {"hold_status": TruckSlotHoldStatus.RELEASED}
    )
    db.commit()
    return {"status": "cancelled"}


@router.patch("/{booking_id}/customs/validate")
def validate_booking_customs(
    booking_id: int,
    payload: BookingCustomsValidate,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    """Admin validates customer customs info. Does not alter estimated_cost or dispatch status."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if payload.validated:
        booking.customs_admin_validated = True
        booking.customs_validated_by_id = reviewer.id
        booking.customs_validated_at = datetime.utcnow()
        if payload.customs_admin_notes is not None:
            booking.customs_admin_notes = payload.customs_admin_notes
        if payload.customs_validated_additional_charges_php is not None:
            booking.customs_validated_additional_charges_php = payload.customs_validated_additional_charges_php
        elif booking.customs_additional_charges_php is not None:
            booking.customs_validated_additional_charges_php = booking.customs_additional_charges_php
    else:
        booking.customs_admin_validated = False
        booking.customs_validated_by_id = None
        booking.customs_validated_at = None
        if payload.customs_admin_notes is not None:
            booking.customs_admin_notes = payload.customs_admin_notes

    db.commit()
    db.refresh(booking)
    return BookingRead.model_validate(booking).model_dump(mode="json")


@router.get("/{booking_id}/cargo-type/screening")
def cargo_type_screening_preview(
    booking_id: int,
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    """Preview restricted/contraband warning flags — informational only."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    chosen = (category or booking.cargo_type_category or "").strip().lower() or None
    result = screen_cargo_type(category=chosen, cargo_description=booking.cargo_description)
    return CargoTypeScreeningRead.model_validate(result).model_dump(mode="json")


@router.patch("/{booking_id}/cargo-type/validate")
def validate_booking_cargo_type(
    booking_id: int,
    payload: BookingCargoTypeValidate,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    """Admin classifies cargo type and verifies booking cargo. Warning flags do not block validation."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    try:
        apply_cargo_type_validation(
            booking,
            validated=payload.validated,
            category=payload.cargo_type_category if payload.cargo_type_category is not None else booking.cargo_type_category,
            reviewer=reviewer,
            admin_notes=payload.cargo_type_admin_notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.commit()
    db.refresh(booking)
    return BookingRead.model_validate(booking).model_dump(mode="json")


@router.get("/{booking_id}/pre-delivery-checklist")
def booking_pre_delivery_checklist(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if user.role not in {
        UserRole.CUSTOMER,
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.DISPATCHER,
        UserRole.DRIVER,
        UserRole.HELPER,
    }:
        raise HTTPException(status_code=403, detail="Not allowed")
    if user.role == UserRole.DISPATCHER:
        assert_dispatcher_booking_access(db, user, booking.id)
    return build_pre_delivery_checklist(db, booking)


@router.patch("/{booking_id}/pre-delivery-checklist")
def update_pre_delivery_checklist(
    booking_id: int,
    payload: PreDeliveryChecklistValidate,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.DISPATCHER)),
):
    """Mark declaration / cargo type checks after review — does not alter dispatch assignment flow."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No checklist fields to update.")

    if "goods_declaration_validated" in data:
        if data["goods_declaration_validated"] and not (
            booking.cargo_declaration_storage_path or booking.cargo_declaration_original_filename
        ):
            raise HTTPException(status_code=400, detail="Cargo declaration document must be on file before validation.")
        booking.goods_declaration_validated = bool(data["goods_declaration_validated"])
        if data["goods_declaration_validated"]:
            booking.goods_declaration_review_status = "approved"
        elif booking.goods_declaration_review_status == "approved":
            booking.goods_declaration_review_status = "pending"

    if "cargo_type_validated" in data:
        desc = (booking.cargo_description or "").strip()
        if data["cargo_type_validated"] and len(desc) < 3:
            raise HTTPException(status_code=400, detail="Cargo description is required before cargo type validation.")
        booking.cargo_type_validated = bool(data["cargo_type_validated"])

    db.commit()
    db.refresh(booking)
    return build_pre_delivery_checklist(db, booking)


@router.get("/{booking_id}/tracking-details")
def booking_tracking_details(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role == UserRole.CUSTOMER and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    assignment_rows = build_assignments_for_booking(db, booking)
    road_km = booking_pickup_dropoff_distance_km(booking)

    booking_effective_status = (
        aggregate_customer_display_from_assignment_rows(assignment_rows)
        if assignment_rows
        else (booking.status.value if hasattr(booking.status, "value") else str(booking.status))
    )

    payload: dict = {
        "booking": {
            "id": booking.id,
            "status": booking_effective_status,
            "pickup_location": booking.pickup_location,
            "dropoff_location": booking.dropoff_location,
            "cargo_weight_tons": float(booking.cargo_weight_tons),
            "scheduled_date": booking.scheduled_date.isoformat(),
            "scheduled_time_slot": booking.scheduled_time_slot,
            "required_truck_count": int(booking.required_truck_count or 1),
            "road_distance_km": float(road_km) if road_km is not None else None,
        },
        "assignments": assignment_rows,
    }

    if user.role != UserRole.CUSTOMER:
        logs = (
            db.query(OperationalLog)
            .filter(OperationalLog.booking_id == booking_id)
            .order_by(OperationalLog.created_at.desc())
            .all()
        )
        disp_ids = list({lg.dispatcher_id for lg in logs})
        dispatchers = db.query(User).filter(User.id.in_(disp_ids)).all() if disp_ids else []
        dmap = {u.id: (u.full_name or f"User #{u.id}") for u in dispatchers}
        payload["operational_logs"] = [
            {
                "id": lg.id,
                "trip_id": lg.trip_id,
                "booking_id": lg.booking_id,
                "dispatcher_id": lg.dispatcher_id,
                "dispatcher_name": dmap.get(lg.dispatcher_id),
                "report_type": lg.report_type,
                "report_type_label": REPORT_TYPE_LABELS.get(lg.report_type, lg.report_type),
                "priority_level": lg.priority_level,
                "operational_details": lg.operational_details,
                "attachment_url": lg.attachment_url,
                "created_at": lg.created_at.isoformat() if lg.created_at else None,
            }
            for lg in logs
        ]

        g_rows = list_general_operational_reports(db, booking_id=booking_id, limit=80)
        g_driver_ids = list({r.driver_id for r in g_rows})
        g_drivers = db.query(User).filter(User.id.in_(g_driver_ids)).all() if g_driver_ids else []
        g_dmap = {u.id: (u.full_name or f"User #{u.id}") for u in g_drivers}
        payload["general_operational_reports"] = [
            {
                "id": gr.id,
                "trip_id": gr.trip_id,
                "booking_id": gr.booking_id,
                "driver_id": gr.driver_id,
                "driver_name": g_dmap.get(gr.driver_id),
                "category": gr.category,
                "category_label": GENERAL_OPS_CATEGORY_LABELS.get(
                    gr.category, gr.category.replace("_", " ").title()
                ),
                "trip_status": gr.status,
                "trip_status_label": GENERAL_OPS_TRIP_STATUS_LABELS.get(gr.status, gr.status.replace("_", " ").title())
                if gr.status
                else None,
                "report_date": gr.report_date.isoformat(),
                "starting_odometer_km": gr.starting_odometer_km,
                "ending_odometer_km": gr.ending_odometer_km,
                "fuel_consumed": gr.fuel_consumed,
                "description": gr.description,
                "notes": gr.notes,
                "attachment_url": gr.attachment_url,
                "created_at": gr.created_at.isoformat() if gr.created_at else None,
            }
            for gr in g_rows
        ]

    return payload
