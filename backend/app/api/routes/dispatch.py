import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from secrets import token_hex, token_urlsafe

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, aliased, joinedload

from app.core.security import require_roles
from app.db import get_db
from app.constants.operational_log import PRIORITY_VALUES, REPORT_TYPE_LABELS, REPORT_TYPE_VALUES
from app.constants.vehicle_issue_report import VEHICLE_ISSUE_TYPE_LABELS
from app.constants.general_operational_report import GENERAL_OPS_CATEGORY_LABELS, GENERAL_OPS_TRIP_STATUS_LABELS
from app.models.entities import (
    Booking,
    BookingStatus,
    DriverProfile,
    OperationalLog,
    Trip,
    TripLocationUpdate,
    TruckAssignment,
    TruckAssignmentStatus,
    TruckSlotHold,
    TruckSlotHoldStatus,
    TripStatus,
    Truck,
    User,
    UserRole,
    VehicleIssueReport,
    VehicleIssueReportStatus,
    GeneralOperationalReport,
)
from app.services.email_templates import EmailTemplate
from app.services.notifications import send_email_notification
from app.services.booking_paid_amount import paid_verified_amount_by_booking_ids
from app.services.booking_status_aggregate import (
    aggregate_customer_display_from_trips,
    apply_aggregate_booking_status,
)
from app.services.routing import optimize_route as legacy_optimize_route
from app.services.scheduler import find_available_driver, find_available_helper, find_available_truck
from app.constants.fleet_capacity import FLEET_TRUCK_COUNT, trucks_required_for_cargo
from app.core.paths import uploads_subdir
from app.services.booking_road_distance import booking_pickup_dropoff_distance_km
from app.services.dispatch_resource_availability import (
    build_booking_resource_availability,
    mark_resources_assigned,
    validate_resource_assignment,
)
from app.services.dispatch_assignment_readiness import (
    BookingNotReadyForDispatchError,
    assert_booking_ready_for_dispatch_assignment,
)
from app.services.dispatch_operations_center import build_operations_center_payload
from app.services.dispatch_trip_logs import build_trip_logs_payload
from app.services.evidence_capture import (
    evaluate_trip_evidence,
    parse_evidence_form,
    record_evidence_capture,
)
from app.services.dispatch_trip_monitoring_board import build_trip_monitoring_board_payload
from app.services.dispatcher_booking_assignment import (
    assert_dispatcher_booking_access,
    auto_assign_dispatcher_on_dispatch_action,
    blocked_booking_ids_for_dispatcher,
    filter_trips_for_dispatcher,
)
from app.services.trip_cost_ledger import add_shoulder_cost_entry, build_trip_cost_ledger_payload, shoulder_cost_category_label
from app.services.trip_crew_allowances import resolve_trip_crew_allowances
from app.services.dispatch_route_selection import (
    generate_route_options_for_booking,
    list_booking_route_options,
    map_verification_warning_for_booking,
    resolve_dispatch_route,
    save_manual_route_option,
    select_route_option,
)
from app.services.driver_trip_notifications import (
    notify_driver_trip_assigned,
    notify_drivers_booking_route_updated,
)
from app.schemas.trip_shoulder_cost import TripShoulderCostCreate
from app.schemas.dispatch_route import DispatchManualRouteRequest, DispatchRouteSelectRequest
from app.services.latest_location_display import latest_location_display_for_trip


router = APIRouter(prefix="/dispatch", tags=["dispatch"])
logger = logging.getLogger(__name__)

OPERATIONAL_LOG_UPLOAD_DIR = uploads_subdir("operational_logs")
OPERATIONAL_LOG_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".img"}


def _ensure_operational_log_upload_dir() -> None:
    OPERATIONAL_LOG_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _save_operational_log_attachment(trip_id: int, file: UploadFile | None) -> str | None:
    if not file or not (file.filename or "").strip():
        return None
    name = (file.filename or "").strip().lower()
    ext = Path(name).suffix
    if ext not in OPERATIONAL_LOG_ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail="Attachment must be .jpg, .jpeg, .png, .webp, .pdf, or .img",
        )
    _ensure_operational_log_upload_dir()
    stored_name = f"t{trip_id}_{token_hex(8)}{ext}"
    dest = OPERATIONAL_LOG_UPLOAD_DIR / stored_name
    content = file.file.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Attachment too large (max 12 MB)")
    dest.write_bytes(content)
    return f"/uploads/operational_logs/{stored_name}"


ACTIVE_TRIP_STATUSES = [
    TripStatus.PENDING,
    TripStatus.ASSIGNED,
    TripStatus.ACCEPTED,
    TripStatus.DEPARTED,
    TripStatus.LOADING,
    TripStatus.IN_DELIVERY,
]


def _bookings_needing_dispatcher_assignment(db: Session, user: User | None = None) -> int:
    """Bookings that can still receive trip legs (paid / approved / partial assign)."""
    terminal = (TripStatus.COMPLETED, TripStatus.CANCELLED)
    blocked: set[int] = set()
    if user is not None and user.role == UserRole.DISPATCHER:
        blocked = blocked_booking_ids_for_dispatcher(db, user.id)
    candidates = (
        db.query(
            Booking.id,
            Booking.cargo_weight_tons,
            Booking.required_truck_count,
        )
        .filter(
            Booking.status.in_(
                [
                    BookingStatus.PAYMENT_VERIFIED,
                    BookingStatus.READY_FOR_ASSIGNMENT,
                    BookingStatus.APPROVED,
                    BookingStatus.ASSIGNED,
                ]
            )
        )
        .all()
    )
    if not candidates:
        return 0
    booking_ids = [row[0] for row in candidates]
    trip_counts = (
        db.query(Trip.booking_id, func.count(Trip.id))
        .filter(Trip.booking_id.in_(booking_ids), ~Trip.status.in_(terminal))
        .group_by(Trip.booking_id)
        .all()
    )
    active_by_booking = {bid: int(n) for bid, n in trip_counts}
    pending = 0
    for bid, cargo_w, req in candidates:
        if bid in blocked:
            continue
        need = int(req or trucks_required_for_cargo(float(cargo_w or 0)))
        active = active_by_booking.get(bid, 0)
        if active < need:
            pending += 1
    return pending


@router.get("/dashboard")
def dispatcher_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Aggregate stats + recent trips for dispatcher / manager console."""
    today = datetime.utcnow().date()

    pending_orders = _bookings_needing_dispatcher_assignment(db, user)

    active_trips = (
        db.query(func.count(Trip.id)).filter(Trip.status.in_(ACTIVE_TRIP_STATUSES)).scalar()
        or 0
    )

    trips_assigned_today = (
        db.query(func.count(Trip.id))
        .filter(
            Trip.assigned_at.isnot(None),
            func.date(Trip.assigned_at) == today,
        )
        .scalar()
        or 0
    )

    trips_completed_today = (
        db.query(func.count(Trip.id))
        .filter(
            Trip.completed_at.isnot(None),
            func.date(Trip.completed_at) == today,
        )
        .scalar()
        or 0
    )

    # In-progress legs that were put on the board today (matches "today's dispatch" subline).
    active_trips_assigned_today = (
        db.query(func.count(Trip.id))
        .filter(
            Trip.status.in_(ACTIVE_TRIP_STATUSES),
            Trip.assigned_at.isnot(None),
            func.date(Trip.assigned_at) == today,
        )
        .scalar()
        or 0
    )

    # Distinct trips that had real calendar-day activity (no double-count assign+complete).
    today_trip_touchpoints = (
        db.query(func.count(func.distinct(Trip.id)))
        .filter(
            or_(
                and_(Trip.assigned_at.isnot(None), func.date(Trip.assigned_at) == today),
                and_(Trip.completed_at.isnot(None), func.date(Trip.completed_at) == today),
            )
        )
        .scalar()
        or 0
    )

    trucks_total = db.query(func.count(Truck.id)).scalar() or 0
    operational_trucks = (
        db.query(func.count(Truck.id)).filter(func.lower(Truck.status) == "available").scalar() or 0
    )
    # Only trucks marked operational (`status == available`) count as dispatch pool.
    busy_operational = (
        db.query(func.count(func.distinct(Trip.truck_id)))
        .join(Truck, Truck.id == Trip.truck_id)
        .filter(Trip.status.in_(ACTIVE_TRIP_STATUSES), func.lower(Truck.status) == "available")
        .scalar()
        or 0
    )
    available_trucks = max(0, operational_trucks - busy_operational)

    drivers_total = (
        db.query(func.count(User.id)).filter(User.role == UserRole.DRIVER).scalar() or 0
    )
    busy_driver_rows = (
        db.query(Trip.driver_id)
        .filter(Trip.status.in_(ACTIVE_TRIP_STATUSES))
        .distinct()
        .all()
    )
    busy_driver_ids = {row[0] for row in busy_driver_rows if row[0] is not None}
    drivers_busy = len(busy_driver_ids)
    break_conds = [
        User.role == UserRole.DRIVER,
        func.lower(User.availability_status).in_(["on_break", "break"]),
    ]
    if busy_driver_ids:
        break_conds.append(User.id.notin_(busy_driver_ids))
    drivers_on_break = db.query(func.count(User.id)).filter(*break_conds).scalar() or 0
    drivers_standby = max(0, drivers_total - drivers_busy - drivers_on_break)
    drivers_idle = max(0, drivers_total - drivers_busy)  # legacy: drivers not on an active trip

    driver_user = aliased(User)
    recent_rows = (
        db.query(Trip, Booking, driver_user)
        .outerjoin(Booking, Booking.id == Trip.booking_id)
        .outerjoin(driver_user, driver_user.id == Trip.driver_id)
        .order_by(Trip.id.desc())
        .limit(12)
        .all()
    )

    trips_out = []
    for tr, booking, driver in recent_rows:
        route = ""
        if booking:
            pickup = (booking.pickup_location or "").strip()
            drop = (booking.dropoff_location or "").strip()
            route = f"{pickup[:40]}{'…' if len(pickup) > 40 else ''} → {drop[:40]}{'…' if len(drop) > 40 else ''}"
            if route == " → ":
                route = "(No route)"
        trips_out.append(
            {
                "id": tr.id,
                "display_id": f"TRP-{tr.id}",
                "driver_name": driver.full_name if driver else "—",
                "route": route or "—",
                "status": tr.status.value,
                "start_time": tr.assigned_at.isoformat() if tr.assigned_at else None,
                "eta": tr.estimated_delivery_time.isoformat() if tr.estimated_delivery_time else None,
                "booking_id": tr.booking_id,
            }
        )

    return {
        "kpis": {
            "pending_orders": pending_orders,
            "active_trips": active_trips,
            "active_trips_assigned_today": active_trips_assigned_today,
            "available_trucks": available_trucks,
            "trucks_total": trucks_total,
            "trucks_operational": operational_trucks,
            "drivers_total": drivers_total,
            "drivers_busy": drivers_busy,
            "drivers_idle": drivers_idle,
            "drivers_on_break": drivers_on_break,
            "drivers_standby": drivers_standby,
            "trips_assigned_today": trips_assigned_today,
            "trips_completed_today": trips_completed_today,
            # Distinct trip legs with assign or complete activity today (not assign+complete double count).
            "today_volume": today_trip_touchpoints,
        },
        "recent_trips": trips_out,
    }


@router.get("/operations-center")
def dispatch_operations_center(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Dispatcher control center: live counts, boards, queues, and rule-based alerts (no mock analytics)."""
    try:
        return build_operations_center_payload(db, viewer=user)
    except Exception:
        logger.exception(
            "dispatch operations-center failed user_id=%s role=%s",
            user.id,
            user.role.value if user.role else None,
        )
        raise


@router.get("/trip-logs")
def dispatch_trip_logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Unified operational history per trip leg: milestones, helper updates, locations, issues, POD."""
    return build_trip_logs_payload(db, limit=100, viewer=user)


@router.post("/operational-log")
def create_operational_log(
    trip_id: int = Form(...),
    report_type: str = Form(...),
    priority_level: str = Form(...),
    operational_details: str = Form(...),
    file: UploadFile | None = File(default=None),
    evidence_capture_source: str = Form(default=""),
    evidence_device_captured_at: str = Form(default=""),
    evidence_latitude: str = Form(default=""),
    evidence_longitude: str = Form(default=""),
    evidence_gps_accuracy_m: str = Form(default=""),
    evidence_uploader_name: str = Form(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Persist dispatcher operational incident / note for a trip (not customer feedback)."""
    rt = (report_type or "").strip()
    if rt not in REPORT_TYPE_VALUES:
        raise HTTPException(status_code=400, detail="Invalid report type")
    pl = (priority_level or "").strip().lower()
    if pl not in PRIORITY_VALUES:
        raise HTTPException(status_code=400, detail="Invalid priority level")
    details = (operational_details or "").strip()
    if len(details) < 3:
        raise HTTPException(status_code=400, detail="Operational details are required")

    trip = (
        db.query(Trip)
        .options(joinedload(Trip.booking))
        .filter(Trip.id == trip_id)
        .first()
    )
    if not trip or trip.status == TripStatus.CANCELLED:
        raise HTTPException(status_code=404, detail="Trip not found or cancelled")
    if not trip.booking_id:
        raise HTTPException(status_code=400, detail="Trip has no booking")
    assert_dispatcher_booking_access(db, user, trip.booking_id)

    attachment_url = _save_operational_log_attachment(trip_id, file)
    if attachment_url and file:
        evidence_form = parse_evidence_form(
            capture_source=evidence_capture_source,
            evidence_device_captured_at=evidence_device_captured_at,
            evidence_latitude=evidence_latitude,
            evidence_longitude=evidence_longitude,
            evidence_gps_accuracy_m=evidence_gps_accuracy_m,
            evidence_uploader_name=evidence_uploader_name,
        )
        evidence_eval = evaluate_trip_evidence(db, trip.booking, evidence_form, milestone_context="operational_log")
        rel_path = attachment_url.replace("/uploads/", "", 1) if attachment_url.startswith("/uploads/") else attachment_url
        record_evidence_capture(
            db,
            upload_path=rel_path,
            context_type="operational_log",
            trip=trip,
            booking=trip.booking,
            user=user,
            ev=evidence_eval,
            milestone_context="operational_log",
        )

    row = OperationalLog(
        booking_id=trip.booking_id,
        trip_id=trip.id,
        dispatcher_id=user.id,
        report_type=rt,
        priority_level=pl,
        operational_details=details,
        attachment_url=attachment_url,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    label = REPORT_TYPE_LABELS.get(rt, rt)
    return {
        "id": row.id,
        "booking_id": row.booking_id,
        "trip_id": row.trip_id,
        "dispatcher_id": row.dispatcher_id,
        "report_type": row.report_type,
        "report_type_label": label,
        "priority_level": row.priority_level,
        "operational_details": row.operational_details,
        "attachment_url": row.attachment_url,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


class VehicleIssueReportStatusUpdate(BaseModel):
    status: str = Field(..., min_length=3, max_length=32)


@router.get("/vehicle-issue-reports")
def list_vehicle_issue_reports(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """All driver-submitted vehicle issue reports (newest first)."""
    rows = (
        db.query(VehicleIssueReport)
        .options(
            joinedload(VehicleIssueReport.trip),
            joinedload(VehicleIssueReport.booking),
            joinedload(VehicleIssueReport.truck),
            joinedload(VehicleIssueReport.driver),
            joinedload(VehicleIssueReport.helper),
        )
        .order_by(VehicleIssueReport.created_at.desc())
        .limit(200)
        .all()
    )
    out = []
    for r in rows:
        bk = r.booking
        tk = r.truck
        route = ""
        if bk:
            route = f"{bk.pickup_location} → {bk.dropoff_location}"
        st = r.status.value if hasattr(r.status, "value") else str(r.status)
        out.append(
            {
                "id": r.id,
                "booking_id": r.booking_id,
                "trip_id": r.trip_id,
                "truck_id": r.truck_id,
                "truck_plate": tk.code if tk else "",
                "truck_model": (tk.model_name or None) if tk else None,
                "route": route,
                "driver_id": r.driver_id,
                "driver_name": r.driver.full_name if r.driver else None,
                "helper_id": r.helper_id,
                "helper_name": r.helper.full_name if r.helper else None,
                "issue_type": r.issue_type,
                "issue_type_label": VEHICLE_ISSUE_TYPE_LABELS.get(r.issue_type, r.issue_type.replace("_", " ").title()),
                "priority": r.priority,
                "description": r.description,
                "attachment_url": r.attachment_url,
                "status": st,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
        )
    return {"reports": out}


@router.patch("/vehicle-issue-reports/{report_id}")
def patch_vehicle_issue_report(
    report_id: int,
    body: VehicleIssueReportStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Mark a vehicle issue as reviewed or resolved."""
    row = db.query(VehicleIssueReport).filter(VehicleIssueReport.id == report_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    raw = (body.status or "").strip().lower()
    try:
        new_status = VehicleIssueReportStatus(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid status") from exc
    if new_status == VehicleIssueReportStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Cannot revert to submitted")

    cur = row.status
    if cur == VehicleIssueReportStatus.RESOLVED:
        if new_status != VehicleIssueReportStatus.RESOLVED:
            raise HTTPException(status_code=400, detail="Report is already resolved")
        return {"id": row.id, "status": cur.value}

    if new_status == cur:
        return {"id": row.id, "status": cur.value}

    if cur == VehicleIssueReportStatus.SUBMITTED:
        if new_status not in (VehicleIssueReportStatus.REVIEWED, VehicleIssueReportStatus.RESOLVED):
            raise HTTPException(status_code=400, detail="From submitted, status may only become reviewed or resolved")
    elif cur == VehicleIssueReportStatus.REVIEWED:
        if new_status != VehicleIssueReportStatus.RESOLVED:
            raise HTTPException(status_code=400, detail="From reviewed, status may only become resolved")

    row.status = new_status
    db.commit()
    db.refresh(row)
    return {"id": row.id, "status": row.status.value if hasattr(row.status, "value") else str(row.status)}


@router.get("/general-operational-reports")
def list_general_operational_reports_feed(
    booking_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Driver-submitted general operational forms (newest first); optional filter by booking."""
    q = (
        db.query(GeneralOperationalReport)
        .options(
            joinedload(GeneralOperationalReport.driver),
            joinedload(GeneralOperationalReport.booking),
            joinedload(GeneralOperationalReport.trip).joinedload(Trip.truck),
        )
    )
    if booking_id is not None:
        q = q.filter(GeneralOperationalReport.booking_id == booking_id)
    rows = q.order_by(GeneralOperationalReport.created_at.desc()).limit(200).all()
    out: list[dict] = []
    for r in rows:
        bk = r.booking
        route = ""
        if bk:
            route = f"{bk.pickup_location} → {bk.dropoff_location}"
        tk = r.trip.truck if r.trip else None
        plate = tk.code if tk else ""
        ts_label = None
        if r.status:
            ts_label = GENERAL_OPS_TRIP_STATUS_LABELS.get(
                r.status, r.status.replace("_", " ").title()
            )
        out.append(
            {
                "id": r.id,
                "booking_id": r.booking_id,
                "trip_id": r.trip_id,
                "driver_id": r.driver_id,
                "driver_name": r.driver.full_name if r.driver else None,
                "category": r.category,
                "category_label": GENERAL_OPS_CATEGORY_LABELS.get(
                    r.category, r.category.replace("_", " ").title()
                ),
                "trip_status": r.status,
                "trip_status_label": ts_label,
                "report_date": r.report_date.isoformat(),
                "starting_odometer_km": r.starting_odometer_km,
                "ending_odometer_km": r.ending_odometer_km,
                "fuel_consumed": r.fuel_consumed,
                "description": r.description,
                "notes": r.notes,
                "attachment_url": r.attachment_url,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "route": route,
                "truck_plate": plate,
            }
        )
    return {"reports": out}


@router.get("/trip-monitoring-board")
def dispatch_trip_monitoring_board(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Live trip monitoring: DB-backed summary counts, one card per active trip leg, human-readable locations."""
    return build_trip_monitoring_board_payload(db, list_limit=200, viewer=user)


@router.get("/roster")
def dispatch_roster(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Trucks and crew available to the dispatcher (fleet sized at four tractors)."""
    trucks = (
        db.query(Truck)
        .filter(Truck.status == "available")
        .order_by(Truck.id)
        .limit(FLEET_TRUCK_COUNT)
        .all()
    )
    drivers = (
        db.query(User)
        .filter(User.role == UserRole.DRIVER)
        .order_by(User.id)
        .limit(FLEET_TRUCK_COUNT)
        .all()
    )
    helpers = db.query(User).filter(User.role == UserRole.HELPER).order_by(User.full_name).all()
    return {
        "trucks": [{"id": t.id, "code": t.code, "capacity_tons": float(t.capacity_tons or 0)} for t in trucks],
        "drivers": [{"id": u.id, "name": u.full_name} for u in drivers],
        "helpers": [{"id": u.id, "name": u.full_name} for u in helpers],
    }


@router.get("/fleet-assets")
def fleet_assets(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """All drivers and trucks for the Assets console — live assignment from active trips."""
    active_rows = (
        db.query(Trip, Truck, User)
        .join(Truck, Truck.id == Trip.truck_id)
        .join(User, User.id == Trip.driver_id)
        .filter(Trip.status.in_(ACTIVE_TRIP_STATUSES))
        .all()
    )
    truck_active_driver: dict[int, dict] = {}
    driver_active_truck: dict[int, str] = {}
    for trip, truck, driver_u in active_rows:
        truck_active_driver[truck.id] = {"id": driver_u.id, "name": driver_u.full_name}
        driver_active_truck[driver_u.id] = truck.code

    drivers_out: list[dict] = []
    driver_users = db.query(User).filter(User.role == UserRole.DRIVER).order_by(User.full_name).all()
    for u in driver_users:
        dp = db.query(DriverProfile).filter(DriverProfile.user_id == u.id).first()
        rating = float(dp.rating) if dp else 5.0
        completed = (
            db.query(func.count(Trip.id))
            .filter(Trip.driver_id == u.id, Trip.status == TripStatus.COMPLETED)
            .scalar()
            or 0
        )
        on_trip = u.id in driver_active_truck
        drivers_out.append(
            {
                "id": u.id,
                "name": u.full_name,
                "phone": u.phone or "",
                "rating": round(rating, 1),
                "completed_trips": int(completed),
                "status": "on_trip" if on_trip else "available",
                "assigned_truck_code": driver_active_truck.get(u.id),
            }
        )

    trucks_out: list[dict] = []
    for t in db.query(Truck).order_by(Truck.id).all():
        ad = truck_active_driver.get(t.id)
        st = (t.status or "available").lower()
        if ad is not None:
            disp_status = "in_use"
        elif st == "maintenance":
            disp_status = "maintenance"
        else:
            disp_status = "available"
        trucks_out.append(
            {
                "id": t.id,
                "plate": t.code,
                "model_name": t.model_name or "",
                "capacity_tons": float(t.capacity_tons or 0),
                "status": disp_status,
                "db_status": st,
                "odometer_km": float(t.odometer_km or 0),
                "age_years": float(t.age_years or 0),
                "assigned_driver_name": ad["name"] if ad else None,
                "assigned_driver_id": ad["id"] if ad else None,
            }
        )

    return {"drivers": drivers_out, "trucks": trucks_out}


@router.get("/assignments-board")
def assignments_board(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Trips already assigned — used for capacity and dispatcher oversight."""
    trips = (
        db.query(Trip)
        .options(
            joinedload(Trip.booking).joinedload(Booking.customer),
            joinedload(Trip.driver),
            joinedload(Trip.helper),
            joinedload(Trip.truck),
        )
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Trip.status != TripStatus.CANCELLED)
        .order_by(Booking.scheduled_date.desc(), Trip.id.desc())
        .limit(200)
        .all()
    )
    trips = filter_trips_for_dispatcher(db, user, trips)
    trips_by_booking: defaultdict[int, list[Trip]] = defaultdict(list)
    for tr in trips:
        trips_by_booking[tr.booking_id].append(tr)
    booking_display_status = {
        bid: aggregate_customer_display_from_trips(ts) for bid, ts in trips_by_booking.items()
    }

    leg_km_cache: dict[int, float | None] = {}
    booking_ids = [tr.booking_id for tr in trips]
    paid_map = paid_verified_amount_by_booking_ids(db, booking_ids)
    out = []
    for tr in trips:
        bk = tr.booking
        tk = tr.truck
        dr = tr.driver
        hp = tr.helper
        cust = bk.customer if bk else None
        latest_loc = (
            db.query(TripLocationUpdate.location_name, TripLocationUpdate.created_at)
            .filter(TripLocationUpdate.trip_id == tr.id)
            .order_by(TripLocationUpdate.created_at.desc())
            .first()
        )
        loc_name = (latest_loc[0] if latest_loc else None) or getattr(tr, "latest_location", None)
        loc_display = latest_location_display_for_trip(tr, bk.dropoff_location, loc_name)
        helper_status = getattr(tr, "helper_progress_status", None)
        effective_booking_status = booking_display_status.get(
            bk.id, bk.status.value if hasattr(bk.status, "value") else str(bk.status)
        )
        if bk.id not in leg_km_cache:
            leg_km_cache[bk.id] = booking_pickup_dropoff_distance_km(bk)
        geo_leg_km = leg_km_cache[bk.id]
        display_distance_km = float(geo_leg_km) if geo_leg_km is not None else float(tr.distance_km or 0)
        out.append(
            {
                "trip_id": tr.id,
                "trip_status": tr.status.value if hasattr(tr.status, "value") else str(tr.status),
                "booking_id": bk.id,
                "customer_id": bk.customer_id,
                "customer_name": cust.full_name if cust else None,
                "customer_company_name": (cust.company_name or None) if cust else None,
                "pickup_location": bk.pickup_location,
                "dropoff_location": bk.dropoff_location,
                "scheduled_date": bk.scheduled_date.isoformat(),
                "scheduled_time_slot": bk.scheduled_time_slot,
                "cargo_weight_tons": bk.cargo_weight_tons,
                "estimated_cost": float(bk.estimated_cost or 0),
                "booking_status": effective_booking_status,
                "paid_amount_verified": paid_map.get(bk.id),
                "truck_id": tk.id if tk else None,
                "truck_code": tk.code if tk else "",
                "driver_id": dr.id if dr else None,
                "driver_name": dr.full_name if dr else None,
                "helper_id": hp.id if hp else None,
                "helper_name": hp.full_name if hp else None,
                "helper_progress_status": helper_status,
                "distance_km": display_distance_km,
                "latest_location": loc_display,
                "last_updated": latest_loc[1].isoformat() if latest_loc and latest_loc[1] else None,
            }
        )
    return {"assignments": out}


class ManualAssignment(BaseModel):
    truck_id: int | None = None
    driver_id: int | None = None
    helper_id: int | None = None
    route_path: list[str] | None = None
    distance_km: float | None = None
    duration_hours: float | None = None
    fuel_cost: float | None = None
    toll_cost: float | None = None
    labor_cost: float | None = None
    driver_allowance_php: float | None = None
    helper_allowance_php: float | None = None
    predicted_total_cost: float | None = None


class MultiAssignmentItem(BaseModel):
    truck_id: int = Field(..., gt=0)
    driver_id: int = Field(..., gt=0)
    helper_id: int = Field(..., gt=0)
    assigned_weight: float = Field(..., gt=0)


class MultiAssignPayload(BaseModel):
    assignments: list[MultiAssignmentItem]


def _compute_weight_splits(total_weight: float, required: int) -> list[float]:
    remaining = round(float(total_weight), 3)
    out: list[float] = []
    for i in range(required):
        if i < required - 1:
            chunk = min(42.0, remaining)
            out.append(round(chunk, 3))
            remaining = round(max(0.0, remaining - chunk), 3)
        else:
            out.append(round(remaining, 3))
    return out


def _available_resources_for_booking(db: Session, booking: Booking) -> dict:
    return build_booking_resource_availability(db, booking)


@router.get("/booking/{booking_id}/availability")
def booking_resource_availability(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    assert_dispatcher_booking_access(db, user, booking.id)
    required = int(booking.required_truck_count or trucks_required_for_cargo(booking.cargo_weight_tons))
    return {
        "booking_id": booking.id,
        "required_truck_count": required,
        "cargo_weight_tons": float(booking.cargo_weight_tons),
        "weight_splits": _compute_weight_splits(float(booking.cargo_weight_tons), required),
        "selected_route_option_id": (
            resolve_dispatch_route(db, booking).get("selected_route_option_id")
        ),
        **_available_resources_for_booking(db, booking),
    }


@router.get("/booking/{booking_id}/route-options")
def booking_route_options(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    assert_dispatcher_booking_access(db, user, booking.id)
    options = list_booking_route_options(db, booking.id)
    selected = next((o for o in options if o["is_selected"]), None)
    return {
        "booking_id": booking.id,
        "pickup_location": booking.pickup_location,
        "dropoff_location": booking.dropoff_location,
        "selected_route_option_id": selected["id"] if selected else None,
        "options": options,
        "map_verification_warning": map_verification_warning_for_booking(booking),
    }


@router.post("/booking/{booking_id}/route-options/generate")
def generate_booking_route_options(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    assert_dispatcher_booking_access(db, user, booking.id)
    options, map_warning = generate_route_options_for_booking(db, booking)
    db.commit()
    options = list_booking_route_options(db, booking.id)
    selected = next((o for o in options if o["is_selected"]), None)
    return {
        "booking_id": booking.id,
        "generated": len(options),
        "selected_route_option_id": selected["id"] if selected else None,
        "options": options,
        "map_verification_warning": map_warning or map_verification_warning_for_booking(booking),
    }


@router.patch("/booking/{booking_id}/route-options/select")
def select_booking_route_option(
    booking_id: int,
    payload: DispatchRouteSelectRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    assert_dispatcher_booking_access(db, user, booking.id)
    try:
        select_route_option(db, booking.id, payload.route_option_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    notify_drivers_booking_route_updated(db, booking.id)
    db.commit()
    options = list_booking_route_options(db, booking.id)
    return {
        "booking_id": booking.id,
        "selected_route_option_id": payload.route_option_id,
        "options": options,
        "map_verification_warning": map_verification_warning_for_booking(booking),
    }


@router.post("/booking/{booking_id}/route-options/manual")
def save_booking_manual_route(
    booking_id: int,
    payload: DispatchManualRouteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    assert_dispatcher_booking_access(db, user, booking.id)
    save_manual_route_option(
        db,
        booking,
        route_name=payload.route_name,
        distance_km=payload.distance_km,
        duration_hours=payload.duration_hours,
        toll_cost_php=payload.toll_cost_php,
        notes=payload.notes,
    )
    notify_drivers_booking_route_updated(db, booking.id)
    db.commit()
    options = list_booking_route_options(db, booking.id)
    selected = next((o for o in options if o["is_selected"]), None)
    return {
        "booking_id": booking.id,
        "selected_route_option_id": selected["id"] if selected else None,
        "options": options,
        "map_verification_warning": map_verification_warning_for_booking(booking),
    }


@router.post("/{booking_id}/assign-batch")
def assign_batch(
    booking_id: int,
    payload: MultiAssignPayload,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    assert_dispatcher_booking_access(db, user, booking.id)
    if booking.status not in {
        BookingStatus.PAYMENT_VERIFIED,
        BookingStatus.READY_FOR_ASSIGNMENT,
        BookingStatus.ASSIGNED,
        BookingStatus.APPROVED,
    }:
        raise HTTPException(status_code=400, detail=f"Booking status {booking.status} is not ready for assignment.")

    try:
        assert_booking_ready_for_dispatch_assignment(db, booking)
    except BookingNotReadyForDispatchError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    required = int(booking.required_truck_count or trucks_required_for_cargo(booking.cargo_weight_tons))
    rows = payload.assignments or []
    if len(rows) != required:
        raise HTTPException(status_code=400, detail=f"Exactly {required} assignment rows are required.")

    t_ids = [r.truck_id for r in rows]
    d_ids = [r.driver_id for r in rows]
    h_ids = [r.helper_id for r in rows]
    if len(set(t_ids)) != len(t_ids) or len(set(d_ids)) != len(d_ids) or len(set(h_ids)) != len(h_ids):
        raise HTTPException(status_code=400, detail="Duplicate truck/driver/helper selections are not allowed.")
    total_assigned = round(sum(float(r.assigned_weight) for r in rows), 3)
    if abs(total_assigned - round(float(booking.cargo_weight_tons), 3)) > 0.01:
        raise HTTPException(status_code=400, detail="Assigned weights must total the booking cargo weight.")

    availability = _available_resources_for_booking(db, booking)
    available_trucks = {x["id"] for x in availability["trucks"]}
    available_drivers = {x["id"] for x in availability["drivers"]}
    available_helpers = {x["id"] for x in availability["helpers"]}
    if any(t not in available_trucks for t in t_ids) or any(d not in available_drivers for d in d_ids) or any(
        h not in available_helpers for h in h_ids
    ):
        conflict_msgs: list[str] = []
        truck_by_id = {r["id"]: r for r in availability.get("truck_roster", [])}
        driver_by_id = {r["id"]: r for r in availability.get("driver_roster", [])}
        helper_by_id = {r["id"]: r for r in availability.get("helper_roster", [])}
        for t_id in t_ids:
            if t_id not in available_trucks:
                reason = truck_by_id.get(t_id, {}).get("conflict_reason")
                if reason:
                    conflict_msgs.append(reason)
        for d_id in d_ids:
            if d_id not in available_drivers:
                reason = driver_by_id.get(d_id, {}).get("conflict_reason")
                if reason:
                    conflict_msgs.append(reason)
        for h_id in h_ids:
            if h_id not in available_helpers:
                reason = helper_by_id.get(h_id, {}).get("conflict_reason")
                if reason:
                    conflict_msgs.append(reason)
        detail = conflict_msgs[0] if conflict_msgs else (
            "One or more selected trucks, drivers, or helpers are no longer available for this schedule."
        )
        raise HTTPException(status_code=409, detail=detail)

    created_trip_ids: list[int] = []
    for item in rows:
        truck = db.query(Truck).filter(Truck.id == item.truck_id).with_for_update().first()
        driver = db.query(User).filter(User.id == item.driver_id, User.role == UserRole.DRIVER).with_for_update().first()
        helper = db.query(User).filter(User.id == item.helper_id, User.role == UserRole.HELPER).with_for_update().first()
        if not truck or not driver or not helper:
            raise HTTPException(status_code=409, detail="One or more selected resources were not found.")
        validation_error = validate_resource_assignment(
            db,
            booking,
            truck_id=truck.id,
            driver_id=driver.id,
            helper_id=helper.id,
        )
        if validation_error:
            raise HTTPException(status_code=409, detail=validation_error)

    route_ctx = resolve_dispatch_route(db, booking)
    distance = float(route_ctx["distance_km"])
    duration = float(route_ctx["duration_hours"])
    route_path_json = json.dumps(route_ctx["path"])
    trip_fuel_cost = float(route_ctx["fuel_cost"])
    trip_toll_cost = float(route_ctx["toll_cost"])
    estimated_toll_budget = booking.estimated_toll_budget_php
    selected_route_option_id = route_ctx.get("selected_route_option_id")
    driver_allowance, helper_allowance = resolve_trip_crew_allowances(db)
    for item in rows:
        trip = Trip(
            booking_id=booking.id,
            truck_id=item.truck_id,
            driver_id=item.driver_id,
            helper_id=item.helper_id,
            dispatcher_id=user.id,
            selected_route_option_id=selected_route_option_id,
            route_path=route_path_json,
            distance_km=distance,
            toll_cost=trip_toll_cost,
            estimated_toll_budget=estimated_toll_budget,
            fuel_cost=trip_fuel_cost,
            labor_cost=80.0,
            driver_allowance_php=driver_allowance,
            helper_allowance_php=helper_allowance,
            receiving_qr_token=token_urlsafe(16),
            duration_hours=duration,
            predicted_total_cost=0.0,
            status=TripStatus.ASSIGNED,
            helper_progress_status="for_pickup",
            assigned_at=datetime.utcnow(),
            estimated_delivery_time=datetime.utcnow() + timedelta(hours=duration + 2),
        )
        ta = TruckAssignment(
            booking_id=booking.id,
            truck_id=item.truck_id,
            driver_id=item.driver_id,
            helper_id=item.helper_id,
            assigned_weight=float(item.assigned_weight),
            assignment_status=TruckAssignmentStatus.FOR_PICKUP,
        )
        mark_resources_assigned(db, truck=truck, driver=driver, helper=helper)
        db.add(trip)
        db.add(ta)
        db.flush()
        created_trip_ids.append(trip.id)
        notify_driver_trip_assigned(db, trip, booking)

    apply_aggregate_booking_status(db, booking)
    auto_assign_dispatcher_on_dispatch_action(db, booking.id, user)
    db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
        {"hold_status": TruckSlotHoldStatus.ASSIGNED}
    )
    db.commit()

    return {"booking_id": booking.id, "trip_ids": created_trip_ids, "assigned_count": len(created_trip_ids)}


@router.post("/{booking_id}/assign")
def assign_trip(
    booking_id: int,
    payload: ManualAssignment | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Assign truck/driver/helper to a booking.

    Manual mode: the dispatcher passes truck_id/driver_id/helper_id (and optionally
    a route + cost preview from `/api/analytics/optimize-route`).
    Automatic mode: when no payload is provided we fall back to scheduler heuristics.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    assert_dispatcher_booking_access(db, user, booking.id)
    if booking.status not in {
        BookingStatus.PAYMENT_VERIFIED,
        BookingStatus.READY_FOR_ASSIGNMENT,
        BookingStatus.ASSIGNED,
        BookingStatus.APPROVED,
    }:
        raise HTTPException(
            status_code=400,
            detail=f"Booking status {booking.status} is not ready for dispatcher assignment.",
        )

    try:
        assert_booking_ready_for_dispatch_assignment(db, booking)
    except BookingNotReadyForDispatchError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    need = trucks_required_for_cargo(booking.cargo_weight_tons)
    active = (
        db.query(Trip)
        .filter(
            Trip.booking_id == booking.id,
            ~Trip.status.in_({TripStatus.COMPLETED, TripStatus.CANCELLED}),
        )
        .count()
    )
    if active >= need:
        raise HTTPException(
            status_code=400,
            detail="This booking already has the required number of truck assignments.",
        )

    payload = payload or ManualAssignment()

    truck: Truck | None = None
    driver: User | None = None
    helper: User | None = None

    if payload.truck_id:
        truck = db.query(Truck).filter(Truck.id == payload.truck_id).first()
    if payload.driver_id:
        driver = db.query(User).filter(
            User.id == payload.driver_id, User.role == UserRole.DRIVER
        ).first()
    if payload.helper_id:
        helper = db.query(User).filter(
            User.id == payload.helper_id, User.role == UserRole.HELPER
        ).first()

    if not truck:
        truck = find_available_truck(db, booking.scheduled_date, booking)
    if not driver:
        driver = find_available_driver(db, booking.scheduled_date, booking)
    if not helper:
        helper = find_available_helper(db, booking.scheduled_date, booking)

    if not truck or not driver:
        raise HTTPException(status_code=400, detail="No available truck/driver for this window")

    validation_error = validate_resource_assignment(
        db,
        booking,
        truck_id=truck.id,
        driver_id=driver.id,
        helper_id=helper.id if helper else None,
    )
    if validation_error:
        raise HTTPException(status_code=400, detail=validation_error)

    geo_km = booking_pickup_dropoff_distance_km(booking)
    route_ctx = resolve_dispatch_route(db, booking)
    path_list = (
        list(payload.route_path)
        if payload.route_path
        else route_ctx["path"]
    )
    if payload.distance_km is not None and float(payload.distance_km) > 0:
        distance = float(payload.distance_km)
    elif route_ctx.get("selected_route_option_id") and not payload.route_path:
        distance = float(route_ctx["distance_km"])
    elif geo_km is not None:
        distance = float(geo_km)
    else:
        distance = float(route_ctx["distance_km"])
    if distance <= 0:
        distance = 120.0
    duration = payload.duration_hours or max(distance / 50.0, 1.0)
    fuel_cost = float(payload.fuel_cost) if payload.fuel_cost is not None else float(route_ctx["fuel_cost"])
    toll_cost = float(payload.toll_cost) if payload.toll_cost is not None else float(route_ctx["toll_cost"])
    selected_route_option_id = (
        route_ctx.get("selected_route_option_id") if not payload.route_path else None
    )

    driver_allowance, helper_allowance = resolve_trip_crew_allowances(
        db,
        driver_allowance_php=payload.driver_allowance_php,
        helper_allowance_php=payload.helper_allowance_php,
    )

    trip = Trip(
        booking_id=booking.id,
        truck_id=truck.id,
        driver_id=driver.id,
        helper_id=helper.id if helper else None,
        dispatcher_id=user.id,
        selected_route_option_id=selected_route_option_id,
        route_path=json.dumps(path_list),
        distance_km=float(distance),
        toll_cost=toll_cost,
        estimated_toll_budget=booking.estimated_toll_budget_php,
        fuel_cost=fuel_cost,
        labor_cost=float(payload.labor_cost or 80),
        driver_allowance_php=driver_allowance,
        helper_allowance_php=helper_allowance,
        receiving_qr_token=token_urlsafe(16),
        duration_hours=float(duration),
        predicted_total_cost=float(payload.predicted_total_cost or 0),
        status=TripStatus.ASSIGNED,
        helper_progress_status="for_pickup",
        assigned_at=datetime.utcnow(),
        estimated_delivery_time=datetime.utcnow() + timedelta(hours=duration + 2),
    )
    per_truck_weight = float(booking.cargo_weight_tons or 0) / max(1, int(need))
    db.add(
        TruckAssignment(
            booking_id=booking.id,
            truck_id=truck.id,
            driver_id=driver.id,
            helper_id=helper.id if helper else None,
            assigned_weight=per_truck_weight,
            assignment_status=TruckAssignmentStatus.FOR_PICKUP,
        )
    )
    mark_resources_assigned(db, truck=truck, driver=driver, helper=helper)
    next_hold_status = (
        TruckSlotHoldStatus.ASSIGNED if active + 1 >= need else TruckSlotHoldStatus.READY_FOR_ASSIGNMENT
    )
    db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
        {"hold_status": next_hold_status}
    )

    db.add(trip)
    db.flush()
    notify_driver_trip_assigned(db, trip, booking)
    apply_aggregate_booking_status(db, booking)
    auto_assign_dispatcher_on_dispatch_action(db, booking.id, user)
    db.commit()
    db.refresh(trip)

    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer:
        subject, html_body = EmailTemplate.trip_assigned(
            trip_id=trip.id,
            driver_name=driver.full_name,
            truck_code=truck.code,
            pickup=booking.pickup_location,
            dropoff=booking.dropoff_location,
        )
        send_email_notification(to_email=customer.email, subject=subject, html_body=html_body)

    route_label = f"{booking.pickup_location} → {booking.dropoff_location}"
    return {
        "trip_id": trip.id,
        "booking_id": booking.id,
        "truck_id": truck.id,
        "driver_id": driver.id,
        "helper_id": helper.id if helper else None,
        "route": route_label,
    }


@router.post("/trip/{trip_id}/status")
def update_trip_status(
    trip_id: int,
    status: BookingStatus,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.DRIVER, UserRole.ADMIN)),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if status == BookingStatus.COMPLETED:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "delivery_verification_required",
                "message": "Booking completion requires customer verification by the assigned helper.",
            },
        )

    booking.status = status
    db.commit()
    return {"booking_id": booking.id, "status": booking.status}


@router.get("/trip-cost-ledger")
def trip_cost_ledger(
    trip_id: int | None = None,
    booking_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Shoulder-cost ledger summary per trip leg. System trip costs are read-only; ledger is additive."""
    safe_limit = min(max(limit, 1), 300)
    return build_trip_cost_ledger_payload(
        db,
        viewer=user,
        trip_id=trip_id,
        booking_id=booking_id,
        limit=safe_limit,
    )


@router.get("/trips/{trip_id}/shoulder-costs")
def list_trip_shoulder_costs(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    assert_dispatcher_booking_access(db, user, trip.booking_id)
    payload = build_trip_cost_ledger_payload(db, viewer=user, trip_id=trip_id, limit=1)
    rows = payload["trips"]
    if not rows:
        return {"trip_id": trip_id, "entries": [], "shoulder_totals": {}, "shoulder_grand_total": 0}
    row = rows[0]
    return {
        "trip_id": trip_id,
        "booking_id": row["booking_id"],
        "system_costs": row["system_costs"],
        "shoulder_totals": row["shoulder_totals"],
        "shoulder_grand_total": row["shoulder_grand_total"],
        "entries": row["entries"],
    }


@router.post("/trips/{trip_id}/shoulder-costs")
def create_trip_shoulder_cost(
    trip_id: int,
    payload: TripShoulderCostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    """Record a shoulder / out-of-pocket trip expense. Does not modify trip.fuel_cost or other computed fields."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.status == TripStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot add costs to a cancelled trip.")
    assert_dispatcher_booking_access(db, user, trip.booking_id)

    entry = add_shoulder_cost_entry(
        db,
        trip=trip,
        dispatcher=user,
        category=payload.category,
        amount_php=payload.amount_php,
        notes=payload.notes,
    )
    db.commit()
    db.refresh(entry)
    return {
        "id": entry.id,
        "trip_id": entry.trip_id,
        "booking_id": entry.booking_id,
        "dispatcher_id": entry.dispatcher_id,
        "category": entry.category,
        "category_label": shoulder_cost_category_label(entry.category),
        "amount_php": float(entry.amount_php),
        "notes": entry.notes,
        "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None,
    }
