"""Admin toll plaza and alias management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import TollPlaza, TollPlazaAlias, TollPlazaStatus, User, UserRole
from app.schemas.toll_plaza import (
    TollPlazaAliasRead,
    TollPlazaCreate,
    TollPlazaOptionRead,
    TollPlazaRead,
    TollPlazaUpdate,
)
from app.services.toll_plaza_matching import list_plaza_options

router = APIRouter(prefix="/admin/toll-plazas", tags=["toll-plazas"])


def _to_read(plaza: TollPlaza) -> TollPlazaRead:
    aliases = (
        plaza.aliases
        if plaza.aliases is not None
        else []
    )
    return TollPlazaRead(
        id=plaza.id,
        canonical_name=plaza.canonical_name,
        status=plaza.status,
        aliases=[TollPlazaAliasRead.model_validate(a) for a in aliases],
        created_at=plaza.created_at,
        updated_at=plaza.updated_at,
    )


@router.get("", response_model=list[TollPlazaRead])
def list_toll_plazas(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    rows = db.query(TollPlaza).order_by(TollPlaza.canonical_name.asc()).all()
    return [_to_read(r) for r in rows]


@router.post("", response_model=TollPlazaRead)
def create_toll_plaza(
    payload: TollPlazaCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    status = payload.status.strip().lower()
    if status not in {TollPlazaStatus.ACTIVE.value, TollPlazaStatus.INACTIVE.value}:
        raise HTTPException(status_code=400, detail="Status must be active or inactive.")
    name = payload.canonical_name.strip()
    if db.query(TollPlaza).filter(TollPlaza.canonical_name == name).first():
        raise HTTPException(status_code=409, detail="A toll plaza with this name already exists.")
    plaza = TollPlaza(canonical_name=name, status=status)
    db.add(plaza)
    db.flush()
    for alias in payload.aliases:
        alias_text = alias.strip()
        if alias_text:
            db.add(TollPlazaAlias(plaza_id=plaza.id, alias=alias_text))
    db.commit()
    db.refresh(plaza)
    return _to_read(plaza)


@router.put("/{plaza_id}", response_model=TollPlazaRead)
def update_toll_plaza(
    plaza_id: int,
    payload: TollPlazaUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    plaza = db.query(TollPlaza).filter(TollPlaza.id == plaza_id).first()
    if not plaza:
        raise HTTPException(status_code=404, detail="Toll plaza not found.")
    data = payload.model_dump(exclude_unset=True)
    aliases = data.pop("aliases", None)
    if "status" in data and data["status"]:
        data["status"] = data["status"].strip().lower()
        if data["status"] not in {TollPlazaStatus.ACTIVE.value, TollPlazaStatus.INACTIVE.value}:
            raise HTTPException(status_code=400, detail="Status must be active or inactive.")
    if "canonical_name" in data and data["canonical_name"]:
        data["canonical_name"] = data["canonical_name"].strip()
        dup = (
            db.query(TollPlaza)
            .filter(TollPlaza.canonical_name == data["canonical_name"], TollPlaza.id != plaza_id)
            .first()
        )
        if dup:
            raise HTTPException(status_code=409, detail="Another plaza already uses this name.")
    for key, val in data.items():
        setattr(plaza, key, val)
    if aliases is not None:
        db.query(TollPlazaAlias).filter(TollPlazaAlias.plaza_id == plaza.id).delete()
        for alias in aliases:
            alias_text = alias.strip()
            if alias_text:
                db.add(TollPlazaAlias(plaza_id=plaza.id, alias=alias_text))
    db.commit()
    db.refresh(plaza)
    return _to_read(plaza)


@router.delete("/{plaza_id}")
def delete_toll_plaza(
    plaza_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    plaza = db.query(TollPlaza).filter(TollPlaza.id == plaza_id).first()
    if not plaza:
        raise HTTPException(status_code=404, detail="Toll plaza not found.")
    db.delete(plaza)
    db.commit()
    return {"ok": True}


public_router = APIRouter(prefix="/toll-plazas", tags=["toll-plazas"])


@public_router.get("/options", response_model=list[TollPlazaOptionRead])
def list_toll_plaza_options(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.MANAGER, UserRole.DISPATCHER)),
):
    return [TollPlazaOptionRead(name=n) for n in list_plaza_options(db)]
