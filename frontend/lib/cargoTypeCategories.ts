export const CARGO_TYPE_CATEGORIES = [
  { value: "general", label: "General cargo", restricted: false },
  { value: "electronics", label: "Electronics & appliances", restricted: false },
  { value: "furniture", label: "Furniture & fixtures", restricted: false },
  { value: "food_perishable", label: "Food — perishable", restricted: false },
  { value: "food_non_perishable", label: "Food — non-perishable", restricted: false },
  { value: "construction", label: "Construction materials", restricted: false },
  { value: "automotive", label: "Automotive parts", restricted: false },
  { value: "textiles", label: "Textiles & garments", restricted: false },
  { value: "pharmaceuticals", label: "Pharmaceuticals & medical supplies", restricted: false },
  { value: "chemicals_hazmat", label: "Chemicals / hazmat", restricted: true },
  { value: "flammable", label: "Flammable materials", restricted: true },
  { value: "weapons", label: "Weapons & ammunition", restricted: true },
  { value: "live_animals", label: "Live animals", restricted: true },
  { value: "controlled_substances", label: "Controlled substances", restricted: true },
  { value: "other", label: "Other / mixed", restricted: false },
] as const;

export type CargoTypeCategory = (typeof CARGO_TYPE_CATEGORIES)[number]["value"];

export function cargoTypeCategoryLabel(category: string | null | undefined): string {
  if (!category) return "Not classified";
  return CARGO_TYPE_CATEGORIES.find((c) => c.value === category)?.label ?? category.replace(/_/g, " ");
}

export function isRestrictedCargoCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return CARGO_TYPE_CATEGORIES.some((c) => c.value === category && c.restricted);
}

export type CargoTypeScreening = {
  restricted_flag: boolean;
  reasons: string[];
  category_label: string;
};

export type CargoTypeValidationAdminRow = {
  booking_id: number;
  customer_id: number;
  status: string;
  pickup_location: string;
  dropoff_location: string;
  cargo_description: string | null;
  cargo_weight_tons: number;
  cargo_type_category: string | null;
  cargo_type_category_label: string;
  cargo_type_validated: boolean;
  cargo_type_admin_notes: string | null;
  cargo_restricted_flag: boolean;
  cargo_restricted_reasons: string[];
  cargo_type_validated_at: string | null;
  cargo_type_validated_by_id: number | null;
};
