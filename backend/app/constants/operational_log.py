"""Dispatcher operational log: allowed report types and display labels."""

from __future__ import annotations

REPORT_TYPE_LABELS: dict[str, str] = {
    "route_change": "Route Change",
    "delivery_delay": "Delivery Delay",
    "maintenance_concern": "Maintenance Concern",
    "extra_cost": "Extra Cost",
    "fuel_toll_issue": "Fuel/Toll Issue",
    "driver_helper_concern": "Driver/Helper Concern",
    "customer_coordination_issue": "Customer Coordination Issue",
    "loading_unloading_issue": "Loading/Unloading Issue",
    "other_incident": "Other Incident",
}

REPORT_TYPE_VALUES = frozenset(REPORT_TYPE_LABELS.keys())

PRIORITY_VALUES = frozenset({"low", "medium", "high", "critical"})
