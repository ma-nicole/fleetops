"""Shared assigned-leg payload for driver + helper bookings UIs (DB-backed only)."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models.entities import (
    Booking,
    GeneralOperationalReport,
    Payment,
    Trip,
    TripLocationUpdate,
    TripStatusUpdate,
    TruckAssignment,
    User,
    UserRole,
    VehicleIssueReport,
    DriverProfile,
    HelperProfile,
)
from app.services.booking_paid_amount import paid_verified_amount_by_booking_ids
from app.services.delivery_receiving_verification import build_delivery_receiving_status
from app.services.booking_road_distance import booking_pickup_dropoff_distance_km
from app.services.dispatch_operations_center import _display_status
from app.services.latest_location_display import latest_location_display_for_trip

REQUIRED_EN_ROUTE_LOCATION_UPDATES = 3


def _parse_route_waypoints(route_path: str | None) -> list[str]:
    raw = (route_path or "").strip()
    if not raw:
        return []
    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    if "->" in raw:
        return [p.strip() for p in raw.split("->") if p.strip()]
    return [raw]


def _pay_status_value(p: Payment | None) -> str | None:
    if not p:
        return None
    st = p.status
    return st.value if hasattr(st, "value") else str(st)


def _booking_status_value(bk: Booking | None) -> str | None:
    if not bk:
        return None
    st = bk.status
    return st.value if hasattr(st, "value") else str(st)


def _user_name(db: Session, user_id: int | None) -> str | None:
    if not user_id:
        return None
    u = db.query(User).filter(User.id == user_id).first()
    return u.full_name if u else None


def _payment_status_for_row(db: Session, booking_id: int, bk: Booking | None) -> str:
    """Prefer latest payments row status; otherwise booking workflow status."""
    latest = db.query(Payment).filter(Payment.booking_id == booking_id).order_by(Payment.id.desc()).first()
    if latest:
        return _pay_status_value(latest) or "—"
    return _booking_status_value(bk) or "—"


def _latest_payment_amount(db: Session, booking_id: int) -> float | None:
    latest = db.query(Payment).filter(Payment.booking_id == booking_id).order_by(Payment.id.desc()).first()
    return float(latest.amount) if latest else None


def _merge_timeline(
    status_rows: list[TripStatusUpdate],
    location_rows: list[TripLocationUpdate],
    helper_name_fn,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for su in status_rows:
        code = (su.status or "").strip().lower()
        events.append(
            {
                "at": su.created_at.isoformat(),
                "kind": "milestone",
                "code": code,
                "title": code,
                "detail": (su.location_name or "").strip(),
                "remarks": su.remarks,
                "photo_url": su.photo_url,
                "submitted_by": helper_name_fn(su.helper_id),
            }
        )
    for i, lu in enumerate(location_rows, start=1):
        loc = (lu.location_name or "").strip()
        events.append(
            {
                "at": lu.created_at.isoformat(),
                "kind": "location",
                "code": f"location_update_{i}",
                "title": f"Update #{i} — {loc}" if loc else f"Update #{i}",
                "detail": loc,
                "remarks": lu.remarks,
                "photo_url": lu.photo_url,
                "submitted_by": helper_name_fn(lu.helper_id),
                "update_index": i,
            }
        )
    events.sort(key=lambda e: e["at"])
    return events


def _collect_proof_urls(trip: Trip, status_rows: list[TripStatusUpdate], location_rows: list[TripLocationUpdate]) -> list[str]:
    seen: list[str] = []
    for u in status_rows + location_rows:
        url = (u.photo_url or "").strip()
        if url and url not in seen:
            seen.append(url)
    for path in (trip.proof_of_delivery or "", trip.helper_last_proof_path or ""):
        p = path.strip()
        if p and p not in seen:
            seen.append(p)
    return seen


def serialize_crew_booking_row(db: Session, t: Trip, paid_map: dict[int, float]) -> dict[str, Any]:
    bk = t.booking
    cust = bk.customer if bk else None
    tk = t.truck

    location_rows = (
        db.query(TripLocationUpdate)
        .filter(TripLocationUpdate.trip_id == t.id)
        .order_by(TripLocationUpdate.created_at.asc())
        .all()
    )
    status_rows = (
        db.query(TripStatusUpdate)
        .filter(TripStatusUpdate.trip_id == t.id)
        .order_by(TripStatusUpdate.created_at.asc())
        .all()
    )

    helper_ids = {r.helper_id for r in status_rows} | {r.helper_id for r in location_rows}
    helper_names: dict[int, str] = {}
    for hid in helper_ids:
        n = _user_name(db, hid)
        if n:
            helper_names[hid] = n

    def helper_name_fn(hid: int) -> str | None:
        return helper_names.get(hid)

    ping = None
    if location_rows:
        ping = location_rows[-1].location_name
    if not (ping or "").strip():
        for su in reversed(status_rows):
            if (su.location_name or "").strip():
                ping = su.location_name
                break
    if not (ping or "").strip():
        ping = getattr(t, "latest_location", None)

    latest_display = latest_location_display_for_trip(t, bk.dropoff_location if bk else "", ping)
    op_slug = _display_status(t)

    road_km = booking_pickup_dropoff_distance_km(bk) if bk else None

    ta = (
        db.query(TruckAssignment)
        .filter(
            TruckAssignment.booking_id == t.booking_id,
            TruckAssignment.truck_id == t.truck_id,
            TruckAssignment.driver_id == t.driver_id,
        )
        .order_by(TruckAssignment.updated_at.desc())
        .first()
    )
    ta_status = None
    if ta:
        ast = ta.assignment_status
        ta_status = ast.value if hasattr(ast, "value") else str(ast)

    loc_count = len(location_rows)
    payment_status = _payment_status_for_row(db, t.booking_id, bk)
    latest_pay_amount = _latest_payment_amount(db, t.booking_id)

    gen_reports = (
        db.query(GeneralOperationalReport)
        .filter(GeneralOperationalReport.trip_id == t.id)
        .order_by(GeneralOperationalReport.created_at.desc())
        .all()
    )
    veh_reports = (
        db.query(VehicleIssueReport).filter(VehicleIssueReport.trip_id == t.id).order_by(VehicleIssueReport.created_at.desc()).all()
    )

    timeline = _merge_timeline(status_rows, location_rows, helper_name_fn)
    proof_urls = _collect_proof_urls(t, status_rows, location_rows)

    trip_st = t.status
    trip_status_val = trip_st.value if hasattr(trip_st, "value") else str(trip_st)

    dp = db.query(DriverProfile).filter(DriverProfile.user_id == t.driver_id).first() if t.driver_id else None
    hprof = db.query(HelperProfile).filter(HelperProfile.user_id == t.helper_id).first() if t.helper_id else None

    route_waypoints = _parse_route_waypoints(t.route_path)
    pickup_loc = bk.pickup_location if bk else ""
    dropoff_loc = bk.dropoff_location if bk else ""
    if not route_waypoints and pickup_loc and dropoff_loc:
        route_waypoints = [pickup_loc, dropoff_loc]

    scheduling_plot = {
        "assigned_at": t.assigned_at.isoformat() if t.assigned_at else None,
        "pickup_date": bk.scheduled_date.isoformat() if bk else None,
        "pickup_time_slot": bk.scheduled_time_slot if bk else None,
        "pickup_location": pickup_loc,
        "delivery_at": t.estimated_delivery_time.isoformat() if t.estimated_delivery_time else None,
        "delivery_location": dropoff_loc,
        "route_waypoints": route_waypoints,
        "route_distance_km": float(road_km) if road_km is not None else float(t.distance_km or 0),
        "duration_hours": float(t.duration_hours or 0),
        "truck_code": tk.code if tk else None,
        "truck_model": tk.model_name if tk else None,
        "driver_name": t.driver.full_name if getattr(t, "driver", None) else None,
        "helper_name": t.helper.full_name if getattr(t, "helper", None) else None,
        "status": op_slug,
        "trip_status": trip_status_val,
    }

    return {
        "trip_id": t.id,
        "booking_id": t.booking_id,
        "trip_status": trip_status_val,
        "helper_progress_status": (t.helper_progress_status or "for_pickup").strip().lower(),
        "operational_status": op_slug,
        "location_updates_submitted": loc_count,
        "required_location_updates": REQUIRED_EN_ROUTE_LOCATION_UPDATES,
        "location_update_count": loc_count,
        "distance_km": float(t.distance_km or 0),
        "road_distance_km": float(road_km) if road_km is not None else None,
        "assigned_at": t.assigned_at.isoformat() if t.assigned_at else None,
        "estimated_delivery_time": t.estimated_delivery_time.isoformat() if t.estimated_delivery_time else None,
        "duration_hours": float(t.duration_hours or 0),
        "route_path": t.route_path or "",
        "route_waypoints": route_waypoints,
        "scheduling_plot": scheduling_plot,
        "driver_name": t.driver.full_name if getattr(t, "driver", None) else None,
        "helper_name": t.helper.full_name if getattr(t, "helper", None) else None,
        "driver_profile": (
            {
                "rating": float(dp.rating or 0),
                "compliance_status": dp.compliance_status,
            }
            if dp
            else None
        ),
        "helper_profile": (
            {
                "rating": float(hprof.rating or 0),
            }
            if hprof
            else None
        ),
        "latest_location": latest_display,
        "latest_location_name": latest_display,
        "payment_status": payment_status,
        "payment_latest_amount_php": latest_pay_amount,
        "booking_status": _booking_status_value(bk),
        "truck_assignment_status": ta_status,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "pod_notes": t.pod_notes,
        "delivery_receiving": build_delivery_receiving_status(t),
        "timeline_events": timeline,
        "location_updates": [
            {
                "id": u.id,
                "location_name": u.location_name,
                "remarks": u.remarks,
                "photo_url": u.photo_url,
                "created_at": u.created_at.isoformat(),
                "helper_id": u.helper_id,
                "submitted_by": helper_name_fn(u.helper_id),
            }
            for u in location_rows
        ],
        "status_updates": [
            {
                "id": u.id,
                "status": u.status,
                "location_name": u.location_name,
                "remarks": u.remarks,
                "photo_url": u.photo_url,
                "created_at": u.created_at.isoformat(),
                "helper_id": u.helper_id,
                "submitted_by": helper_name_fn(u.helper_id),
            }
            for u in status_rows
        ],
        "proof_photo_urls": proof_urls,
        "general_operational_reports": [
            {
                "id": r.id,
                "category": r.category,
                "status": r.status,
                "report_date": r.report_date.isoformat() if isinstance(r.report_date, date) else str(r.report_date),
                "description": r.description,
                "notes": r.notes,
                "attachment_url": r.attachment_url,
                "created_at": r.created_at.isoformat(),
            }
            for r in gen_reports
        ],
        "vehicle_issue_reports": [
            {
                "id": r.id,
                "issue_type": r.issue_type,
                "priority": r.priority,
                "description": r.description,
                "attachment_url": r.attachment_url,
                "status": r.status.value if hasattr(r.status, "value") else str(r.status),
                "created_at": r.created_at.isoformat(),
            }
            for r in veh_reports
        ],
        "recent_locations": [
            {
                "location_name": u.location_name,
                "remarks": u.remarks,
                "photo_url": u.photo_url,
                "created_at": u.created_at.isoformat(),
            }
            for u in reversed(location_rows[-5:])
        ][::-1],
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
                "status": _booking_status_value(bk),
            }
            if bk
            else None
        ),
        "truck": (
            {
                "id": tk.id,
                "code": tk.code,
                "model_name": tk.model_name,
                "capacity_tons": float(tk.capacity_tons or 0),
                "status": tk.status,
                "availability_status": getattr(tk, "availability_status", None),
            }
            if tk
            else None
        ),
    }


def _redact_booking_for_helper(bk: dict[str, Any] | None) -> dict[str, Any] | None:
    if not bk:
        return None
    return {
        "id": bk.get("id"),
        "pickup_location": bk.get("pickup_location"),
        "dropoff_location": bk.get("dropoff_location"),
        "scheduled_date": bk.get("scheduled_date"),
        "scheduled_time_slot": bk.get("scheduled_time_slot"),
        "cargo_weight_tons": bk.get("cargo_weight_tons"),
        "cargo_description": bk.get("cargo_description"),
    }


def redact_crew_booking_row_for_helper(row: dict[str, Any]) -> dict[str, Any]:
    """Strip admin/dispatcher-only fields from crew booking payloads for helper UI."""
    return {
        "trip_id": row["trip_id"],
        "booking_id": row["booking_id"],
        "operational_status": row.get("operational_status"),
        "helper_progress_status": row.get("helper_progress_status"),
        "location_updates_submitted": row.get("location_updates_submitted"),
        "required_location_updates": row.get("required_location_updates"),
        "driver_name": row.get("driver_name"),
        "latest_location": row.get("latest_location"),
        "completed_at": row.get("completed_at"),
        "timeline_events": row.get("timeline_events") or [],
        "location_updates": row.get("location_updates") or [],
        "status_updates": row.get("status_updates") or [],
        "proof_photo_urls": row.get("proof_photo_urls") or [],
        "booking": _redact_booking_for_helper(row.get("booking")),
    }


def redact_trip_payload_for_helper(payload: dict[str, Any]) -> dict[str, Any]:
    """Strip admin/dispatcher-only fields from GET /driver/trips payloads for helpers."""
    bk = payload.get("booking")
    redacted_bk = None
    if isinstance(bk, dict):
        redacted_bk = {
            "id": bk.get("id"),
            "pickup_location": bk.get("pickup_location"),
            "dropoff_location": bk.get("dropoff_location"),
            "scheduled_date": bk.get("scheduled_date"),
            "scheduled_time_slot": bk.get("scheduled_time_slot"),
            "cargo_weight_tons": bk.get("cargo_weight_tons"),
            "cargo_description": bk.get("cargo_description"),
        }
    return {
        "id": payload["id"],
        "booking_id": payload["booking_id"],
        "operational_status": payload.get("operational_status"),
        "operational_status_label": payload.get("operational_status_label"),
        "helper_progress_status": payload.get("helper_progress_status"),
        "latest_location": payload.get("latest_location"),
        "completed_at": payload.get("completed_at"),
        "driver_name": payload.get("driver_name"),
        "location_updates": payload.get("location_updates") or [],
        "status_timeline": payload.get("status_timeline") or [],
        "proof_of_delivery": payload.get("proof_of_delivery"),
        "helper_last_proof_path": payload.get("helper_last_proof_path"),
        "booking": redacted_bk,
    }


def list_crew_assigned_bookings(db: Session, user: User) -> list[dict[str, Any]]:
    q = db.query(Trip).options(
        joinedload(Trip.booking).joinedload(Booking.customer),
        joinedload(Trip.truck),
        joinedload(Trip.driver),
        joinedload(Trip.helper),
    )
    if user.role == UserRole.DRIVER:
        q = q.filter(Trip.driver_id == user.id)
    elif user.role == UserRole.HELPER:
        q = q.filter(Trip.helper_id == user.id)
    else:
        return []
    trips = q.order_by(Trip.id.desc()).limit(100).all()
    b_ids = [t.booking_id for t in trips]
    paid_map = paid_verified_amount_by_booking_ids(db, b_ids)
    rows = [serialize_crew_booking_row(db, t, paid_map) for t in trips]
    if user.role == UserRole.HELPER:
        return [redact_crew_booking_row_for_helper(r) for r in rows]
    return rows
