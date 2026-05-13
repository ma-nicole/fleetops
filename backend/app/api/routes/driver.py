from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import (
    AttendanceRecord,
    Booking,
    DriverProfile,
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
from app.services.booking_road_distance import booking_pickup_dropoff_distance_km
from app.services.dispatch_operations_center import _display_status
from app.services.driver_pay_summary import build_driver_pay_summary
from app.services.crew_assigned_bookings import list_crew_assigned_bookings
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
    paid_map = paid_verified_amount_by_booking_ids(db, [t.booking_id for t in trips])
    out = []
    for t in trips:
        bk = t.booking
        tk = t.truck
        cust = bk.customer if bk else None
        location_updates = (
            db.query(TripLocationUpdate)
            .filter(TripLocationUpdate.trip_id == t.id)
            .order_by(TripLocationUpdate.created_at.asc())
            .limit(50)
            .all()
        )
        status_updates = (
            db.query(TripStatusUpdate)
            .filter(TripStatusUpdate.trip_id == t.id)
            .order_by(TripStatusUpdate.created_at.asc())
            .limit(100)
            .all()
        )
        latest_ping = None
        if location_updates:
            latest_ping = location_updates[-1].location_name
        if not (latest_ping or "").strip():
            for su in reversed(status_updates):
                if (su.location_name or "").strip():
                    latest_ping = su.location_name
                    break
        if not (latest_ping or "").strip():
            latest_ping = getattr(t, "latest_location", None)
        latest_display = latest_location_display_for_trip(t, bk.dropoff_location if bk else "", latest_ping)
        op_slug = _display_status(t)
        op_label = _operational_status_label(op_slug)
        road_km = booking_pickup_dropoff_distance_km(bk) if bk else None
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
                "road_distance_km": float(road_km) if road_km is not None else None,
                "driver_name": t.driver.full_name if getattr(t, "driver", None) else None,
                "location_updates": [
                    {
                        "location_name": lu.location_name,
                        "remarks": lu.remarks,
                        "photo_url": lu.photo_url,
                        "created_at": lu.created_at.isoformat(),
                    }
                    for lu in location_updates
                ],
                "status_timeline": [
                    {
                        "status": su.status,
                        "location_name": su.location_name,
                        "remarks": su.remarks,
                        "photo_url": su.photo_url,
                        "created_at": su.created_at.isoformat(),
                    }
                    for su in status_updates
                ],
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
        )
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
