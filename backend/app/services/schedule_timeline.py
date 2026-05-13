"""Dispatcher schedule timeline — real bookings/trips/maintenance/holds, overlap detection."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models.entities import (
    Booking,
    BookingStatus,
    MaintenanceRecord,
    Payment,
    Trip,
    TripLocationUpdate,
    TripStatus,
    TripStatusUpdate,
    Truck,
    TruckSlotHold,
    TruckSlotHoldStatus,
    User,
    UserRole,
)
from app.services.booking_schedule import (
    booking_interval,
    interval_for_pickup_window,
    intervals_overlap,
    trip_interval,
)
from app.services.latest_location_display import latest_location_display_for_trip


def _parse_start(s: str | None) -> date:
    if not s:
        return date.today()
    try:
        return date.fromisoformat(s.strip()[:10])
    except ValueError:
        return date.today()


def _window(start_d: date, mode: str) -> tuple[datetime, datetime]:
    mode = (mode or "week").lower()
    if mode == "day":
        t0 = datetime.combine(start_d, datetime.min.time())
        return t0, t0 + timedelta(days=1)
    monday = start_d - timedelta(days=start_d.weekday())
    t0 = datetime.combine(monday, datetime.min.time())
    return t0, t0 + timedelta(days=7)


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def timeline_state(booking: Booking, trip: Trip | None) -> str:
    """UI color bucket for bars."""
    if trip is not None:
        if trip.status == TripStatus.CANCELLED:
            return "cancelled"
        if trip.status == TripStatus.COMPLETED:
            return "completed"
        hp = _norm(trip.helper_progress_status)
        if hp == "dropped_off":
            return "dropped_off"
        if hp == "en_route" or trip.status == TripStatus.IN_DELIVERY:
            return "en_route"
        if hp == "picked_up" or trip.status == TripStatus.LOADING:
            return "picked_up"
        if trip.status == TripStatus.ASSIGNED:
            return "assigned"
        if trip.status in (TripStatus.ACCEPTED, TripStatus.DEPARTED):
            return "for_pickup"
    bst = booking.status
    if bst in (BookingStatus.PAYMENT_VERIFIED, BookingStatus.READY_FOR_ASSIGNMENT):
        return "payment_verified"
    if bst == BookingStatus.CANCELLED:
        return "cancelled"
    return "payment_verified"


def build_timeline(
    db: Session,
    *,
    start: str | None,
    mode: str | None,
    resource: str | None,
    status_filter: str | None,
    q: str | None,
) -> dict[str, Any]:
    start_d = _parse_start(start)
    mode = (mode or "week").lower()
    if mode not in ("day", "week"):
        mode = "week"
    resource = (resource or "truck").lower()
    if resource not in ("truck", "driver"):
        resource = "truck"

    win_start, win_end = _window(start_d, mode)
    total_hours = (win_end - win_start).total_seconds() / 3600.0

    d_lo = (win_start - timedelta(days=1)).date()
    d_hi = (win_end + timedelta(days=1)).date()

    trips: list[Trip] = (
        db.query(Trip)
        .options(
            joinedload(Trip.booking).joinedload(Booking.customer),
            joinedload(Trip.truck),
            joinedload(Trip.driver),
            joinedload(Trip.helper),
        )
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Booking.scheduled_date >= d_lo, Booking.scheduled_date <= d_hi)
        .all()
    )

    events: list[dict[str, Any]] = []

    for trip in trips:
        bk = trip.booking
        if bk is None:
            continue
        try:
            t0, t1 = trip_interval(db, trip)
        except (TypeError, ValueError):
            try:
                t0, t1 = booking_interval(bk)
            except (TypeError, ValueError):
                continue
        if not intervals_overlap(win_start, win_end, t0, t1):
            continue
        clip_start = max(t0, win_start)
        clip_end = min(t1, win_end)
        state = timeline_state(bk, trip)
        cust = bk.customer.full_name if bk.customer else "—"
        pickup = (bk.pickup_location or "").strip() or "—"
        dropoff = (bk.dropoff_location or "").strip() or "—"
        truck_code = trip.truck.code if trip.truck else "—"
        driver_name = trip.driver.full_name if trip.driver else "—"
        helper_name = trip.helper.full_name if trip.helper else "—"
        title = f"Bk #{bk.id}"
        subtitle = f"{pickup[:36]}{'…' if len(pickup) > 36 else ''} → {dropoff[:36]}{'…' if len(dropoff) > 36 else ''}"

        ev = {
            "id": f"trip-{trip.id}",
            "type": "trip",
            "trip_id": trip.id,
            "booking_id": bk.id,
            "resource_kind": resource,
            "resource_id": trip.truck_id if resource == "truck" else trip.driver_id,
            "start": clip_start.isoformat(),
            "end": clip_end.isoformat(),
            "state": state,
            "title": title,
            "subtitle": subtitle,
            "pickup": pickup,
            "dropoff": dropoff,
            "truck_code": truck_code,
            "driver_name": driver_name,
            "helper_name": helper_name,
            "trip_status": trip.status.value if hasattr(trip.status, "value") else str(trip.status),
            "helper_progress": trip.helper_progress_status,
            "customer_name": cust,
            "cargo_tons": float(bk.cargo_weight_tons or 0),
            "conflict": False,
            "conflict_reasons": [],
        }
        events.append(ev)

    trucks = db.query(Truck).order_by(Truck.code).all()

    if resource == "truck":
        maint_rows = db.query(MaintenanceRecord).filter(MaintenanceRecord.resolved_at.is_(None)).all()
        truck_maint_full: set[int] = set()

        for trk in trucks:
            st = _norm(trk.status)
            if st == "maintenance":
                truck_maint_full.add(trk.id)
                events.append(
                    {
                        "id": f"maint-truck-{trk.id}",
                        "type": "maintenance",
                        "trip_id": None,
                        "booking_id": None,
                        "resource_kind": "truck",
                        "resource_id": trk.id,
                        "start": win_start.isoformat(),
                        "end": win_end.isoformat(),
                        "state": "maintenance",
                        "title": "Maintenance",
                        "subtitle": "Truck status: maintenance",
                        "pickup": "",
                        "dropoff": "",
                        "truck_code": trk.code,
                        "driver_name": "—",
                        "helper_name": "—",
                        "trip_status": "maintenance",
                        "helper_progress": None,
                        "customer_name": "—",
                        "cargo_tons": 0.0,
                        "conflict": False,
                        "conflict_reasons": [],
                    }
                )

        for m in maint_rows:
            if m.truck_id in truck_maint_full:
                continue
            trk = next((t for t in trucks if t.id == m.truck_id), None)
            if not trk:
                continue
            if m.scheduled_date:
                day0 = datetime.combine(m.scheduled_date, datetime.min.time())
                day1 = day0 + timedelta(days=1)
                if not intervals_overlap(win_start, win_end, day0, day1):
                    continue
                clip_start = max(day0, win_start)
                clip_end = min(day1, win_end)
            else:
                clip_start, clip_end = win_start, win_end
            stv = m.status.value if hasattr(m.status, "value") else str(m.status)
            issue = m.reported_issue or "Maintenance"
            sub = issue if len(issue) <= 52 else issue[:50] + "…"
            events.append(
                {
                    "id": f"maint-rec-{m.id}",
                    "type": "maintenance",
                    "trip_id": None,
                    "booking_id": None,
                    "resource_kind": "truck",
                    "resource_id": m.truck_id,
                    "start": clip_start.isoformat(),
                    "end": clip_end.isoformat(),
                    "state": "maintenance",
                    "title": "Maintenance",
                    "subtitle": sub,
                    "pickup": "",
                    "dropoff": "",
                    "truck_code": trk.code,
                    "driver_name": "—",
                    "helper_name": "—",
                    "trip_status": stv,
                    "helper_progress": None,
                    "customer_name": "—",
                    "cargo_tons": 0.0,
                    "conflict": False,
                    "conflict_reasons": [],
                }
            )

    # Slot holds (capacity) — synthetic lane id 0 for truck view only.
    # Only pre-assignment holds: ASSIGNED holds stay in DB for audit but must not draw here — trips
    # already occupy truck rows; drawing ASSIGNED holds duplicated the same booking on the unassigned lane.
    if resource == "truck":
        holds = (
            db.query(TruckSlotHold, Booking)
            .join(Booking, Booking.id == TruckSlotHold.booking_id)
            .filter(
                TruckSlotHold.schedule_date >= win_start.date(),
                TruckSlotHold.schedule_date < win_end.date(),
                TruckSlotHold.hold_status.in_(
                    [TruckSlotHoldStatus.ON_HOLD, TruckSlotHoldStatus.READY_FOR_ASSIGNMENT]
                ),
            )
            .all()
        )
        for hold, bk in holds:
            try:
                t0, t1 = interval_for_pickup_window(
                    hold.schedule_date,
                    hold.time_slot,
                    bk.pickup_location,
                    bk.dropoff_location,
                )
            except (TypeError, ValueError):
                continue
            if not intervals_overlap(win_start, win_end, t0, t1):
                continue
            clip_start = max(t0, win_start)
            clip_end = min(t1, win_end)
            hs = hold.hold_status
            hs_val = hs.value if hasattr(hs, "value") else str(hs)
            slot_state = (
                "payment_verification"
                if hs == TruckSlotHoldStatus.ON_HOLD
                else "payment_verified"
            )
            events.append(
                {
                    "id": f"hold-{hold.id}",
                    "type": "slot_hold",
                    "trip_id": None,
                    "booking_id": bk.id,
                    "resource_kind": "truck",
                    "resource_id": 0,
                    "start": clip_start.isoformat(),
                    "end": clip_end.isoformat(),
                    "state": slot_state,
                    "title": f"Slot hold · Bk #{bk.id}",
                    "subtitle": f"{hold.required_truck_count} trucks · {hs_val}",
                    "pickup": (bk.pickup_location or "").strip(),
                    "dropoff": (bk.dropoff_location or "").strip(),
                    "truck_code": "—",
                    "driver_name": "—",
                    "helper_name": "—",
                    "trip_status": "hold",
                    "helper_progress": None,
                    "customer_name": bk.customer.full_name if bk.customer else "—",
                    "cargo_tons": float(bk.cargo_weight_tons or 0),
                    "conflict": False,
                    "conflict_reasons": [],
                }
            )

    # --- conflict detection (trips + maintenance on same truck) ---
    by_truck: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for ev in events:
        if ev.get("resource_kind") != "truck":
            continue
        tid = ev.get("resource_id")
        if tid is None:
            continue
        by_truck[int(tid)].append(ev)

    for tid, evs in by_truck.items():
        if tid == 0:
            continue
        evs.sort(key=lambda e: e["start"])
        for i in range(len(evs)):
            for j in range(i + 1, len(evs)):
                a, b = evs[i], evs[j]
                if a["type"] == "slot_hold" and b["type"] == "slot_hold":
                    continue
                t0a, t1a = datetime.fromisoformat(a["start"]), datetime.fromisoformat(a["end"])
                t0b, t1b = datetime.fromisoformat(b["start"]), datetime.fromisoformat(b["end"])
                if intervals_overlap(t0a, t1a, t0b, t1b):
                    for ev in (a, b):
                        if ev["type"] == "trip" or ev["type"] == "maintenance":
                            ev["conflict"] = True
                            ev["conflict_reasons"].append("overlap")

    by_driver: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for ev in events:
        if ev.get("type") != "trip" or ev.get("resource_kind") != "driver":
            continue
        did = ev.get("resource_id")
        if did:
            by_driver[int(did)].append(ev)
    for did, evs in by_driver.items():
        evs.sort(key=lambda e: e["start"])
        for i in range(len(evs)):
            for j in range(i + 1, len(evs)):
                a, b = evs[i], evs[j]
                t0a, t1a = datetime.fromisoformat(a["start"]), datetime.fromisoformat(a["end"])
                t0b, t1b = datetime.fromisoformat(b["start"]), datetime.fromisoformat(b["end"])
                if intervals_overlap(t0a, t1a, t0b, t1b):
                    a["conflict"] = b["conflict"] = True
                    a.setdefault("conflict_reasons", []).append("driver_overlap")
                    b.setdefault("conflict_reasons", []).append("driver_overlap")

    # Trip vs maintenance same truck
    for tid, evs in by_truck.items():
        if tid == 0:
            continue
        trips_e = [e for e in evs if e["type"] == "trip"]
        maint_e = [e for e in evs if e["type"] == "maintenance"]
        for te in trips_e:
            for me in maint_e:
                t0a, t1a = datetime.fromisoformat(te["start"]), datetime.fromisoformat(te["end"])
                t0b, t1b = datetime.fromisoformat(me["start"]), datetime.fromisoformat(me["end"])
                if intervals_overlap(t0a, t1a, t0b, t1b):
                    te["conflict"] = True
                    te.setdefault("conflict_reasons", []).append("maintenance")

    # --- resources list ---
    resources: list[dict[str, Any]] = []
    if resource == "truck":
        resources.append({"id": 0, "label": "Slot / capacity holds", "sub": "Unassigned lane", "availability": "lane"})
        for trk in trucks:
            st = _norm(trk.status)
            resources.append(
                {
                    "id": trk.id,
                    "label": trk.code,
                    "sub": f"{float(trk.capacity_tons or 0):.0f} t · {trk.status or '—'}",
                    "availability": "maintenance" if st == "maintenance" else "available",
                }
            )
    else:
        drivers = db.query(User).filter(User.role == UserRole.DRIVER).order_by(User.full_name).all()
        for u in drivers:
            resources.append(
                {
                    "id": u.id,
                    "label": u.full_name,
                    "sub": u.availability_status or "—",
                    "availability": "available",
                }
            )

    # Filters
    sf = _norm(status_filter)
    if sf and sf != "all":
        events = [e for e in events if e.get("state") == sf]
    qn = _norm(q)
    if qn:
        events = [
            e
            for e in events
            if qn in _norm(e.get("title"))
            or qn in _norm(e.get("subtitle"))
            or qn in _norm(e.get("truck_code"))
            or qn in _norm(e.get("driver_name"))
            or (str(e.get("booking_id") or "") and qn in str(e.get("booking_id")))
            or (str(e.get("trip_id") or "") and qn in str(e.get("trip_id")))
        ]
        keep_ids = {e["resource_id"] for e in events if e.get("resource_id") is not None}
        resources = [r for r in resources if r["id"] in keep_ids or r.get("availability") == "lane"]

    conflicts_out: list[dict[str, Any]] = []
    for ev in events:
        if ev.get("conflict"):
            conflicts_out.append(
                {
                    "event_id": ev["id"],
                    "trip_id": ev.get("trip_id"),
                    "booking_id": ev.get("booking_id"),
                    "reasons": list(set(ev.get("conflict_reasons") or [])),
                    "label": ev.get("title"),
                }
            )

    return {
        "window_start": win_start.isoformat(),
        "window_end": win_end.isoformat(),
        "mode": mode,
        "resource": resource,
        "total_hours": round(total_hours, 4),
        "start_date": start_d.isoformat(),
        "resources": resources,
        "events": events,
        "conflicts": conflicts_out,
    }


def trip_timeline_detail(db: Session, trip_id: int) -> dict[str, Any] | None:
    trip = (
        db.query(Trip)
        .options(
            joinedload(Trip.booking).joinedload(Booking.customer),
            joinedload(Trip.truck),
            joinedload(Trip.driver),
            joinedload(Trip.helper),
        )
        .filter(Trip.id == trip_id)
        .first()
    )
    if not trip or not trip.booking:
        return None
    bk = trip.booking
    t0, t1 = trip_interval(db, trip)
    latest_loc = (
        db.query(TripLocationUpdate)
        .filter(TripLocationUpdate.trip_id == trip.id)
        .order_by(TripLocationUpdate.created_at.desc())
        .first()
    )
    updates = (
        db.query(TripStatusUpdate)
        .filter(TripStatusUpdate.trip_id == trip.id)
        .order_by(TripStatusUpdate.created_at.desc())
        .limit(40)
        .all()
    )
    pay = (
        db.query(Payment).filter(Payment.booking_id == bk.id).order_by(Payment.id.desc()).first()
    )
    raw_ping = (latest_loc.location_name if latest_loc else None) or getattr(trip, "latest_location", None)
    latest_text = latest_location_display_for_trip(trip, bk.dropoff_location, raw_ping)
    return {
        "trip_id": trip.id,
        "booking_id": bk.id,
        "customer": bk.customer.full_name if bk.customer else "—",
        "customer_email": bk.customer.email if bk.customer else None,
        "cargo_tons": float(bk.cargo_weight_tons or 0),
        "pickup": bk.pickup_location,
        "dropoff": bk.dropoff_location,
        "scheduled_date": bk.scheduled_date.isoformat(),
        "scheduled_time_slot": bk.scheduled_time_slot,
        "booking_status": bk.status.value if hasattr(bk.status, "value") else str(bk.status),
        "trip_status": trip.status.value if hasattr(trip.status, "value") else str(trip.status),
        "helper_progress": trip.helper_progress_status,
        "truck": {"id": trip.truck_id, "code": trip.truck.code if trip.truck else None},
        "driver": {"id": trip.driver_id, "name": trip.driver.full_name if trip.driver else None},
        "helper": {"id": trip.helper_id, "name": trip.helper.full_name if trip.helper else None},
        "eta": trip.estimated_delivery_time.isoformat() if trip.estimated_delivery_time else None,
        "payment": {
            "status": pay.status.value if pay and hasattr(pay.status, "value") else (str(pay.status) if pay else None),
            "amount": float(pay.amount) if pay else None,
        },
        "window_start": t0.isoformat(),
        "window_end": t1.isoformat(),
        "latest_location": {
            "text": latest_text,
            "at": latest_loc.created_at.isoformat() if latest_loc else None,
        },
        "status_history": [
            {
                "status": u.status,
                "location": u.location_name,
                "at": u.created_at.isoformat(),
            }
            for u in reversed(updates)
        ],
    }
