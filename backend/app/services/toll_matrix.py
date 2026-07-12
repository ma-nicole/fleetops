"""Descriptive NLEX-SCTEX style toll matrix lookup (no external toll APIs)."""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import Settings, settings as app_settings
from app.models.entities import TollMatrix, TollMatrixStatus, Truck
from app.services.toll_plaza_matching import (
    MIN_EXPRESSWAY_TRIP_KM,
    NEAREST_GEO_ESTIMATE_MESSAGE,
    NO_EXPRESSWAY_MESSAGE,
    NO_NEARBY_ENTRY_MESSAGE,
    NO_NEARBY_EXIT_MESSAGE,
    class3_missing_message,
    list_plaza_options,
    normalize_location,
    resolve_nearest_geo_candidates,
    resolve_plaza_pair,
)

logger = logging.getLogger(__name__)

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
    vc = DEFAULT_VEHICLE_CLASS  # fleet quotes always use Class 3
    _ = vehicle_class  # callers may pass other labels; ignored by design
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
    """FleetOps quotations always price tolls as Class 3 regardless of truck label."""
    _ = truck
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
    vc = DEFAULT_VEHICLE_CLASS
    _ = vehicle_class
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
                if best is None or len(new_path) < len(best) or (
                    len(new_path) == len(best) and fee < (best_fee or 1e18)
                ):
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


def _matrix_fee_for_pair(
    db: Session,
    entry: str,
    exit_: str,
    vehicle_class: str,
    as_of: date,
) -> tuple[float | None, list[dict[str, Any]], str | None]:
    """Direct matrix row, else short multi-segment path. Returns (fee, segments, method_suffix)."""
    row = lookup_toll_matrix(db, entry, exit_, vehicle_class, as_of)
    if row:
        fee = matrix_toll_fee(row)
        segments = [
            {
                "entry_point": row.entry_point,
                "exit_point": row.exit_point,
                "toll_fee": fee,
                "matrix_id": row.id,
                "effective_date": row.effective_date.isoformat() if row.effective_date else None,
                "vehicle_class": row.vehicle_class,
            }
        ]
        return fee, segments, None
    path_fee, path_segments = _shortest_matrix_path_fee(db, entry, exit_, vehicle_class, as_of)
    if path_fee is None or not path_segments:
        return None, [], None
    return path_fee, path_segments, "multi_segment"


def _pick_nearest_geo_matrix_pair(
    db: Session,
    *,
    pickup_location: str,
    dropoff_location: str,
    vehicle_class: str,
    as_of: date,
    settings: Settings | None = None,
) -> tuple[str | None, str | None, float | None, list[dict[str, Any]], dict[str, Any]]:
    """
    Primary auto path:
      pickup → nearest toll entry candidates
      dropoff → nearest toll exit candidates
      pick closest (entry_km + exit_km) pair that has a Class 3 matrix fee
    """
    entry_cands, exit_cands, geo_meta = resolve_nearest_geo_candidates(
        db,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        settings=settings or app_settings,
    )
    if not entry_cands or not exit_cands:
        return None, None, None, [], geo_meta

    straight = geo_meta.get("straight_line_km")
    if isinstance(straight, (int, float)) and float(straight) < MIN_EXPRESSWAY_TRIP_KM:
        geo_meta["nearest_geo_matrix_hit"] = False
        geo_meta["skip_reason"] = "short_trip_no_expressway"
        if entry_cands:
            geo_meta["suggested_entry_point"] = entry_cands[0][0]
        if exit_cands:
            geo_meta["suggested_exit_point"] = exit_cands[0][0]
        return None, None, None, [], geo_meta

    best: tuple[float, float, str, str, list[dict[str, Any]], str | None] | None = None
    tried: list[dict[str, Any]] = []
    for entry_name, entry_km in entry_cands:
        for exit_name, exit_km in exit_cands:
            if normalize_location(entry_name) == normalize_location(exit_name):
                continue
            fee, segments, suffix = _matrix_fee_for_pair(db, entry_name, exit_name, vehicle_class, as_of)
            tried.append(
                {
                    "entry": entry_name,
                    "exit": exit_name,
                    "entry_km": entry_km,
                    "exit_km": exit_km,
                    "score_km": round(float(entry_km) + float(exit_km), 2),
                    "fee": fee,
                    "path": suffix or ("direct" if fee is not None else None),
                }
            )
            if fee is None or not segments:
                continue
            score = float(entry_km) + float(exit_km)
            if best is None or score < best[0]:
                best = (score, fee, entry_name, exit_name, segments, suffix)

    geo_meta["pair_trials"] = tried[:24]
    if best is None:
        geo_meta["nearest_geo_matrix_hit"] = False
        if entry_cands and exit_cands:
            geo_meta["suggested_entry_point"] = entry_cands[0][0]
            geo_meta["suggested_exit_point"] = exit_cands[0][0]
        return None, None, None, [], geo_meta

    _, fee, entry_name, exit_name, segments, suffix = best
    geo_meta.update(
        {
            "nearest_geo_matrix_hit": True,
            "entry_distance_km": next((d for n, d in entry_cands if n == entry_name), None),
            "exit_distance_km": next((d for n, d in exit_cands if n == exit_name), None),
            "path_mode": suffix or "direct",
            "is_estimated": True,
            "suggested_entry_point": entry_name,
            "suggested_exit_point": exit_name,
        }
    )
    return entry_name, exit_name, fee, segments, geo_meta


def _explain_miss(
    *,
    entry_cands: list[tuple[str, float]],
    exit_cands: list[tuple[str, float]],
    geo_meta: dict[str, Any],
    text_entry: str | None,
    text_exit: str | None,
) -> str:
    geo_err = str(geo_meta.get("geo_error") or "")
    if "no_plazas_with_coords" in geo_err:
        return "No nearby toll entry found."
    if "pickup_geocode_failed" in geo_err and not entry_cands:
        return NO_NEARBY_ENTRY_MESSAGE
    if "dropoff" in geo_err and not exit_cands:
        return NO_NEARBY_EXIT_MESSAGE
    if not entry_cands:
        return NO_NEARBY_ENTRY_MESSAGE
    if not exit_cands:
        return NO_NEARBY_EXIT_MESSAGE

    straight = geo_meta.get("straight_line_km")
    if isinstance(straight, (int, float)) and float(straight) < MIN_EXPRESSWAY_TRIP_KM:
        return NO_EXPRESSWAY_MESSAGE

    # Same nearest plaza on both ends → local trip, no expressway segment.
    if entry_cands and exit_cands and normalize_location(entry_cands[0][0]) == normalize_location(exit_cands[0][0]):
        return NO_EXPRESSWAY_MESSAGE

    sug_e = geo_meta.get("suggested_entry_point") or (entry_cands[0][0] if entry_cands else text_entry)
    sug_x = geo_meta.get("suggested_exit_point") or (exit_cands[0][0] if exit_cands else text_exit)
    if sug_e and sug_x and normalize_location(str(sug_e)) != normalize_location(str(sug_x)):
        return class3_missing_message(str(sug_e), str(sug_x))

    return NO_EXPRESSWAY_MESSAGE


def _success_payload(
    *,
    base_meta: dict[str, Any],
    per_truck: float,
    trucks: int,
    entry_out: str,
    exit_out: str,
    segments: list[dict[str, Any]],
    vehicle_class: str,
    matrix_id: Any,
    effective: Any,
    note: str | None,
    is_estimated: bool,
) -> tuple[float, dict[str, Any]]:
    total = round(float(per_truck) * trucks, 2)
    logger.info(
        "Toll matched: pickup_lat=%s pickup_lon=%s dropoff_lat=%s dropoff_lon=%s "
        "entry=%s exit=%s vehicle_class=%s matrix_id=%s toll=%s segments=%s method=%s",
        base_meta.get("pickup_lat"),
        base_meta.get("pickup_lon"),
        base_meta.get("dropoff_lat"),
        base_meta.get("dropoff_lon"),
        entry_out,
        exit_out,
        vehicle_class,
        matrix_id,
        per_truck,
        segments,
        base_meta.get("match_method"),
    )
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
        "is_estimated": is_estimated,
        "computed_toll": per_truck,
    }


def _zero_payload(base_meta: dict[str, Any], message: str, trucks: int) -> tuple[float, dict[str, Any]]:
    logger.warning(
        "Toll unmatched: pickup_lat=%s pickup_lon=%s dropoff_lat=%s dropoff_lon=%s "
        "entry_candidates=%s exit_candidates=%s vehicle_class=%s reason=%s",
        base_meta.get("pickup_lat"),
        base_meta.get("pickup_lon"),
        base_meta.get("dropoff_lat"),
        base_meta.get("dropoff_lon"),
        base_meta.get("nearest_entry_candidates"),
        base_meta.get("nearest_exit_candidates"),
        base_meta.get("vehicle_class"),
        message,
    )
    return 0.0, {
        **base_meta,
        "matched": False,
        "is_estimated": False,
        "message": message,
        "toll_fee": 0.0,
        "toll_budget_per_truck": 0.0,
        "toll_budget_total": 0.0,
        "computed_toll": 0.0,
        "entry_point": base_meta.get("suggested_entry_point") or base_meta.get("entry_point"),
        "exit_point": base_meta.get("suggested_exit_point") or base_meta.get("exit_point"),
        "truck_count": trucks,
    }


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
    settings: Settings | None = None,
) -> tuple[float, dict[str, Any]]:
    """
    Map booking locations to toll plazas, then look up Class 3 matrix fee.

    Primary auto path (no exact address matching):
      pickup coords → nearest toll entry
      dropoff coords → nearest toll exit
      entry + exit + Class 3 → Toll Matrix fee
    """
    as_of = _coerce_as_of(as_of_date)
    trucks = max(1, int(truck_count or 1))
    cfg = settings or app_settings
    # All fleet vehicle types price as Class 3.
    vc = DEFAULT_VEHICLE_CLASS
    _ = vehicle_class

    base_meta: dict[str, Any] = {
        "vehicle_class": vc,
        "as_of_date": as_of.isoformat(),
        "plaza_options": list_plaza_options(db),
        "toll_source": TOLL_SOURCE_MATRIX,
        "segments": [],
        "is_estimated": False,
        "pickup_location": pickup_location,
        "dropoff_location": dropoff_location,
    }

    logger.info(
        "Toll resolve start: pickup=%r dropoff=%r vehicle_class=%s (forced) trucks=%s",
        pickup_location,
        dropoff_location,
        vc,
        trucks,
    )

    # 1) Explicit multi-segment waypoints (pickup → … → dropoff plazas).
    waypoint_segments = _parse_waypoint_segments(route_waypoints)
    if waypoint_segments:
        fee, details = sum_toll_segments(db, waypoint_segments, vc, as_of)
        if fee is not None and details:
            base_meta.update(
                {
                    "match_method": "waypoint_segments",
                    "match_confidence": "high",
                }
            )
            return _success_payload(
                base_meta=base_meta,
                per_truck=fee,
                trucks=trucks,
                entry_out=details[0]["entry_point"],
                exit_out=details[-1]["exit_point"],
                segments=details,
                vehicle_class=vc,
                matrix_id=details[0].get("matrix_id"),
                effective=details[-1].get("effective_date"),
                note=None,
                is_estimated=False,
            )

    # 2) Manual plaza override.
    if manual_entry and manual_exit:
        fee, segs, suffix = _matrix_fee_for_pair(db, manual_entry.strip(), manual_exit.strip(), vc, as_of)
        if fee is not None and segs:
            base_meta.update(
                {
                    "match_method": "manual" + (f"+{suffix}" if suffix else ""),
                    "match_confidence": "high",
                    "entry_match_method": "manual",
                    "exit_match_method": "manual",
                }
            )
            return _success_payload(
                base_meta=base_meta,
                per_truck=fee,
                trucks=trucks,
                entry_out=segs[0]["entry_point"],
                exit_out=segs[-1]["exit_point"],
                segments=segs,
                vehicle_class=vc,
                matrix_id=segs[0].get("matrix_id"),
                effective=segs[-1].get("effective_date"),
                note=None,
                is_estimated=False,
            )
        return _zero_payload(
            {
                **base_meta,
                "match_method": "manual",
                "suggested_entry_point": manual_entry.strip(),
                "suggested_exit_point": manual_exit.strip(),
            },
            class3_missing_message(manual_entry.strip(), manual_exit.strip()),
            trucks,
        )

    # 3) PRIMARY: nearest toll entry/exit by geocoded coordinates → Class 3 matrix.
    n_entry, n_exit, n_fee, n_segs, geo_meta = _pick_nearest_geo_matrix_pair(
        db,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        vehicle_class=vc,
        as_of=as_of,
        settings=cfg,
    )
    base_meta.update(geo_meta)
    entry_cands = [(c["plaza"], c["km"]) for c in (geo_meta.get("nearest_entry_candidates") or [])]
    exit_cands = [(c["plaza"], c["km"]) for c in (geo_meta.get("nearest_exit_candidates") or [])]

    if n_entry and n_exit and n_fee is not None and n_segs:
        path_mode = geo_meta.get("path_mode") or "direct"
        method = "nearest_geo" if path_mode == "direct" else f"nearest_geo+{path_mode}"
        base_meta.update(
            {
                "match_method": method,
                "match_confidence": "medium",
                "is_estimated": True,
                "entry_match_method": "nearest_geo",
                "exit_match_method": "nearest_geo",
            }
        )
        return _success_payload(
            base_meta=base_meta,
            per_truck=n_fee,
            trucks=trucks,
            entry_out=n_segs[0]["entry_point"],
            exit_out=n_segs[-1]["exit_point"],
            segments=n_segs,
            vehicle_class=vc,
            matrix_id=n_segs[0].get("matrix_id"),
            effective=n_segs[-1].get("effective_date"),
            note=NEAREST_GEO_ESTIMATE_MESSAGE,
            is_estimated=True,
        )

    # 4) Secondary: text/alias/catalog (when locations already are plaza names).
    entry, exit_, match_method, confidence, match_meta = resolve_plaza_pair(
        db,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        manual_entry=None,
        manual_exit=None,
        route_origin=route_origin,
        route_destination=route_destination,
    )
    base_meta.update(match_meta)
    if entry and exit_ and confidence != "none":
        fee, segs, suffix = _matrix_fee_for_pair(db, entry, exit_, vc, as_of)
        if fee is not None and segs:
            method = match_method if not suffix else f"{match_method}+{suffix}"
            base_meta.update(
                {
                    "match_method": method,
                    "match_confidence": confidence,
                }
            )
            note = None
            is_est = confidence == "medium"
            if is_est:
                note = f"Auto-matched plazas with medium confidence: {segs[0]['entry_point']} → {segs[-1]['exit_point']}."
            return _success_payload(
                base_meta=base_meta,
                per_truck=fee,
                trucks=trucks,
                entry_out=segs[0]["entry_point"],
                exit_out=segs[-1]["exit_point"],
                segments=segs,
                vehicle_class=vc,
                matrix_id=segs[0].get("matrix_id"),
                effective=segs[-1].get("effective_date"),
                note=note,
                is_estimated=is_est,
            )
        return _zero_payload(
            {
                **base_meta,
                "suggested_entry_point": entry,
                "suggested_exit_point": exit_,
            },
            class3_missing_message(entry, exit_),
            trucks,
        )

    reason = _explain_miss(
        entry_cands=entry_cands,
        exit_cands=exit_cands,
        geo_meta=geo_meta,
        text_entry=entry,
        text_exit=exit_,
    )
    return _zero_payload(base_meta, reason, trucks)
