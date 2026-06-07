"""Trip toll finalization and historical record generation."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.orm import Session

from app.models.entities import AdditionalTollEntry, Booking, HistoricalTollRecord, Trip, Truck
from app.services.toll_matrix import vehicle_class_for_truck


def sum_additional_toll_entries(db: Session, trip_id: int) -> float:
    rows = db.query(AdditionalTollEntry).filter(AdditionalTollEntry.trip_id == trip_id).all()
    return round(sum(float(r.amount or 0) for r in rows), 2)


def compute_trip_actual_toll(db: Session, trip: Trip, booking: Booking | None) -> tuple[float, float, float]:
    estimated = float(trip.estimated_toll_budget or 0)
    if estimated <= 0 and booking and booking.estimated_toll_budget_php is not None:
        estimated = float(booking.estimated_toll_budget_php or 0)
    additional = sum_additional_toll_entries(db, trip.id)
    actual = round(estimated + additional, 2)
    return estimated, additional, actual


def _parse_effective_date(booking: Booking | None) -> date | None:
    if booking and booking.toll_effective_date:
        return booking.toll_effective_date
    return None


def finalize_trip_toll_on_completion(db: Session, trip: Trip, booking: Booking | None) -> HistoricalTollRecord | None:
    estimated, additional, actual = compute_trip_actual_toll(db, trip, booking)
    variance = round(actual - estimated, 2)

    trip.additional_toll_total = additional
    trip.toll_actual_total = actual
    trip.toll_variance = variance
    if trip.estimated_toll_budget is None and estimated > 0:
        trip.estimated_toll_budget = estimated

    truck = db.query(Truck).filter(Truck.id == trip.truck_id).first()
    vehicle_class = vehicle_class_for_truck(truck)
    pickup = booking.pickup_location if booking else ""
    dropoff = booking.dropoff_location if booking else ""
    entry_point = (booking.toll_entry_point if booking else "") or ""
    exit_point = (booking.toll_exit_point if booking else "") or ""
    effective_date = _parse_effective_date(booking)
    if entry_point and exit_point:
        route_label = f"{entry_point} → {exit_point}"
    else:
        route_label = f"{pickup} → {dropoff}" if pickup or dropoff else trip.route_path or ""

    existing = db.query(HistoricalTollRecord).filter(HistoricalTollRecord.trip_id == trip.id).first()
    completed_at = trip.completed_at or datetime.utcnow()
    if existing:
        existing.estimated_toll = estimated
        existing.actual_toll = actual
        existing.toll_variance = variance
        existing.completed_at = completed_at
        existing.vehicle_class = vehicle_class
        existing.route_label = route_label
        existing.entry_point = entry_point
        existing.exit_point = exit_point
        existing.origin = pickup
        existing.destination = dropoff
        existing.effective_date = effective_date
        return existing

    record = HistoricalTollRecord(
        trip_id=trip.id,
        booking_id=trip.booking_id,
        route_label=route_label,
        entry_point=entry_point,
        exit_point=exit_point,
        origin=pickup,
        destination=dropoff,
        vehicle_class=vehicle_class,
        effective_date=effective_date,
        estimated_toll=estimated,
        actual_toll=actual,
        toll_variance=variance,
        completed_at=completed_at,
    )
    db.add(record)
    return record
