"""Detect seed / placeholder bookings that must not block fleet capacity."""

from __future__ import annotations

from sqlalchemy import and_, or_
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

# seed_db.py route origins / destinations and legacy smoke-test placeholders.
_DEMO_PICKUP_EXACT = frozenset(
    {
        "Warehouse A",
        "Warehouse B",
        "Warehouse C",
        "Warehouse D",
        "Warehouse E",
        "Warehouse 1",
        "Warehouse-Tarlac",
        "Hub-Pampanga",
        "SMC-Plant-Bulacan",
        "Hub-Cabanatuan",
        "Hub-Baguio",
    }
)

_DEMO_DROPOFF_EXACT = frozenset(
    {
        "Warehouse 2",
        "Customer-QC",
        "Customer-Pasig",
        "Customer-Makati",
        "Customer-Caloocan",
        "Customer-Manila",
        "Hub-Manila-North",
    }
)


def is_demo_placeholder_booking(pickup_location: str | None, dropoff_location: str | None) -> bool:
    pu = (pickup_location or "").strip()
    do = (dropoff_location or "").strip()
    if not pu or not do:
        return False
    if pu in _DEMO_PICKUP_EXACT or do in _DEMO_DROPOFF_EXACT:
        return True
    if pu == "Warehouse 1" and do == "Warehouse 2":
        return True
    if pu.startswith("Warehouse ") and (do.startswith("City") or do.startswith("City-")):
        return True
    if pu.startswith("Warehouse-") and do.startswith("Customer-"):
        return True
    if pu.startswith("Hub-") and (do.startswith("Customer-") or do.startswith("Hub-")):
        return True
    if pu.startswith("SMC-Plant-") and do.startswith("Customer-"):
        return True
    return False


def demo_booking_sql_where(alias: str = "") -> str:
    """SQL boolean expression for demo bookings (MySQL), optional table alias e.g. 'b.'."""
    pu = f"{alias}pickup_location"
    do = f"{alias}dropoff_location"
    exact_pu = ", ".join(f"'{x}'" for x in sorted(_DEMO_PICKUP_EXACT))
    exact_do = ", ".join(f"'{x}'" for x in sorted(_DEMO_DROPOFF_EXACT))
    return f"""(
        ({pu} LIKE 'Warehouse %%' AND {do} LIKE 'City%%')
        OR ({pu} = 'Warehouse 1' AND {do} = 'Warehouse 2')
        OR {pu} IN ({exact_pu})
        OR {do} IN ({exact_do})
        OR ({pu} LIKE 'Warehouse-%%' AND {do} LIKE 'Customer-%%')
        OR ({pu} LIKE 'Hub-%%' AND ({do} LIKE 'Customer-%%' OR {do} LIKE 'Hub-%%'))
        OR ({pu} LIKE 'SMC-Plant-%%' AND {do} LIKE 'Customer-%%')
    )"""


def demo_booking_orm_filter(
    pickup_col: InstrumentedAttribute,
    dropoff_col: InstrumentedAttribute,
) -> ColumnElement:
    pu = pickup_col
    do = dropoff_col
    return or_(
        and_(pu.like("Warehouse %"), do.like("City%")),
        and_(pu == "Warehouse 1", do == "Warehouse 2"),
        pu.in_(tuple(_DEMO_PICKUP_EXACT)),
        do.in_(tuple(_DEMO_DROPOFF_EXACT)),
        and_(pu.like("Warehouse-%"), do.like("Customer-%")),
        and_(pu.like("Hub-%"), or_(do.like("Customer-%"), do.like("Hub-%"))),
        and_(pu.like("SMC-Plant-%"), do.like("Customer-%")),
    )
