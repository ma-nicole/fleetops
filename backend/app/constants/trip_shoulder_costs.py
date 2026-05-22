"""Shoulder cost categories for dispatcher trip expense ledger."""

from app.models.entities import TripShoulderCostCategory

SHOULDER_COST_CATEGORY_LABELS: dict[str, str] = {
    TripShoulderCostCategory.TOLL.value: "Toll",
    TripShoulderCostCategory.FUEL.value: "Fuel",
    TripShoulderCostCategory.PARKING.value: "Parking",
    TripShoulderCostCategory.ALLOWANCE.value: "Allowance",
    TripShoulderCostCategory.OTHER.value: "Other",
}

SHOULDER_COST_CATEGORIES = frozenset(SHOULDER_COST_CATEGORY_LABELS.keys())
