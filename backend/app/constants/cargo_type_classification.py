"""Cargo type categories and restricted-item screening rules (warning only — no auto-rejection)."""

from app.models.entities import CargoTypeCategory

CARGO_TYPE_CATEGORY_LABELS: dict[str, str] = {
    CargoTypeCategory.GENERAL.value: "General cargo",
    CargoTypeCategory.ELECTRONICS.value: "Electronics & appliances",
    CargoTypeCategory.FURNITURE.value: "Furniture & fixtures",
    CargoTypeCategory.FOOD_PERISHABLE.value: "Food — perishable",
    CargoTypeCategory.FOOD_NON_PERISHABLE.value: "Food — non-perishable",
    CargoTypeCategory.CONSTRUCTION.value: "Construction materials",
    CargoTypeCategory.AUTOMOTIVE.value: "Automotive parts",
    CargoTypeCategory.TEXTILES.value: "Textiles & garments",
    CargoTypeCategory.PHARMACEUTICALS.value: "Pharmaceuticals & medical supplies",
    CargoTypeCategory.CHEMICALS_HAZMAT.value: "Chemicals / hazmat",
    CargoTypeCategory.FLAMMABLE.value: "Flammable materials",
    CargoTypeCategory.WEAPONS.value: "Weapons & ammunition",
    CargoTypeCategory.LIVE_ANIMALS.value: "Live animals",
    CargoTypeCategory.CONTROLLED_SUBSTANCES.value: "Controlled substances",
    CargoTypeCategory.OTHER.value: "Other / mixed",
}

RESTRICTED_CARGO_TYPE_CATEGORIES = frozenset(
    {
        CargoTypeCategory.CHEMICALS_HAZMAT.value,
        CargoTypeCategory.FLAMMABLE.value,
        CargoTypeCategory.WEAPONS.value,
        CargoTypeCategory.LIVE_ANIMALS.value,
        CargoTypeCategory.CONTROLLED_SUBSTANCES.value,
    }
)

GLOBAL_RESTRICTED_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("weapon", "Possible weapons reference"),
    ("gun", "Possible firearms reference"),
    ("firearm", "Possible firearms reference"),
    ("ammunition", "Possible ammunition reference"),
    ("ammo", "Possible ammunition reference"),
    ("bullet", "Possible ammunition reference"),
    ("explosive", "Possible explosives reference"),
    ("bomb", "Possible explosives reference"),
    ("dynamite", "Possible explosives reference"),
    ("firework", "Possible pyrotechnics / flammable cargo"),
    ("narcotic", "Possible controlled substances reference"),
    ("cocaine", "Possible controlled substances reference"),
    ("heroin", "Possible controlled substances reference"),
    ("marijuana", "Possible controlled substances reference"),
    ("cannabis", "Possible controlled substances reference"),
    ("shabu", "Possible controlled substances reference"),
    ("methamphetamine", "Possible controlled substances reference"),
    ("contraband", "Possible contraband reference"),
    ("smuggle", "Possible contraband reference"),
    ("ivory", "Possible restricted wildlife product"),
    ("cyanide", "Possible toxic / hazmat cargo"),
    ("asbestos", "Possible hazmat cargo"),
    ("radioactive", "Possible radioactive cargo"),
)

CATEGORY_KEYWORD_HINTS: dict[str, tuple[tuple[str, str], ...]] = {
    CargoTypeCategory.CHEMICALS_HAZMAT.value: (
        ("acid", "Chemical / hazmat keyword in description"),
        ("solvent", "Chemical / hazmat keyword in description"),
        ("pesticide", "Chemical / hazmat keyword in description"),
        ("chlorine", "Chemical / hazmat keyword in description"),
    ),
    CargoTypeCategory.FLAMMABLE.value: (
        ("gasoline", "Flammable material keyword in description"),
        ("lpg", "Flammable material keyword in description"),
        ("propane", "Flammable material keyword in description"),
        ("fuel", "Flammable material keyword in description"),
    ),
    CargoTypeCategory.WEAPONS.value: (
        ("rifle", "Weapons-related keyword in description"),
        ("pistol", "Weapons-related keyword in description"),
    ),
    CargoTypeCategory.CONTROLLED_SUBSTANCES.value: (
        ("tablet", "Pharmaceutical / controlled keyword — verify permits"),
        ("medicine", "Pharmaceutical keyword — verify permits"),
    ),
}
