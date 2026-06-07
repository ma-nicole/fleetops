"""Descriptive NLEX-SCTEX style toll matrix lookup (no external toll APIs)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import TollMatrix, TollMatrixStatus, Truck
from app.services.toll_plaza_matching import (
    LOW_CONFIDENCE_PLAZA_MESSAGE,
    NO_PLAZA_MATCH_MESSAGE,
    list_plaza_options,
    normalize_location,
    resolve_plaza_pair,
)

DEFAULT_VEHICLE_CLASS = "Class 3"


def matrix_toll_fee(row: TollMatrix) -> float:
    return round(float(row.toll_fee or 0), 2)


def lookup_toll_matrix(
    db: Session,
    entry_point: str,
    exit_point: str,
    vehicle_class: str = DEFAULT_VEHICLE_CLASS,
    as_of_date: date | None = None,
) -> TollMatrix | None:
    """Find the active matrix row for entry→exit, using the latest effective_date on or before as_of_date."""
    as_of = as_of_date or date.today()
    vc = (vehicle_class or DEFAULT_VEHICLE_CLASS).strip()
    rows = (
        db.query(TollMatrix)
        .filter(
            TollMatrix.status == TollMatrixStatus.ACTIVE.value,
            TollMatrix.vehicle_class == vc,
            TollMatrix.effective_date <= as_of,
        )
        .order_by(TollMatrix.effective_date.desc())
        .all()
    )
    entry_norm = normalize_location(entry_point)
    exit_norm = normalize_location(exit_point)
    exact: list[TollMatrix] = []
    for row in rows:
        if normalize_location(row.entry_point) == entry_norm and normalize_location(row.exit_point) == exit_norm:
            exact.append(row)
    if exact:
        return max(exact, key=lambda r: r.effective_date)
    fuzzy: list[TollMatrix] = []
    for row in rows:
        re_ = normalize_location(row.entry_point)
        rx = normalize_location(row.exit_point)
        if (re_ in entry_norm or entry_norm in re_) and (rx in exit_norm or exit_norm in rx):
            fuzzy.append(row)
    if fuzzy:
        return max(fuzzy, key=lambda r: r.effective_date)
    return None


def vehicle_class_for_truck(truck: Truck | None) -> str:
    if truck and (truck.vehicle_class or "").strip():
        return truck.vehicle_class.strip()
    return DEFAULT_VEHICLE_CLASS


def _coerce_as_of(value: date | datetime | str | None) -> date:
    if value is None:
        return date.today()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return date.today()


def resolve_booking_toll_estimate(
    db: Session,
    *,
    pickup_location: str,
    dropoff_location: str,
    vehicle_class: str = DEFAULT_VEHICLE_CLASS,
    truck_count: int = 1,
    as_of_date: date | datetime | str | None = None,
    manual_entry: str | None = None,
    manual_exit: str | None = None,
    route_origin: str | None = None,
    route_destination: str | None = None,
) -> tuple[float | None, dict[str, Any]]:
    """Map booking locations to toll plazas, then look up matrix toll fee."""
    as_of = _coerce_as_of(as_of_date)
    entry, exit_, match_method, confidence, match_meta = resolve_plaza_pair(
        db,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        manual_entry=manual_entry,
        manual_exit=manual_exit,
        route_origin=route_origin,
        route_destination=route_destination,
    )

    base_meta: dict[str, Any] = {
        "vehicle_class": vehicle_class,
        "as_of_date": as_of.isoformat(),
        "match_method": match_method,
        "match_confidence": confidence,
        "plaza_options": list_plaza_options(db),
        **match_meta,
    }

    if not entry or not exit_ or confidence == "none":
        return None, {
            **base_meta,
            "matched": False,
            "message": NO_PLAZA_MATCH_MESSAGE,
        }

    if confidence == "medium" and match_method != "manual":
        return None, {
            **base_meta,
            "matched": False,
            "message": LOW_CONFIDENCE_PLAZA_MESSAGE,
            "match_confidence": confidence,
            "suggested_entry_point": entry,
            "suggested_exit_point": exit_,
        }

    row = lookup_toll_matrix(db, entry, exit_, vehicle_class, as_of)
    if not row:
        return None, {
            **base_meta,
            "matched": False,
            "message": NO_PLAZA_MATCH_MESSAGE,
            "entry_point": entry,
            "exit_point": exit_,
        }

    per_truck = matrix_toll_fee(row)
    total = round(per_truck * max(1, truck_count), 2)
    return per_truck, {
        **base_meta,
        "matched": True,
        "message": None,
        "matrix_id": row.id,
        "entry_point": row.entry_point,
        "exit_point": row.exit_point,
        "vehicle_class": row.vehicle_class,
        "toll_fee": per_truck,
        "effective_date": row.effective_date.isoformat() if row.effective_date else None,
        "toll_budget_per_truck": per_truck,
        "toll_budget_total": total,
    }
