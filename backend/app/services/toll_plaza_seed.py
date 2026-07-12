"""Seed / sync toll plazas (coords) and Class 3 Toll Matrix sample rows."""
from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.entities import TollMatrix, TollMatrixStatus, TollPlaza, TollPlazaAlias, TollPlazaStatus
from app.services.toll_plaza_matching import normalize_location

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PLAZA_SEED_PATH = DATA_DIR / "toll_plaza_coords_seed.json"
MATRIX_SEED_PATH = DATA_DIR / "nlex_sctex_class3_sample.json"

# Back-compat alias used by older imports / smoke tests.
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
        logger.info("Toll plaza seed applied: touched=%s", touched)
    return touched


def ensure_toll_matrix_sample_seeded(db: Session) -> int:
    """Insert missing Class 3 matrix sample rows (idempotent by entry/exit/class/date)."""
    if not MATRIX_SEED_PATH.is_file():
        logger.warning("Toll matrix sample seed missing: %s", MATRIX_SEED_PATH)
        return 0
    try:
        rows = json.loads(MATRIX_SEED_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.exception("Failed reading toll matrix sample seed")
        return 0
    if not isinstance(rows, list):
        return 0

    existing_rows = (
        db.query(TollMatrix)
        .filter(TollMatrix.status == TollMatrixStatus.ACTIVE.value)
        .all()
    )
    existing_keys = {
        (
            normalize_location(r.entry_point),
            normalize_location(r.exit_point),
            (r.vehicle_class or "Class 3").strip(),
        )
        for r in existing_rows
    }
    plaza_names = {
        p.canonical_name.strip()
        for p in db.query(TollPlaza).all()
        if p.canonical_name and p.canonical_name.strip()
    }

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

        for pname in (entry, exit_):
            if pname not in plaza_names:
                db.add(
                    TollPlaza(
                        canonical_name=pname,
                        status=TollPlazaStatus.ACTIVE.value,
                    )
                )
                plaza_names.add(pname)
                db.flush()

        key = (normalize_location(entry), normalize_location(exit_), vc)
        if key in existing_keys:
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
        existing_keys.add(key)
        inserted += 1

    if inserted:
        db.commit()
        logger.info("Toll matrix sample seed applied: inserted=%s", inserted)
    return inserted


def ensure_toll_reference_data(db: Session) -> dict[str, int]:
    plazas = ensure_toll_plaza_coords_seeded(db)
    matrix = ensure_toll_matrix_sample_seeded(db)
    return {"plazas_touched": plazas, "matrix_inserted": matrix}
