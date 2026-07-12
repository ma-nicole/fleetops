from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import Booking, Trip, User, UserRole


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/bookings")
def bookings_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.DISPATCHER)),
):
    bookings = db.query(Booking).all()
    rows = [
        {
            "booking_id": item.id,
            "customer_id": item.customer_id,
            "pickup": item.pickup_location,
            "dropoff": item.dropoff_location,
            "status": item.status.value,
            "estimated_cost": float(item.estimated_cost) if item.estimated_cost is not None else None,
        }
        for item in bookings
    ]
    return {
        "report_name": "Booking Reports",
        "module_name": "Admin Reports",
        "columns": [
            {"key": "booking_id", "label": "Booking ID"},
            {"key": "customer_id", "label": "Customer ID"},
            {"key": "pickup", "label": "Pickup"},
            {"key": "dropoff", "label": "Dropoff"},
            {"key": "status", "label": "Status"},
            {"key": "estimated_cost", "label": "Estimated cost (PHP)"},
        ],
        "rows": rows,
        "record_count": len(rows),
    }


@router.get("/fleet")
def fleet_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    trips = db.query(Trip).all()
    rows = [
        {
            "trip_id": item.id,
            "truck_id": item.truck_id,
            "driver_id": item.driver_id,
            "distance_km": float(item.distance_km) if item.distance_km is not None else None,
            "total_cost": float(item.fuel_cost + item.toll_cost + item.labor_cost),
        }
        for item in trips
    ]
    return {
        "report_name": "Fleet Reports",
        "module_name": "Fleet Reports",
        "columns": [
            {"key": "trip_id", "label": "Trip ID"},
            {"key": "truck_id", "label": "Truck ID"},
            {"key": "driver_id", "label": "Driver ID"},
            {"key": "distance_km", "label": "Distance (km)"},
            {"key": "total_cost", "label": "Total cost (PHP)"},
        ],
        "rows": rows,
        "record_count": len(rows),
    }
