from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import Truck, User, UserRole


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    users = db.query(User).all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        }
        for user in users
    ]


@router.post("/trucks")
def add_truck(
    code: str,
    capacity_tons: float,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    truck = Truck(code=code, capacity_tons=capacity_tons)
    db.add(truck)
    db.commit()
    db.refresh(truck)
    return truck


@router.delete("/trucks/{truck_id}")
def remove_truck(
    truck_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
):
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")

    db.delete(truck)
    db.commit()
    return {"deleted": True}
