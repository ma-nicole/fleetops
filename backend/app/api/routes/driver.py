from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import (
    AttendanceRecord,
    Booking,
    DriverProfile,
    DriverTripNotification,
    GeneralOperationalReport,
    HelperProfile,
    Trip,
    TripLocationUpdate,
    TripStatusUpdate,
    User,
    UserRole,
    VehicleIssueReport,
    VehicleIssueReportStatus,
)
from app.services.booking_paid_amount import paid_verified_amount_by_booking_ids
from app.services.dispatch_operations_center import _display_status
from app.services.driver_dashboard_metrics import CrewRole, build_crew_dashboard_metrics
from app.services.driver_pay_summary import build_driver_pay_summary
from app.services.crew_assigned_bookings import list_crew_assigned_bookings, redact_trip_payload_for_helper
from app.services.driver_trip_notifications import (
    list_driver_trip_notifications,
    mark_all_driver_notifications_read,
    mark_driver_notification_read,
)
from app.services.general_operational_reports import (
    parse_optional_float,
    parse_report_date,
    save_general_ops_attachment,
    validate_general_ops_payload,
)
from app.services.latest_location_display import latest_location_display_for_trip
from app.services.notifications import send_email_notification
from app.services.vehicle_issue_reports import (
    assert_trip_selectable_for_driver,
    list_selectable_trips_for_vehicle_issue,
    save_vehicle_issue_attachment,
    serialize_selectable_trip,
    validate_issue_payload,
)


router = APIRouter(prefix="/driver", tags=["driver"])

OPERATIONAL_STATUS_LABELS: dict[str, str] = {
    "assigned": "Assigned",
    "for_pickup": "For pickup",
    "picked_up": "Picked up",
    "en_route": "En route",
    "dropped_off": "Dropped off",
    "completed": "Completed",
}


def _operational_status_label(slug: str) -> str:
    return OPERATIONAL_STATUS_LABELS.get(slug, slug.replace("_", " ").title())


def _group_trip_updates(rows, *, max_per_trip: int) -> dict[int, list]:
    grouped: dict[int, list] = {}
    for row in rows:
        bucket = grouped.setdefault(row.trip_id, [])
        if len(bucket) < max_per_trip:
            bucket.append(row)
    return grouped


def _latest_ping_from_updates(
    trip: Trip,
    location_updates: list[TripLocationUpdate],
    status_updates: list[TripStatusUpdate],
) -> str | None:
    latest_ping = None
    if location_updates:
        latest_ping = location_updates[-1].location_name
    if not (latest_ping or "").strip():
        for su in reversed(status_updates):
            if (su.location_name or "").strip():
                latest_ping = su.location_name
                break
    if not (latest_ping or "").strip():
        latest_ping = getattr(trip, "latest_location", None)
    return latest_ping


def _resolve_latest_ping(
    trip: Trip,
    *,
    latest_location_ping: str | None,
    latest_status_location: str | None,
) -> str | None:
    latest_ping = latest_location_ping
    if not (latest_ping or "").strip():
        latest_ping = latest_status_location
    if not (latest_ping or "").strip():
        latest_ping = getattr(trip, "latest_location", None)
    return latest_ping


def _serialize_location_updates(rows: list[TripLocationUpdate]) -> list[dict]:
    return [
        {
            "location_name": lu.location_name,
            "remarks": lu.remarks,
            "photo_url": lu.photo_url,
            "created_at": lu.created_at.isoformat(),
        }
        for lu in rows
    ]


def _serialize_status_timeline(rows: list[TripStatusUpdate]) -> list[dict]:
    return [
        {
            "status": su.status,
            "location_name": su.location_name,
            "remarks": su.remarks,
            "photo_url": su.photo_url,
            "created_at": su.created_at.isoformat(),
        }
        for su in rows
    ]


def _open_attendance_row(db: Session, user_id: int) -> AttendanceRecord | None:
    return (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.user_id == user_id, AttendanceRecord.check_out_time.is_(None))
        .order_by(AttendanceRecord.check_in_time.desc())
        .first()
    )


@router.get("/dashboard-summary")
def driver_dashboard_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.HELPER)),
):
    """Live KPIs for the shared operations dashboard — scoped to driver or helper legs."""
    today = datetime.utcnow().date()
    role: CrewRole = "helper" if user.role == UserRole.HELPER else "driver"
    metrics = build_crew_dashboard_metrics(db, crew_user_id=user.id, role=role, today=today)
    open_row = _open_attendance_row(db, user.id)
    if user.role == UserRole.DRIVER:
        profile = db.query(DriverProfile).filter(DriverProfile.user_id == user.id).first()
        if profile:
            base = float(profile.base_salary or 0)
            ded = float(profile.deduction_amount or 0)
            metrics["driver_profile"] = {
                "base_salary_php": base,
                "deductions_php": ded,
                "net_salary_php": max(base - ded, 0),
                "compliance_status": profile.compliance_status,
                "rating": float(profile.rating or 0),
            }
        else:
            metrics["driver_profile"] = None
        metrics["helper_profile"] = None
    else:
        metrics["driver_profile"] = None
        hp = db.query(HelperProfile).filter(HelperProfile.user_id == user.id).first()
        if hp:
            metrics["helper_profile"] = {
                "base_salary_php": float(hp.base_salary or 0),
                "rating": float(hp.rating or 0),
            }
        else:
            metrics["helper_profile"] = None
    metrics["crew_role"] = role
    metrics["generated_at"] = datetime.utcnow().isoformat()
    metrics["attendance"] = {
        "has_open_shift": open_row is not None,
        "check_in_at": open_row.check_in_time.isoformat() if open_row else None,
        "can_check_in": open_row is None,
    }
    return metrics


@router.get("/bookings")
def driver_list_assigned_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """Same payload as GET /helper/bookings — scoped to trips where this user is the driver."""
    return {"bookings": list_crew_assigned_bookings(db, user)}


@router.get("/notifications")
def driver_trip_notifications(
    unread_only: bool = False,
    limit: int = 30,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """In-app alerts when trips are assigned or updated for this driver."""
    rows = list_driver_trip_notifications(db, user.id, unread_only=unread_only, limit=limit)
    unread_count = (
        db.query(DriverTripNotification)
        .filter(
            DriverTripNotification.driver_id == user.id,
            DriverTripNotification.read_at.is_(None),
        )
        .count()
    )
    return {"notifications": rows, "unread_count": unread_count}


@router.patch("/notifications/{notification_id}/read")
def driver_mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    row = mark_driver_notification_read(db, user.id, notification_id)
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.commit()
    return row


@router.post("/notifications/mark-all-read")
def driver_mark_all_notifications_read(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    count = mark_all_driver_notifications_read(db, user.id)
    db.commit()
    return {"marked_read": count}


@router.get("/pay-summary")
def driver_pay_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """Completed-trip pay accrual for the logged-in driver (current month + recent history)."""
    today = datetime.utcnow().date()
    return build_driver_pay_summary(db, driver_user_id=user.id, today=today)


@router.get("/vehicle-issue/trips")
def driver_vehicle_issue_selectable_trips(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """Trips the driver may attach to a vehicle issue report (active + recently completed)."""
    trips = list_selectable_trips_for_vehicle_issue(db, user.id)
    return {"trips": [serialize_selectable_trip(t) for t in trips]}


@router.post("/vehicle-issue-reports")
async def driver_submit_vehicle_issue_report(
    trip_id: int = Form(...),
    issue_type: str = Form(...),
    priority: str = Form(...),
    description: str = Form(...),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """Persist a vehicle issue report for the driver's trip; optional photo proof."""
    trip = assert_trip_selectable_for_driver(db, trip_id=trip_id, driver_id=user.id)
    it, pr, desc = validate_issue_payload(issue_type, priority, description)
    attachment_url = save_vehicle_issue_attachment(trip_id, file)

    row = VehicleIssueReport(
        booking_id=trip.booking_id,
        trip_id=trip.id,
        truck_id=trip.truck_id,
        driver_id=user.id,
        helper_id=trip.helper_id,
        issue_type=it,
        priority=pr,
        description=desc,
        attachment_url=attachment_url,
        status=VehicleIssueReportStatus.SUBMITTED,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    if trip.dispatcher_id:
        dispatcher = db.query(User).filter(User.id == trip.dispatcher_id).first()
        if dispatcher and (dispatcher.email or "").strip():
            send_email_notification(
                to_email=dispatcher.email,
                subject=f"Vehicle issue reported — Trip #{trip.id}",
                html_body=(
                    f"<p>Driver {user.full_name} reported a vehicle issue on trip #{trip.id} "
                    f"(booking #{trip.booking_id}).</p><p><strong>Type:</strong> {it}<br/>"
                    f"<strong>Priority:</strong> {pr}</p><p>{desc[:500]}</p>"
                ),
            )

    return {
        "id": row.id,
        "booking_id": row.booking_id,
        "trip_id": row.trip_id,
        "truck_id": row.truck_id,
        "driver_id": row.driver_id,
        "helper_id": row.helper_id,
        "issue_type": row.issue_type,
        "priority": row.priority,
        "description": row.description,
        "attachment_url": row.attachment_url,
        "status": row.status.value if hasattr(row.status, "value") else str(row.status),
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


@router.get("/general-operational-form/trips")
def driver_general_operational_form_trips(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """Trips the driver may attach to a general operational report (same eligibility as vehicle-issue trips)."""
    trips = list_selectable_trips_for_vehicle_issue(db, user.id)
    return {"trips": [serialize_selectable_trip(t) for t in trips]}


@router.post("/general-operational-reports")
async def driver_submit_general_operational_report(
    trip_id: int = Form(...),
    report_date: str = Form(...),
    category: str = Form(...),
    trip_status: str = Form(default=""),
    starting_odometer: str = Form(default=""),
    ending_odometer: str = Form(default=""),
    fuel_consumed: str = Form(default=""),
    description: str = Form(...),
    notes: str = Form(default=""),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
):
    """Persist a driver general operational report (fuel, delays, completion notes, incidents, etc.)."""
    trip = assert_trip_selectable_for_driver(db, trip_id=trip_id, driver_id=user.id)
    rd = parse_report_date(report_date)
    cat, ts, desc = validate_general_ops_payload(
        category=category,
        trip_status=trip_status or None,
        description=description,
    )
    start_km = parse_optional_float(starting_odometer, "starting odometer")
    end_km = parse_optional_float(ending_odometer, "ending odometer")
    fuel = parse_optional_float(fuel_consumed, "fuel consumed")
    notes_s = (notes or "").strip() or None
    attachment_url = save_general_ops_attachment(trip_id, file)

    row = GeneralOperationalReport(
        booking_id=trip.booking_id,
        trip_id=trip.id,
        driver_id=user.id,
        helper_id=trip.helper_id,
        category=cat,
        status=ts,
        report_date=rd,
        starting_odometer_km=start_km,
        ending_odometer_km=end_km,
        fuel_consumed=fuel,
        description=desc,
        notes=notes_s,
        attachment_url=attachment_url,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "id": row.id,
        "booking_id": row.booking_id,
        "trip_id": row.trip_id,
        "driver_id": row.driver_id,
        "helper_id": row.helper_id,
        "category": row.category,
        "trip_status": row.status,
        "report_date": row.report_date.isoformat(),
        "starting_odometer_km": row.starting_odometer_km,
        "ending_odometer_km": row.ending_odometer_km,
        "fuel_consumed": row.fuel_consumed,
        "description": row.description,
        "notes": row.notes,
        "attachment_url": row.attachment_url,
        "created_at": row.created_at.isoformat(),
    }


@router.get("/trips")
def my_trips(
    include_timeline: bool = Query(
        False,
        description="When true, embed location_updates and status_timeline per trip (heavier payload).",
    ),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.HELPER)),
):
    q = db.query(Trip).options(
        joinedload(Trip.booking).joinedload(Booking.customer),
        joinedload(Trip.truck),
        joinedload(Trip.helper),
        joinedload(Trip.driver),
    )
    if user.role == UserRole.DRIVER:
        q = q.filter(Trip.driver_id == user.id)
    else:
        q = q.filter(Trip.helper_id == user.id)
    trips = q.order_by(Trip.id.desc()).limit(100).all()
    trip_ids = [t.id for t in trips]
    paid_map = paid_verified_amount_by_booking_ids(db, [t.booking_id for t in trips])

    loc_by_trip: dict[int, list[TripLocationUpdate]] = {}
    status_by_trip: dict[int, list[TripStatusUpdate]] = {}
    latest_loc_ping: dict[int, str | None] = {}
    latest_status_loc: dict[int, str | None] = {}
    if trip_ids:
        if include_timeline:
            loc_rows = (
                db.query(TripLocationUpdate)
                .filter(TripLocationUpdate.trip_id.in_(trip_ids))
                .order_by(TripLocationUpdate.trip_id, TripLocationUpdate.created_at.asc())
                .all()
            )
            status_rows = (
                db.query(TripStatusUpdate)
                .filter(TripStatusUpdate.trip_id.in_(trip_ids))
                .order_by(TripStatusUpdate.trip_id, TripStatusUpdate.created_at.asc())
                .all()
            )
            loc_by_trip = _group_trip_updates(loc_rows, max_per_trip=50)
            status_by_trip = _group_trip_updates(status_rows, max_per_trip=100)
        else:
            loc_rows = (
                db.query(TripLocationUpdate)
                .filter(TripLocationUpdate.trip_id.in_(trip_ids))
                .order_by(TripLocationUpdate.trip_id, TripLocationUpdate.created_at.desc())
                .all()
            )
            for loc in loc_rows:
                if loc.trip_id not in latest_loc_ping:
                    latest_loc_ping[loc.trip_id] = loc.location_name
            status_rows = (
                db.query(TripStatusUpdate)
                .filter(TripStatusUpdate.trip_id.in_(trip_ids))
                .order_by(TripStatusUpdate.trip_id, TripStatusUpdate.created_at.desc())
                .all()
            )
            for su in status_rows:
                if su.trip_id not in latest_status_loc and (su.location_name or "").strip():
                    latest_status_loc[su.trip_id] = su.location_name

    out = []
    for t in trips:
        bk = t.booking
        tk = t.truck
        cust = bk.customer if bk else None
        if include_timeline:
            location_updates = loc_by_trip.get(t.id, [])
            status_updates = status_by_trip.get(t.id, [])
            latest_ping = _latest_ping_from_updates(t, location_updates, status_updates)
        else:
            location_updates = []
            status_updates = []
            latest_ping = _resolve_latest_ping(
                t,
                latest_location_ping=latest_loc_ping.get(t.id),
                latest_status_location=latest_status_loc.get(t.id),
            )
        latest_display = latest_location_display_for_trip(t, bk.dropoff_location if bk else "", latest_ping)
        op_slug = _display_status(t)
        op_label = _operational_status_label(op_slug)
        stored_km = float(t.distance_km) if t.distance_km else None
        row: dict = {
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
            "driver_allowance_php": float(getattr(t, "driver_allowance_php", 0) or 0),
            "helper_allowance_php": float(getattr(t, "helper_allowance_php", 0) or 0),
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
            "latest_location": latest_display,
            "estimated_delivery_time": t.estimated_delivery_time.isoformat()
            if t.estimated_delivery_time
            else None,
            "helper_id": t.helper_id,
            "helper_name": t.helper.full_name if getattr(t, "helper", None) else None,
            "helper_progress_status": getattr(t, "helper_progress_status", None),
            "helper_last_proof_path": getattr(t, "helper_last_proof_path", None),
            "operational_status": op_slug,
            "operational_status_label": op_label,
            "road_distance_km": stored_km,
            "driver_name": t.driver.full_name if getattr(t, "driver", None) else None,
            "booking": (
                {
                    "id": bk.id,
                    "customer_id": bk.customer_id,
                    "customer_name": cust.full_name if cust else None,
                    "customer_company_name": (cust.company_name or None) if cust else None,
                    "paid_amount_verified": paid_map.get(bk.id),
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
                {
                    "id": tk.id,
                    "code": tk.code,
                    "model_name": tk.model_name,
                    "plate_number": tk.code,
                    "capacity_tons": float(tk.capacity_tons or 0),
                    "status": tk.status,
                    "availability_status": getattr(tk, "availability_status", None),
                }
                if tk
                else None
            ),
        }
        if include_timeline:
            row["location_updates"] = _serialize_location_updates(location_updates)
            row["status_timeline"] = _serialize_status_timeline(status_updates)
        out.append(row)
    if user.role == UserRole.HELPER:
        return [redact_trip_payload_for_helper(row) for row in out]
    return out


@router.post("/attendance/check-in")
def check_in(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.HELPER)),
):
    if _open_attendance_row(db, user.id):
        raise HTTPException(
            status_code=400,
            detail="Already checked in. Check out before starting a new shift.",
        )
    record = AttendanceRecord(user_id=user.id, check_in_time=datetime.utcnow(), status="present")
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"checked_in": True, "timestamp": record.check_in_time.isoformat()}


@router.post("/attendance/check-out")
def check_out(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.HELPER)),
):
    row = _open_attendance_row(db, user.id)
    if not row:
        raise HTTPException(status_code=400, detail="No active check-in to close.")
    row.check_out_time = datetime.utcnow()
    db.commit()
    return {"checked_out": True, "timestamp": row.check_out_time.isoformat()}


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


@router.get("/analytics")
def driver_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER)),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    truck_id: int | None = Query(default=None),
    route: str | None = Query(default=None),
    shipment_status: str | None = Query(default=None),
    granularity: str | None = Query(default="monthly"),
):
    """Driver-scoped descriptive and predictive analytics from real trip records."""
    from app.services.admin_analytics import AnalyticsFilters, _load_driver_context, _route_key
    from app.services.driver_role_analytics import build_driver_role_analytics
    from app.services.time_bucket import GRANULARITY_OPTIONS

    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")
    valid_gran = set(GRANULARITY_OPTIONS)
    gran = (granularity or "monthly").strip().lower()
    if gran not in valid_gran:
        raise HTTPException(status_code=400, detail=f"Invalid granularity. Use one of: {', '.join(sorted(valid_gran))}")

    filters = AnalyticsFilters(
        date_from=date_from,
        date_to=date_to,
        driver_id=user.id,
        truck_id=truck_id,
        route=route.strip() if route else None,
        shipment_status=shipment_status.strip().lower() if shipment_status else None,
        granularity=gran,  # type: ignore[arg-type]
    )
    ctx = _load_driver_context(db, user.id)
    driver_trips = [t for t in ctx["trips"] if t.driver_id == user.id]
    trucks = sorted({(t.truck.id, t.truck.code) for t in driver_trips if t.truck}, key=lambda x: x[1])
    routes = sorted(
        {_route_key(t.booking.pickup_location, t.booking.dropoff_location) for t in driver_trips if t.booking}
    )
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "filters_applied": {
            "date_from": filters.date_from.isoformat() if filters.date_from else None,
            "date_to": filters.date_to.isoformat() if filters.date_to else None,
            "driver_id": user.id,
            "truck_id": filters.truck_id,
            "route": filters.route,
            "shipment_status": filters.shipment_status,
            "granularity": filters.granularity,
        },
        "filter_options": {
            "trucks": [{"id": tid, "code": code} for tid, code in trucks],
            "routes": routes,
            "shipment_statuses": ["delivered", "delayed", "cancelled", "in_transit", "pending"],
            "granularity": filters.granularity,
            "granularity_options": list(GRANULARITY_OPTIONS),
        },
        "driver_role_analytics": build_driver_role_analytics(db, ctx, filters, driver=user),
    }
