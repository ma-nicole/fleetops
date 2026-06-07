"""Admin Toll Matrix CRUD — NLEX-SCTEX descriptive entry/exit plaza rates."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import TollMatrix, TollMatrixStatus, User, UserRole
from app.schemas.toll_matrix import TollMatrixCreate, TollMatrixRead, TollMatrixUpdate
from app.services.toll_matrix import lookup_toll_matrix, matrix_toll_fee

router = APIRouter(prefix="/admin/toll-matrix", tags=["toll-matrix"])


def _to_read(row: TollMatrix) -> TollMatrixRead:
    return TollMatrixRead(
        id=row.id,
        entry_point=row.entry_point,
        exit_point=row.exit_point,
        vehicle_class=row.vehicle_class,
        toll_fee=matrix_toll_fee(row),
        effective_date=row.effective_date,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _duplicate_exists(db: Session, entry: str, exit_: str, vehicle_class: str, effective_date, exclude_id: int | None = None) -> bool:
    q = db.query(TollMatrix).filter(
        TollMatrix.entry_point == entry.strip(),
        TollMatrix.exit_point == exit_.strip(),
        TollMatrix.vehicle_class == vehicle_class.strip(),
        TollMatrix.effective_date == effective_date,
    )
    if exclude_id is not None:
        q = q.filter(TollMatrix.id != exclude_id)
    return q.first() is not None


@router.get("", response_model=list[TollMatrixRead])
def list_toll_matrix(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    status: str | None = Query(default=None),
):
    q = db.query(TollMatrix).order_by(
        TollMatrix.entry_point.asc(),
        TollMatrix.exit_point.asc(),
        TollMatrix.effective_date.desc(),
    )
    if status:
        q = q.filter(TollMatrix.status == status.strip().lower())
    return [_to_read(r) for r in q.all()]


@router.post("", response_model=TollMatrixRead)
def create_toll_matrix_row(
    payload: TollMatrixCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    status = payload.status.strip().lower()
    if status not in {TollMatrixStatus.ACTIVE.value, TollMatrixStatus.INACTIVE.value}:
        raise HTTPException(status_code=400, detail="Status must be active or inactive.")
    if _duplicate_exists(db, payload.entry_point, payload.exit_point, payload.vehicle_class, payload.effective_date):
        raise HTTPException(
            status_code=409,
            detail="A toll matrix row already exists for this entry, exit, vehicle class, and effective date.",
        )
    row = TollMatrix(
        entry_point=payload.entry_point.strip(),
        exit_point=payload.exit_point.strip(),
        vehicle_class=payload.vehicle_class.strip(),
        toll_fee=payload.toll_fee,
        effective_date=payload.effective_date,
        status=status,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


@router.put("/{row_id}", response_model=TollMatrixRead)
def update_toll_matrix_row(
    row_id: int,
    payload: TollMatrixUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    row = db.query(TollMatrix).filter(TollMatrix.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Toll matrix row not found.")
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"]:
        data["status"] = data["status"].strip().lower()
        if data["status"] not in {TollMatrixStatus.ACTIVE.value, TollMatrixStatus.INACTIVE.value}:
            raise HTTPException(status_code=400, detail="Status must be active or inactive.")
    for key, val in data.items():
        if isinstance(val, str):
            val = val.strip()
        setattr(row, key, val)
    if _duplicate_exists(
        db,
        row.entry_point,
        row.exit_point,
        row.vehicle_class,
        row.effective_date,
        exclude_id=row.id,
    ):
        raise HTTPException(
            status_code=409,
            detail="Another row already exists for this entry, exit, vehicle class, and effective date.",
        )
    db.commit()
    db.refresh(row)
    return _to_read(row)


@router.delete("/{row_id}")
def delete_toll_matrix_row(
    row_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    row = db.query(TollMatrix).filter(TollMatrix.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Toll matrix row not found.")
    db.delete(row)
    db.commit()
    return {"ok": True}
