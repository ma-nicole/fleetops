export const SHOULDER_COST_CATEGORIES = [
  { value: "toll", label: "Toll" },
  { value: "fuel", label: "Fuel" },
  { value: "parking", label: "Parking" },
  { value: "allowance", label: "Allowance" },
  { value: "other", label: "Other" },
] as const;

export type ShoulderCostCategory = (typeof SHOULDER_COST_CATEGORIES)[number]["value"];

export type TripSystemCosts = {
  fuel_cost: number;
  toll_cost: number;
  labor_cost: number;
  maintenance_cost: number;
  driver_allowance_php: number;
  helper_allowance_php: number;
  crew_allowance_total_php: number;
  predicted_total_cost: number;
  system_total_cost: number;
};

export type ShoulderCostEntry = {
  id: number;
  trip_id: number;
  booking_id: number;
  dispatcher_id: number;
  category: string;
  category_label: string;
  amount_php: number;
  notes: string | null;
  recorded_at: string | null;
};

export type TripCostLedgerRow = {
  trip_id: number;
  booking_id: number;
  trip_status: string;
  pickup_location: string;
  dropoff_location: string;
  driver_name: string | null;
  truck_code: string | null;
  system_costs: TripSystemCosts;
  shoulder_totals: Record<string, number>;
  shoulder_grand_total: number;
  entries: ShoulderCostEntry[];
};

export type TripCostLedgerResponse = {
  summary: {
    by_category: Record<string, number>;
    shoulder_grand_total: number;
    trip_count: number;
  };
  trips: TripCostLedgerRow[];
};

export function shoulderCategoryLabel(category: string): string {
  return SHOULDER_COST_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}
