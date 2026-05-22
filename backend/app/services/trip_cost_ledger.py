"""Dispatcher trip shoulder-cost ledger — additive tracking; does not alter trip cost computation."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.constants.trip_shoulder_costs import SHOULDER_COST_CATEGORY_LABELS, SHOULDER_COST_CATEGORIES
from app.models.entities import Trip, TripShoulderCostEntry, TripStatus, User
from app.services.dispatcher_booking_assignment import filter_trips_for_dispatcher


def shoulder_cost_category_label(category: str | None) -> str:
    if not category:
        return "Other"
    return SHOULDER_COST_CATEGORY_LABELS.get(category, category.replace("_", " ").title())


def empty_category_totals() -> dict[str, float]:
    return {cat: 0.0 for cat in SHOULDER_COST_CATEGORIES}


def add_shoulder_cost_entry(
    db: Session,
    *,
    trip: Trip,
    dispatcher: User,
    category: str,
    amount_php: float,
    notes: str | None,
) -> TripShoulderCostEntry:
    row = TripShoulderCostEntry(
        trip_id=trip.id,
        booking_id=trip.booking_id,
        dispatcher_id=dispatcher.id,
        category=category,
        amount_php=round(float(amount_php), 2),
        notes=notes,
    )
    db.add(row)
    return row


def _serialize_entry(entry: TripShoulderCostEntry) -> dict[str, Any]:
    return {
        "id": entry.id,
        "trip_id": entry.trip_id,
        "booking_id": entry.booking_id,
        "dispatcher_id": entry.dispatcher_id,
        "category": entry.category,
        "category_label": shoulder_cost_category_label(entry.category),
        "amount_php": float(entry.amount_php or 0),
        "notes": entry.notes,
        "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None,
    }


def _system_trip_costs(trip: Trip) -> dict[str, float]:
    """Read-only snapshot of existing computed trip cost fields (unchanged by ledger)."""
    fuel = float(trip.fuel_cost or 0)
    toll = float(trip.toll_cost or 0)
    labor = float(trip.labor_cost or 0)
    maintenance = float(trip.maintenance_cost or 0)
    driver_allowance = float(getattr(trip, "driver_allowance_php", 0) or 0)
    helper_allowance = float(getattr(trip, "helper_allowance_php", 0) or 0)
    crew_allowance = driver_allowance + helper_allowance
    predicted = float(trip.predicted_total_cost or 0)
    return {
        "fuel_cost": round(fuel, 2),
        "toll_cost": round(toll, 2),
        "labor_cost": round(labor, 2),
        "maintenance_cost": round(maintenance, 2),
        "driver_allowance_php": round(driver_allowance, 2),
        "helper_allowance_php": round(helper_allowance, 2),
        "crew_allowance_total_php": round(crew_allowance, 2),
        "predicted_total_cost": round(predicted, 2),
        "system_total_cost": round(fuel + toll + labor + maintenance + crew_allowance, 2),
    }


def build_trip_cost_ledger_payload(
    db: Session,
    *,
    viewer: User | None = None,
    trip_id: int | None = None,
    booking_id: int | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    trip_query = (
        db.query(Trip)
        .options(
            joinedload(Trip.booking),
            joinedload(Trip.driver),
            joinedload(Trip.truck),
        )
        .filter(Trip.status != TripStatus.CANCELLED)
        .order_by(Trip.updated_at.desc())
    )
    if trip_id is not None:
        trip_query = trip_query.filter(Trip.id == trip_id)
    if booking_id is not None:
        trip_query = trip_query.filter(Trip.booking_id == booking_id)
    trips = trip_query.limit(max(limit, 1)).all()
    if viewer is not None:
        trips = filter_trips_for_dispatcher(db, viewer, trips)

    trip_ids = [t.id for t in trips]
    entries_by_trip: dict[int, list[TripShoulderCostEntry]] = defaultdict(list)
    if trip_ids:
        entry_rows = (
            db.query(TripShoulderCostEntry)
            .filter(TripShoulderCostEntry.trip_id.in_(trip_ids))
            .order_by(TripShoulderCostEntry.recorded_at.desc())
            .all()
        )
        for row in entry_rows:
            entries_by_trip[row.trip_id].append(row)

    summary_totals = empty_category_totals()
    ledger_trips: list[dict[str, Any]] = []

    for trip in trips:
        entries = entries_by_trip.get(trip.id, [])
        shoulder_totals = empty_category_totals()
        for entry in entries:
            cat = entry.category if entry.category in shoulder_totals else "other"
            shoulder_totals[cat] = round(shoulder_totals.get(cat, 0) + float(entry.amount_php or 0), 2)
            summary_totals[cat] = round(summary_totals.get(cat, 0) + float(entry.amount_php or 0), 2)

        shoulder_grand = round(sum(shoulder_totals.values()), 2)
        bk = trip.booking
        ledger_trips.append(
            {
                "trip_id": trip.id,
                "booking_id": trip.booking_id,
                "trip_status": trip.status.value if hasattr(trip.status, "value") else str(trip.status),
                "pickup_location": bk.pickup_location if bk else "",
                "dropoff_location": bk.dropoff_location if bk else "",
                "driver_name": trip.driver.full_name if trip.driver else None,
                "truck_code": trip.truck.code if trip.truck else None,
                "system_costs": _system_trip_costs(trip),
                "shoulder_totals": shoulder_totals,
                "shoulder_grand_total": shoulder_grand,
                "entries": [_serialize_entry(e) for e in entries],
            }
        )

    summary_grand = round(sum(summary_totals.values()), 2)
    return {
        "summary": {
            "by_category": summary_totals,
            "shoulder_grand_total": summary_grand,
            "trip_count": len(ledger_trips),
        },
        "trips": ledger_trips,
    }
