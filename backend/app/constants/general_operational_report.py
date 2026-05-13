"""Driver general operational form — stored as stable category / status slugs."""

GENERAL_OPS_CATEGORY_VALUES: frozenset[str] = frozenset(
    {
        "trip_completion",
        "delay_report",
        "vehicle_concern",
        "delivery_issue",
        "fuel_log",
        "incident_report",
        "general_operational_update",
    }
)

GENERAL_OPS_CATEGORY_LABELS: dict[str, str] = {
    "trip_completion": "Trip completion",
    "delay_report": "Delay report",
    "vehicle_concern": "Vehicle concern",
    "delivery_issue": "Delivery issue",
    "fuel_log": "Fuel log",
    "incident_report": "Incident report",
    "general_operational_update": "General operational update",
}

GENERAL_OPS_TRIP_STATUS_VALUES: frozenset[str] = frozenset(
    {
        "assigned",
        "for_pickup",
        "picked_up",
        "en_route",
        "dropped_off",
        "completed",
    }
)

GENERAL_OPS_TRIP_STATUS_LABELS: dict[str, str] = {
    "assigned": "Assigned",
    "for_pickup": "For pickup",
    "picked_up": "Picked up",
    "en_route": "En route",
    "dropped_off": "Dropped off",
    "completed": "Completed",
}
