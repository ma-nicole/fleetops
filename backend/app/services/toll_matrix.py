"""Descriptive NLEX-SCTEX style toll matrix lookup (no external toll APIs)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import TollMatrix, TollMatrixStatus, Truck
from app.services.toll_plaza_matching import (
    NO_PLAZA_MATCH_MESSAGE,
    list_plaza_options,
    normalize_location,
    resolve_plaza_pair,
)

DEFAULT_VEHICLE_CLASS = "Class 3"
TOLL_SOURCE_MATRIX = "Toll Matrix"


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


def _latest_active_edges(
    db: Session,
    vehicle_class: str,
    as_of: date,
) -> list[TollMatrix]:
    """One edge per unique entry→exit using the latest effective_date ≤ as_of."""
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
    best: dict[tuple[str, str], TollMatrix] = {}
    for row in rows:
        key = (normalize_location(row.entry_point), normalize_location(row.exit_point))
        if key not in best:
            best[key] = row
    return list(best.values())


def sum_toll_segments(
    db: Session,
    segments: list[tuple[str, str]],
    vehicle_class: str = DEFAULT_VEHICLE_CLASS,
    as_of_date: date | None = None,
) -> tuple[float | None, list[dict[str, Any]]]:
    """Look up and sum matrix fees for consecutive entry→exit segments."""
    as_of = as_of_date or date.today()
    details: list[dict[str, Any]] = []
    total = 0.0
    for entry, exit_ in segments:
        entry_s = (entry or "").strip()
        exit_s = (exit_ or "").strip()
        if not entry_s or not exit_s:
            continue
        row = lookup_toll_matrix(db, entry_s, exit_s, vehicle_class, as_of)
        if not row:
            return None, details
        fee = matrix_toll_fee(row)
        total += fee
        details.append(
            {
                "entry_point": row.entry_point,
                "exit_point": row.exit_point,
                "toll_fee": fee,
                "matrix_id": row.id,
                "effective_date": row.effective_date.isoformat() if row.effective_date else None,
                "vehicle_class": row.vehicle_class,
            }
        )
    if not details:
        return None, details
    return round(total, 2), details


def _shortest_matrix_path_fee(
    db: Session,
    entry_point: str,
    exit_point: str,
    vehicle_class: str,
    as_of: date,
    *,
    max_hops: int = 4,
) -> tuple[float | None, list[dict[str, Any]]]:
    """If no direct entry→exit row, sum a short path of matrix edges (multi-segment)."""
    start = normalize_location(entry_point)
    goal = normalize_location(exit_point)
    if not start or not goal or start == goal:
        return None, []

    edges = _latest_active_edges(db, vehicle_class, as_of)
    graph: dict[str, list[tuple[str, TollMatrix]]] = {}
    for row in edges:
        a = normalize_location(row.entry_point)
        b = normalize_location(row.exit_point)
        graph.setdefault(a, []).append((b, row))

    # BFS on plaza nodes for fewest hops (then lowest fee among same hop count).
    from collections import deque

    queue: deque[tuple[str, list[TollMatrix]]] = deque([(start, [])])
    visited: set[str] = {start}
    best: list[TollMatrix] | None = None
    best_fee: float | None = None

    while queue:
        node, path = queue.popleft()
        if len(path) >= max_hops:
            continue
        for nxt, edge in graph.get(node, []):
            if nxt in visited and nxt != goal:
                continue
            new_path = path + [edge]
            if nxt == goal:
                fee = round(sum(matrix_toll_fee(r) for r in new_path), 2)
                if best is None or len(new_path) < len(best) or (len(new_path) == len(best) and fee < (best_fee or 1e18)):
                    best = new_path
                    best_fee = fee
                continue
            if nxt not in visited:
                visited.add(nxt)
                queue.append((nxt, new_path))

    if not best or best_fee is None:
        return None, []
    details = [
        {
            "entry_point": r.entry_point,
            "exit_point": r.exit_point,
            "toll_fee": matrix_toll_fee(r),
            "matrix_id": r.id,
            "effective_date": r.effective_date.isoformat() if r.effective_date else None,
            "vehicle_class": r.vehicle_class,
        }
        for r in best
    ]
    return best_fee, details


def _parse_waypoint_segments(route_waypoints: list[str] | None) -> list[tuple[str, str]]:
    points = [str(p).strip() for p in (route_waypoints or []) if str(p).strip()]
    if len(points) < 2:
        return []
    return [(points[i], points[i + 1]) for i in range(len(points) - 1)]


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
    route_waypoints: list[str] | None = None,
) -> tuple[float | None, dict[str, Any]]:
    """Map booking locations to toll plazas, then look up matrix toll fee (auto; no booking-time manual required)."""
    as_of = _coerce_as_of(as_of_date)
    trucks = max(1, int(truck_count or 1))

    base_meta: dict[str, Any] = {
        "vehicle_class": vehicle_class,
        "as_of_date": as_of.isoformat(),
        "plaza_options": list_plaza_options(db),
        "toll_source": TOLL_SOURCE_MATRIX,
        "segments": [],
    }

    # 1) Explicit multi-segment waypoints (pickup → … → dropoff plazas).
    waypoint_segments = _parse_waypoint_segments(route_waypoints)
    if waypoint_segments:
        fee, details = sum_toll_segments(db, waypoint_segments, vehicle_class, as_of)
        if fee is not None and details:
            total = round(fee * trucks, 2)
            return fee, {
                **base_meta,
                "matched": True,
                "message": None,
                "match_method": "waypoint_segments",
                "match_confidence": "high",
                "entry_point": details[0]["entry_point"],
                "exit_point": details[-1]["exit_point"],
                "toll_fee": fee,
                "effective_date": details[-1].get("effective_date"),
                "toll_budget_per_truck": fee,
                "toll_budget_total": total,
                "segments": details,
                "matrix_id": details[0].get("matrix_id"),
            }

    entry, exit_, match_method, confidence, match_meta = resolve_plaza_pair(
        db,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        manual_entry=manual_entry,
        manual_exit=manual_exit,
        route_origin=route_origin,
        route_destination=route_destination,
    )

    base_meta.update(
        {
            "match_method": match_method,
            "match_confidence": confidence,
            **match_meta,
        }
    )

    if not entry or not exit_ or confidence == "none":
        return None, {
            **base_meta,
            "matched": False,
            "message": NO_PLAZA_MATCH_MESSAGE.replace(
                "Please select entry and exit toll manually.",
                "Flat toll fallback will be used.",
            ),
        }

    # Auto-accept medium confidence (suggested plazas) — booking no longer requires manual plaza picks.
    row = lookup_toll_matrix(db, entry, exit_, vehicle_class, as_of)
    segments: list[dict[str, Any]] = []
    per_truck: float | None = None

    if row:
        per_truck = matrix_toll_fee(row)
        segments = [
            {
                "entry_point": row.entry_point,
                "exit_point": row.exit_point,
                "toll_fee": per_truck,
                "matrix_id": row.id,
                "effective_date": row.effective_date.isoformat() if row.effective_date else None,
                "vehicle_class": row.vehicle_class,
            }
        ]
        entry_out, exit_out = row.entry_point, row.exit_point
        effective = row.effective_date.isoformat() if row.effective_date else None
        matrix_id = row.id
    else:
        path_fee, path_segments = _shortest_matrix_path_fee(db, entry, exit_, vehicle_class, as_of)
        if path_fee is None or not path_segments:
            return None, {
                **base_meta,
                "matched": False,
                "message": NO_PLAZA_MATCH_MESSAGE.replace(
                    "Please select entry and exit toll manually.",
                    "Flat toll fallback will be used.",
                ),
                "entry_point": entry,
                "exit_point": exit_,
            }
        per_truck = path_fee
        segments = path_segments
        entry_out = path_segments[0]["entry_point"]
        exit_out = path_segments[-1]["exit_point"]
        effective = path_segments[-1].get("effective_date")
        matrix_id = path_segments[0].get("matrix_id")
        base_meta["match_method"] = f"{match_method}+multi_segment"

    total = round(float(per_truck) * trucks, 2)
    note = None
    if confidence == "medium" and match_method != "manual":
        note = f"Auto-matched plazas with medium confidence: {entry_out} → {exit_out}."

    return per_truck, {
        **base_meta,
        "matched": True,
        "message": note,
        "matrix_id": matrix_id,
        "entry_point": entry_out,
        "exit_point": exit_out,
        "vehicle_class": vehicle_class,
        "toll_fee": per_truck,
        "effective_date": effective,
        "toll_budget_per_truck": per_truck,
        "toll_budget_total": total,
        "segments": segments,
    }
