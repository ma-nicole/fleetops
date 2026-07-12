"""Descriptive NLEX-SCTEX style toll matrix lookup (no external toll APIs)."""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import Settings, settings as app_settings
from app.models.entities import TollMatrix, TollMatrixStatus, Truck
from app.services.toll_plaza_matching import (
    NEAREST_GEO_ESTIMATE_MESSAGE,
    NEARBY_PLAZA_KM,
    NO_EXPRESSWAY_MESSAGE,
    NO_MATRIX_PAIR_MESSAGE,
    NO_NEARBY_ENTRY_MESSAGE,
    NO_NEARBY_EXIT_MESSAGE,
    NO_PLAZA_MATCH_MESSAGE,
    list_plaza_options,
    normalize_location,
    resolve_nearest_geo_candidates,
    resolve_plaza_pair,
)

logger = logging.getLogger(__name__)

DEFAULT_VEHICLE_CLASS = "Class 3"
TOLL_SOURCE_MATRIX = "Toll Matrix"


def normalize_vehicle_class(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return DEFAULT_VEHICLE_CLASS
    lower = raw.lower().replace("class", "").strip()
    if lower.isdigit():
        return f"Class {lower}"
    if raw.lower().startswith("class"):
        return f"Class {lower}" if lower.isdigit() else raw
    return raw


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
    vc = normalize_vehicle_class(vehicle_class)
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
        return normalize_vehicle_class(truck.vehicle_class)
    return DEFAULT_VEHICLE_CLASS


def _vehicle_classes_for_pair(
    db: Session,
    entry_point: str,
    exit_point: str,
    as_of: date,
) -> list[str]:
    """Active vehicle classes that have a direct matrix row for entry→exit."""
    entry_norm = normalize_location(entry_point)
    exit_norm = normalize_location(exit_point)
    rows = (
        db.query(TollMatrix)
        .filter(
            TollMatrix.status == TollMatrixStatus.ACTIVE.value,
            TollMatrix.effective_date <= as_of,
        )
        .all()
    )
    found: set[str] = set()
    for row in rows:
        if normalize_location(row.entry_point) == entry_norm and normalize_location(row.exit_point) == exit_norm:
            found.add(row.vehicle_class)
    return sorted(found)


def _explain_unmatched_pair(
    db: Session,
    *,
    entry_cands: list[tuple[str, float]],
    exit_cands: list[tuple[str, float]],
    vehicle_class: str,
    as_of: date,
    geo_meta: dict[str, Any],
) -> str:
    """Build an explicit reason when nearest-geo candidates cannot produce a matrix fee."""
    if geo_meta.get("failure_reason"):
        return str(geo_meta["failure_reason"])

    if not entry_cands and not exit_cands:
        return NO_EXPRESSWAY_MESSAGE
    if not entry_cands:
        return NO_NEARBY_ENTRY_MESSAGE
    if not exit_cands:
        return NO_NEARBY_EXIT_MESSAGE

    nearest_entry_name, nearest_entry_km = entry_cands[0]
    nearest_exit_name, nearest_exit_km = exit_cands[0]

    # Both ends far from any plaza → trip does not use expressways.
    if float(nearest_entry_km) > NEARBY_PLAZA_KM and float(nearest_exit_km) > NEARBY_PLAZA_KM:
        return NO_EXPRESSWAY_MESSAGE

    # Check nearest pair for wrong vehicle class.
    other_classes = _vehicle_classes_for_pair(db, nearest_entry_name, nearest_exit_name, as_of)
    if other_classes and vehicle_class not in other_classes:
        return (
            f"{vehicle_class} does not exist for this toll route "
            f"({nearest_entry_name} → {nearest_exit_name}). "
            f"Available: {', '.join(other_classes)}."
        )

    # Scan top candidates for any class mismatch vs missing route.
    for entry_name, _ek in entry_cands[:5]:
        for exit_name, _xk in exit_cands[:5]:
            if normalize_location(entry_name) == normalize_location(exit_name):
                continue
            classes = _vehicle_classes_for_pair(db, entry_name, exit_name, as_of)
            if classes and vehicle_class not in classes:
                return (
                    f"{vehicle_class} does not exist for this toll route "
                    f"({entry_name} → {exit_name}). "
                    f"Available: {', '.join(classes)}."
                )

    if float(nearest_entry_km) > NEARBY_PLAZA_KM:
        return NO_NEARBY_ENTRY_MESSAGE
    if float(nearest_exit_km) > NEARBY_PLAZA_KM:
        return NO_NEARBY_EXIT_MESSAGE

    return (
        f"{NO_MATRIX_PAIR_MESSAGE} "
        f"Nearest candidates: {nearest_entry_name} ({nearest_entry_km} km) → "
        f"{nearest_exit_name} ({nearest_exit_km} km)."
    )


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
    vc = normalize_vehicle_class(vehicle_class)
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
    route_distance_km: float | None = None,
) -> tuple[str | None, str | None, float | None, list[dict[str, Any]], dict[str, Any]]:
    """Primary matcher: nearest entry near pickup + nearest exit near dropoff + vehicle class."""
    vc = normalize_vehicle_class(vehicle_class)
    entry_cands, exit_cands, geo_meta = resolve_nearest_geo_candidates(
        db,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        settings=settings or app_settings,
    )
    geo_meta["vehicle_class"] = vc
    if route_distance_km is not None:
        geo_meta["route_distance_km"] = float(route_distance_km)

    if not entry_cands or not exit_cands:
        reason = _explain_unmatched_pair(
            db,
            entry_cands=entry_cands,
            exit_cands=exit_cands,
            vehicle_class=vc,
            as_of=as_of,
            geo_meta=geo_meta,
        )
        geo_meta["nearest_geo_matrix_hit"] = False
        geo_meta["failure_reason"] = reason
        logger.info(
            "toll_match miss pickup=%r dropoff=%r vehicle_class=%s reason=%s entry_cands=%s exit_cands=%s",
            pickup_location,
            dropoff_location,
            vc,
            reason,
            entry_cands[:3],
            exit_cands[:3],
        )
        return None, None, None, [], geo_meta

    best: tuple[float, float, str, str, list[dict[str, Any]], str | None] | None = None
    # Prefer closer plazas; lightly prefer pairs whose span aligns with route distance when known.
    for entry_name, entry_km in entry_cands:
        for exit_name, exit_km in exit_cands:
            if normalize_location(entry_name) == normalize_location(exit_name):
                continue
            fee, segments, suffix = _matrix_fee_for_pair(db, entry_name, exit_name, vc, as_of)
            if fee is None or not segments:
                continue
            score = float(entry_km) + float(exit_km)
            if route_distance_km is not None and route_distance_km > 0:
                # Prefer entry/exit that are near the ends of a long haul (not mid-route plazas only).
                score += abs(float(entry_km) - float(exit_km)) * 0.05
            if best is None or score < best[0]:
                best = (score, fee, entry_name, exit_name, segments, suffix)

    if best is None:
        reason = _explain_unmatched_pair(
            db,
            entry_cands=entry_cands,
            exit_cands=exit_cands,
            vehicle_class=vc,
            as_of=as_of,
            geo_meta=geo_meta,
        )
        geo_meta["nearest_geo_matrix_hit"] = False
        geo_meta["failure_reason"] = reason
        logger.info(
            "toll_match no_matrix_pair pickup=%r dropoff=%r vehicle_class=%s reason=%s "
            "pickup_coords=(%s,%s) dropoff_coords=(%s,%s) nearest_entry=%s nearest_exit=%s",
            pickup_location,
            dropoff_location,
            vc,
            reason,
            geo_meta.get("pickup_lat"),
            geo_meta.get("pickup_lon"),
            geo_meta.get("dropoff_lat"),
            geo_meta.get("dropoff_lon"),
            entry_cands[0] if entry_cands else None,
            exit_cands[0] if exit_cands else None,
        )
        return None, None, None, [], geo_meta

    _, fee, entry_name, exit_name, segments, suffix = best
    geo_meta.update(
        {
            "nearest_geo_matrix_hit": True,
            "detected_toll_entry": entry_name,
            "detected_toll_exit": exit_name,
            "entry_distance_km": next((d for n, d in entry_cands if n == entry_name), None),
            "exit_distance_km": next((d for n, d in exit_cands if n == exit_name), None),
            "path_mode": suffix or "direct",
            "is_estimated": True,
            "matched_matrix_record": segments[0] if len(segments) == 1 else segments,
        }
    )
    logger.info(
        "toll_match hit pickup_lat=%s pickup_lon=%s dropoff_lat=%s dropoff_lon=%s "
        "entry=%s exit=%s vehicle_class=%s toll=%s matrix=%s path_mode=%s",
        geo_meta.get("pickup_lat"),
        geo_meta.get("pickup_lon"),
        geo_meta.get("dropoff_lat"),
        geo_meta.get("dropoff_lon"),
        entry_name,
        exit_name,
        vc,
        fee,
        [{"matrix_id": s.get("matrix_id"), "fee": s.get("toll_fee")} for s in segments],
        suffix or "direct",
    )
    return entry_name, exit_name, fee, segments, geo_meta


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
    route_distance_km: float | None = None,
    settings: Settings | None = None,
) -> tuple[float, dict[str, Any]]:
    """Nearest entry/exit + vehicle class → Toll Matrix fee.

    Always returns an explicit per-truck toll amount (including 0.0) with a clear reason when unmatched.
    Does not silently fall back to freight knobs.
    """
    as_of = _coerce_as_of(as_of_date)
    trucks = max(1, int(truck_count or 1))
    cfg = settings or app_settings
    vc = normalize_vehicle_class(vehicle_class)

    base_meta: dict[str, Any] = {
        "vehicle_class": vc,
        "as_of_date": as_of.isoformat(),
        "plaza_options": list_plaza_options(db),
        "toll_source": TOLL_SOURCE_MATRIX,
        "segments": [],
        "is_estimated": False,
        "pickup_location": (pickup_location or "").strip(),
        "dropoff_location": (dropoff_location or "").strip(),
        "route_distance_km": float(route_distance_km) if route_distance_km is not None else None,
    }

    def _zero(reason: str, **extra: Any) -> tuple[float, dict[str, Any]]:
        meta = {
            **base_meta,
            "matched": False,
            "is_estimated": False,
            "message": reason,
            "failure_reason": reason,
            "toll_fee": 0.0,
            "toll_budget_per_truck": 0.0,
            "toll_budget_total": 0.0,
            "entry_point": extra.pop("entry_point", None),
            "exit_point": extra.pop("exit_point", None),
            **extra,
        }
        logger.info(
            "toll_estimate zero reason=%s pickup=%r dropoff=%r vehicle_class=%s",
            reason,
            pickup_location,
            dropoff_location,
            vc,
        )
        return 0.0, meta

    def _hit(
        fee: float,
        segments: list[dict[str, Any]],
        *,
        match_method: str,
        confidence: str,
        is_estimated: bool,
        message: str | None,
        **extra: Any,
    ) -> tuple[float, dict[str, Any]]:
        total = round(float(fee) * trucks, 2)
        entry_out = segments[0]["entry_point"] if segments else extra.get("entry_point")
        exit_out = segments[-1]["exit_point"] if segments else extra.get("exit_point")
        meta = {
            **base_meta,
            "matched": True,
            "message": message,
            "match_method": match_method,
            "match_confidence": confidence,
            "matrix_id": segments[0].get("matrix_id") if segments else None,
            "entry_point": entry_out,
            "exit_point": exit_out,
            "detected_toll_entry": entry_out,
            "detected_toll_exit": exit_out,
            "vehicle_class": vc,
            "toll_fee": fee,
            "effective_date": segments[-1].get("effective_date") if segments else None,
            "toll_budget_per_truck": fee,
            "toll_budget_total": total,
            "segments": segments,
            "is_estimated": is_estimated,
            "matched_matrix_record": segments[0] if len(segments) == 1 else segments,
            **extra,
        }
        logger.info(
            "toll_estimate computed toll=%s entry=%s exit=%s vehicle_class=%s method=%s trucks=%s total=%s",
            fee,
            entry_out,
            exit_out,
            vc,
            match_method,
            trucks,
            total,
        )
        return fee, meta

    # 1) Explicit multi-segment waypoints (pickup → … → dropoff plazas).
    waypoint_segments = _parse_waypoint_segments(route_waypoints)
    if waypoint_segments:
        fee, details = sum_toll_segments(db, waypoint_segments, vc, as_of)
        if fee is not None and details:
            return _hit(
                fee,
                details,
                match_method="waypoint_segments",
                confidence="high",
                is_estimated=False,
                message=None,
            )
        return _zero("Waypoint plazas could not be matched in the Toll Matrix for this vehicle class.")

    # 2) Manual plaza override (admin / form).
    if manual_entry and manual_exit:
        fee, segs, suffix = _matrix_fee_for_pair(db, manual_entry.strip(), manual_exit.strip(), vc, as_of)
        if fee is not None and segs:
            method = "manual" if not suffix else f"manual+{suffix}"
            return _hit(
                fee,
                segs,
                match_method=method,
                confidence="high",
                is_estimated=False,
                message=None,
                entry_match_method="manual",
                exit_match_method="manual",
            )
        other = _vehicle_classes_for_pair(db, manual_entry.strip(), manual_exit.strip(), as_of)
        if other and vc not in other:
            return _zero(
                f"{vc} does not exist for this toll route "
                f"({manual_entry.strip()} → {manual_exit.strip()}). "
                f"Available: {', '.join(other)}.",
                entry_point=manual_entry.strip(),
                exit_point=manual_exit.strip(),
                match_method="manual",
            )
        return _zero(
            f"{NO_MATRIX_PAIR_MESSAGE} ({manual_entry.strip()} → {manual_exit.strip()}).",
            entry_point=manual_entry.strip(),
            exit_point=manual_exit.strip(),
            match_method="manual",
        )

    # 3) Primary: nearest toll entry (pickup) + nearest toll exit (dropoff) + vehicle class.
    n_entry, n_exit, n_fee, n_segs, geo_meta = _pick_nearest_geo_matrix_pair(
        db,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        vehicle_class=vc,
        as_of=as_of,
        settings=cfg,
        route_distance_km=route_distance_km,
    )
    base_meta.update({k: v for k, v in geo_meta.items() if k not in ("plaza_options",)})
    if n_entry and n_exit and n_fee is not None and n_segs:
        path_mode = geo_meta.get("path_mode") or "direct"
        method = "nearest_geo" if path_mode == "direct" else f"nearest_geo+{path_mode}"
        return _hit(
            n_fee,
            n_segs,
            match_method=method,
            confidence="medium",
            is_estimated=True,
            message=NEAREST_GEO_ESTIMATE_MESSAGE,
            entry_match_method="nearest_geo",
            exit_match_method="nearest_geo",
            suggested_entry_point=n_entry,
            suggested_exit_point=n_exit,
            entry_distance_km=geo_meta.get("entry_distance_km"),
            exit_distance_km=geo_meta.get("exit_distance_km"),
        )

    # 4) Optional text / route-catalog assist (still not exact full-address matching).
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
            is_est = confidence != "high"
            note = (
                f"Auto-matched plazas with medium confidence: {segs[0]['entry_point']} → {segs[-1]['exit_point']}."
                if is_est
                else None
            )
            return _hit(
                fee,
                segs,
                match_method=method,
                confidence=confidence,
                is_estimated=is_est,
                message=note,
            )

    reason = str(geo_meta.get("failure_reason") or NO_PLAZA_MATCH_MESSAGE)
    return _zero(
        reason,
        match_method=geo_meta.get("match_method") or "nearest_geo",
        match_confidence="none",
        entry_point=entry,
        exit_point=exit_,
    )
