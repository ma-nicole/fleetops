"""Taxonomy for driver vehicle issue reports (stored as stable slugs)."""

VEHICLE_ISSUE_TYPE_VALUES: frozenset[str] = frozenset(
    {
        "engine_problem",
        "tire_issue",
        "brake_issue",
        "battery_issue",
        "fuel_issue",
        "overheating",
        "body_damage",
        "other_vehicle_concern",
    }
)

VEHICLE_ISSUE_TYPE_LABELS: dict[str, str] = {
    "engine_problem": "Engine problem",
    "tire_issue": "Tire issue",
    "brake_issue": "Brake issue",
    "battery_issue": "Battery issue",
    "fuel_issue": "Fuel issue",
    "overheating": "Overheating",
    "body_damage": "Body damage",
    "other_vehicle_concern": "Other vehicle concern",
}

VEHICLE_ISSUE_PRIORITY_VALUES: frozenset[str] = frozenset({"low", "medium", "high", "critical"})
