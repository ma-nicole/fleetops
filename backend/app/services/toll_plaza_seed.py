"""Seed / sync toll plazas + Toll Matrix sample rows from bundled JSON."""
from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.entities import TollMatrix, TollMatrixStatus, TollPlaza, TollPlazaAlias, TollPlazaStatus

logger = logging.getLogger(__name__)

PLAZA_SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "toll_plaza_coords_seed.json"
MATRIX_SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "nlex_sctex_class3_sample.json"

# Back-compat alias used by older imports / tests.
SEED_PATH = PLAZA_SEED_PATH


def ensure_toll_plaza_coords_seeded(db: Session) -> int:
    """Upsert plazas from the seed file (coords, corridor, aliases). Returns rows touched."""
    if not PLAZA_SEED_PATH.is_file():
        logger.warning("Toll plaza coords seed missing: %s", PLAZA_SEED_PATH)
        return 0

    try:
        rows = json.loads(PLAZA_SEED_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.exception("Failed reading toll plaza coords seed")
        return 0

    if not isinstance(rows, list):
        return 0

    touched = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("canonical_name") or "").strip()
        if not name:
            continue
        lat = row.get("latitude")
        lon = row.get("longitude")
        corridor = (str(row.get("corridor") or "").strip() or None)
        aliases = row.get("aliases") or []

        plaza = db.query(TollPlaza).filter(TollPlaza.canonical_name == name).first()
        if plaza is None:
            plaza = TollPlaza(
                canonical_name=name,
                status=TollPlazaStatus.ACTIVE.value,
                latitude=float(lat) if lat is not None else None,
                longitude=float(lon) if lon is not None else None,
                corridor=corridor,
            )
            db.add(plaza)
            db.flush()
            touched += 1
        else:
            changed = False
            if lat is not None:
                new_lat = float(lat)
                if plaza.latitude is None or abs(float(plaza.latitude) - new_lat) > 1e-6:
                    plaza.latitude = new_lat
                    changed = True
            if lon is not None:
                new_lon = float(lon)
                if plaza.longitude is None or abs(float(plaza.longitude) - new_lon) > 1e-6:
                    plaza.longitude = new_lon
                    changed = True
            if corridor and plaza.corridor != corridor:
                plaza.corridor = corridor
                changed = True
            if plaza.status != TollPlazaStatus.ACTIVE.value:
                plaza.status = TollPlazaStatus.ACTIVE.value
                changed = True
            if changed:
                touched += 1

        existing_aliases = {
            a.alias.strip().lower()
            for a in db.query(TollPlazaAlias).filter(TollPlazaAlias.plaza_id == plaza.id).all()
        }
        for alias in aliases:
            text = str(alias or "").strip()
            if not text or text.lower() in existing_aliases:
                continue
            db.add(TollPlazaAlias(plaza_id=plaza.id, alias=text))
            existing_aliases.add(text.lower())
            touched += 1

    if touched:
        db.commit()
    return touched


def ensure_toll_matrix_seeded(db: Session) -> int:
    """Insert missing active Class 3 matrix rows from the bundled sample (idempotent)."""
    if not MATRIX_SEED_PATH.is_file():
        logger.warning("Toll matrix seed missing: %s", MATRIX_SEED_PATH)
        return 0
    try:
        rows = json.loads(MATRIX_SEED_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.exception("Failed reading toll matrix seed")
        return 0
    if not isinstance(rows, list):
        return 0

    inserted = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        entry = str(row.get("entry_point") or "").strip()
        exit_ = str(row.get("exit_point") or "").strip()
        vc = str(row.get("vehicle_class") or "Class 3").strip() or "Class 3"
        fee = float(row.get("toll_fee") or 0)
        eff_raw = str(row.get("effective_date") or "2026-01-20")[:10]
        try:
            eff = date.fromisoformat(eff_raw)
        except ValueError:
            eff = date(2026, 1, 20)
        if not entry or not exit_ or fee <= 0:
            continue
        exists = (
            db.query(TollMatrix)
            .filter(
                TollMatrix.entry_point == entry,
                TollMatrix.exit_point == exit_,
                TollMatrix.vehicle_class == vc,
                TollMatrix.effective_date == eff,
            )
            .first()
        )
        if exists:
            if exists.status != TollMatrixStatus.ACTIVE.value:
                exists.status = TollMatrixStatus.ACTIVE.value
                exists.toll_fee = fee
                inserted += 1
            continue
        db.add(
            TollMatrix(
                entry_point=entry,
                exit_point=exit_,
                vehicle_class=vc,
                toll_fee=fee,
                effective_date=eff,
                status=TollMatrixStatus.ACTIVE.value,
            )
        )
        inserted += 1

    if inserted:
        db.commit()
    return inserted


def ensure_toll_reference_data(db: Session) -> dict[str, int]:
    plazas = ensure_toll_plaza_coords_seeded(db)
    matrix = ensure_toll_matrix_seeded(db)
    logger.info("Toll reference seed plazas_touched=%s matrix_inserted=%s", plazas, matrix)
    return {"plazas_touched": plazas, "matrix_inserted": matrix}
