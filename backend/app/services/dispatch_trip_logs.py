"""Aggregated trip operational history for dispatcher Trip Logs console."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.constants.general_operational_report import GENERAL_OPS_CATEGORY_LABELS
from app.constants.operational_log import REPORT_TYPE_LABELS
from app.models.entities import (
    Booking,
    GeneralOperationalReport,
    OperationalLog,
    Trip,
    TripIssue,
    TripLocationUpdate,
    TripStatus,
    TripStatusUpdate,
    Truck,
    User,
    VehicleIssueReport,
)
from app.services.general_operational_reports import list_general_operational_reports_for_trips


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat()


def _status_str(st: TripStatus | str) -> str:
    if hasattr(st, "value"):
        return str(st.value)
    return str(st)


def build_trip_logs_payload(db: Session, *, limit: int = 100) -> dict[str, Any]:
    trips = (
        db.query(Trip)
        .options(
            joinedload(Trip.booking),
            joinedload(Trip.driver),
            joinedload(Trip.helper),
            joinedload(Trip.truck),
        )
        .order_by(Trip.updated_at.desc())
        .limit(limit)
        .all()
    )
    if not trips:
        return {"trips": []}

    trip_ids = [t.id for t in trips]
    helper_ids: set[int] = set()
    for t in trips:
        if t.helper_id:
            helper_ids.add(t.helper_id)

    st_rows = (
        db.query(TripStatusUpdate)
        .filter(TripStatusUpdate.trip_id.in_(trip_ids))
        .order_by(TripStatusUpdate.created_at.asc())
        .all()
    )
    loc_rows = (
        db.query(TripLocationUpdate)
        .filter(TripLocationUpdate.trip_id.in_(trip_ids))
        .order_by(TripLocationUpdate.created_at.asc())
        .all()
    )
    issue_rows = (
        db.query(TripIssue).filter(TripIssue.trip_id.in_(trip_ids)).order_by(TripIssue.created_at.asc()).all()
    )
    vehicle_issue_rows = (
        db.query(VehicleIssueReport)
        .filter(VehicleIssueReport.trip_id.in_(trip_ids))
        .order_by(VehicleIssueReport.created_at.asc())
        .all()
    )
    general_ops_rows = list_general_operational_reports_for_trips(db, trip_ids)
    op_rows = (
        db.query(OperationalLog)
        .filter(OperationalLog.trip_id.in_(trip_ids))
        .order_by(OperationalLog.created_at.asc())
        .all()
    )

    for r in st_rows:
        helper_ids.add(r.helper_id)
    for r in loc_rows:
        helper_ids.add(r.helper_id)

    reporter_ids = {i.reported_by_id for i in issue_rows}
    dispatcher_ids = {o.dispatcher_id for o in op_rows}
    driver_ids_vi = {v.driver_id for v in vehicle_issue_rows}
    driver_ids_go = {g.driver_id for g in general_ops_rows}
    user_ids = helper_ids | reporter_ids | dispatcher_ids | driver_ids_vi | driver_ids_go
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_name: dict[int, str] = {u.id: (u.full_name or f"User #{u.id}") for u in users}

    by_trip_status: dict[int, list[TripStatusUpdate]] = defaultdict(list)
    for r in st_rows:
        by_trip_status[r.trip_id].append(r)
    by_trip_loc: dict[int, list[TripLocationUpdate]] = defaultdict(list)
    for r in loc_rows:
        by_trip_loc[r.trip_id].append(r)
    by_trip_issue: dict[int, list[TripIssue]] = defaultdict(list)
    for r in issue_rows:
        by_trip_issue[r.trip_id].append(r)
    by_trip_vehicle_issue: dict[int, list[VehicleIssueReport]] = defaultdict(list)
    for r in vehicle_issue_rows:
        by_trip_vehicle_issue[r.trip_id].append(r)
    by_trip_general_ops: dict[int, list[GeneralOperationalReport]] = defaultdict(list)
    for r in general_ops_rows:
        by_trip_general_ops[r.trip_id].append(r)
    by_trip_oplog: dict[int, list[OperationalLog]] = defaultdict(list)
    for r in op_rows:
        by_trip_oplog[r.trip_id].append(r)

    out: list[dict[str, Any]] = []
    for t in trips:
        bk = t.booking
        pickup = bk.pickup_location if bk else ""
        dropoff = bk.dropoff_location if bk else ""
        truck = t.truck
        events: list[dict[str, Any]] = []

        milestone_fields: list[tuple[str | None, str, str]] = [
            (_iso(t.assigned_at), "milestone", "Leg assigned"),
            (_iso(t.accepted_at), "milestone", "Driver accepted"),
            (_iso(t.departure_time), "milestone", "Departed (en route to pickup)"),
            (_iso(t.arrival_pickup_time), "milestone", "Arrived at pickup"),
            (_iso(t.loading_start_time), "milestone", "Loading started"),
            (_iso(t.loading_end_time), "milestone", "Loading finished"),
            (_iso(t.departure_delivery_time), "milestone", "Departed for delivery"),
            (_iso(t.arrival_delivery_time), "milestone", "Arrived at drop-off"),
            (_iso(t.completed_at), "milestone", "Trip completed"),
        ]
        for at_s, kind, label in milestone_fields:
            if not at_s:
                continue
            events.append(
                {
                    "at": at_s,
                    "kind": kind,
                    "label": label,
                    "detail": None,
                    "photos": [],
                    "actor": None,
                }
            )

        for su in by_trip_status.get(t.id, []):
            photos = [su.photo_url] if su.photo_url else []
            detail_parts = [f"Helper status: {su.status}"]
            if (su.location_name or "").strip():
                detail_parts.append(f"Location: {su.location_name.strip()}")
            if (su.remarks or "").strip():
                detail_parts.append(su.remarks.strip())
            events.append(
                {
                    "at": _iso(su.created_at) or "",
                    "kind": "helper_status",
                    "label": "Helper progress update",
                    "detail": " · ".join(detail_parts),
                    "photos": photos,
                    "actor": user_name.get(su.helper_id),
                }
            )

        for lu in by_trip_loc.get(t.id, []):
            photos = [lu.photo_url] if lu.photo_url else []
            loc = (lu.location_name or "").strip()
            remarks = (lu.remarks or "").strip()
            detail = " · ".join(x for x in [loc or None, remarks or None] if x)
            events.append(
                {
                    "at": _iso(lu.created_at) or "",
                    "kind": "location_ping",
                    "label": "Location update",
                    "detail": detail or None,
                    "photos": photos,
                    "actor": user_name.get(lu.helper_id),
                }
            )

        for iss in by_trip_issue.get(t.id, []):
            events.append(
                {
                    "at": _iso(iss.created_at) or "",
                    "kind": "issue",
                    "label": f"Issue: {iss.issue_type}",
                    "detail": iss.description,
                    "photos": [],
                    "actor": user_name.get(iss.reported_by_id),
                    "severity": iss.severity,
                    "resolved": iss.resolved,
                }
            )

        for vir in by_trip_vehicle_issue.get(t.id, []):
            photos: list[str] = []
            if (vir.attachment_url or "").strip():
                photos.append(vir.attachment_url.strip())
            st = vir.status.value if hasattr(vir.status, "value") else str(vir.status)
            detail = f"Priority: {vir.priority} — Status: {st} — {vir.description}"
            events.append(
                {
                    "at": _iso(vir.created_at) or "",
                    "kind": "vehicle_issue",
                    "label": f"Vehicle issue: {vir.issue_type.replace('_', ' ')}",
                    "detail": detail,
                    "photos": photos,
                    "actor": user_name.get(vir.driver_id),
                    "priority": vir.priority,
                    "status": st,
                }
            )

        for gor in by_trip_general_ops.get(t.id, []):
            photos_go: list[str] = []
            if (gor.attachment_url or "").strip():
                photos_go.append(gor.attachment_url.strip())
            cat_label = GENERAL_OPS_CATEGORY_LABELS.get(gor.category, gor.category.replace("_", " "))
            detail_go = f"Category: {cat_label}"
            if gor.status:
                detail_go += f" — Leg status: {gor.status.replace('_', ' ')}"
            detail_go += f" — {gor.description}"
            if (gor.notes or "").strip():
                detail_go += f" — Notes: {gor.notes.strip()}"
            events.append(
                {
                    "at": _iso(gor.created_at) or "",
                    "kind": "general_operational_report",
                    "label": "Driver general form",
                    "detail": detail_go,
                    "photos": photos_go,
                    "actor": user_name.get(gor.driver_id),
                    "category": gor.category,
                    "report_date": gor.report_date.isoformat() if gor.report_date else None,
                }
            )

        for opl in by_trip_oplog.get(t.id, []):
            rlabel = REPORT_TYPE_LABELS.get(opl.report_type, opl.report_type.replace("_", " ").title())
            photo_urls: list[str] = []
            if (opl.attachment_url or "").strip():
                photo_urls.append(opl.attachment_url.strip())
            detail = f"Priority: {opl.priority_level} — {opl.operational_details}"
            events.append(
                {
                    "at": _iso(opl.created_at) or "",
                    "kind": "operational_log",
                    "label": f"Operational log: {rlabel}",
                    "detail": detail,
                    "photos": photo_urls,
                    "actor": user_name.get(opl.dispatcher_id),
                    "priority": opl.priority_level,
                    "report_type": opl.report_type,
                }
            )

        proof_bits: list[str] = []
        if (t.proof_of_delivery or "").strip():
            proof_bits.append(f"POD: {t.proof_of_delivery.strip()}")
        if (t.helper_last_proof_path or "").strip():
            proof_bits.append(f"Proof photo: {t.helper_last_proof_path.strip()}")
        if (t.pod_notes or "").strip():
            proof_bits.append(t.pod_notes.strip())
        if proof_bits:
            proof_at = _iso(t.completed_at) or _iso(t.arrival_delivery_time) or _iso(t.updated_at) or ""
            photo_urls: list[str] = []
            for raw in (t.proof_of_delivery, t.helper_last_proof_path):
                s = (raw or "").strip()
                if s:
                    photo_urls.append(s)
            events.append(
                {
                    "at": proof_at,
                    "kind": "delivery_proof",
                    "label": "Delivery proof & notes",
                    "detail": " · ".join(proof_bits),
                    "photos": photo_urls,
                    "actor": user_name.get(t.helper_id) if t.helper_id else None,
                }
            )

        # Newest first (operational feed)
        events.sort(key=lambda e: e.get("at") or "", reverse=True)
        events = events[:160]

        out.append(
            {
                "trip_id": t.id,
                "booking_id": t.booking_id,
                "pickup": pickup,
                "dropoff": dropoff,
                "truck_code": truck.code if truck else None,
                "driver_name": t.driver.full_name if t.driver else None,
                "helper_name": t.helper.full_name if t.helper else None,
                "trip_status": _status_str(t.status),
                "helper_progress_status": t.helper_progress_status,
                "latest_location": t.latest_location,
                "completed_at": _iso(t.completed_at),
                "timeline": events,
            }
        )

    return {"trips": out}
