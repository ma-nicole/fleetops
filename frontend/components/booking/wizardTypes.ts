import type { CustomerSite } from "@/lib/customerSites";

export type QuotedCostBreakdown = {
  cargo_gross_php: number;
  toll_fees_php: number;
  labor_freight_php: number;
  quoted_total_php: number;
};

export type TruckLoadApiLine = {
  truck_index: number;
  weight_tons: number;
  distance_km: number;
  cargo_gross_php: number;
  diesel_liters: number;
  diesel_cost_php: number;
  driver_share_php: number;
  helper_share_php: number;
  toll_fees_php: number;
  additives_total_php: number;
  net_profit_php: number;
};

export type LiveCostQuote = {
  distance_km: number;
  total_trucks: number;
  cargo_gross_php: number;
  diesel_cost_php: number;
  driver_share_php: number;
  helper_share_php: number;
  toll_fees_php: number;
  additives_total_php: number;
  net_profit_total_php: number;
  quoted_total: number;
  truck_loads: TruckLoadApiLine[];
};

export type FormErrors = Record<string, string>;

export type RouteQuoteApiResponse = {
  distance_km: number;
  weight_tons: number;
  total_trucks: number;
  cargo_rate_php_per_ton: number;
  cargo_gross_php: number;
  diesel_liters: number;
  diesel_cost_php: number;
  driver_share_php: number;
  helper_share_php: number;
  toll_fees_php: number;
  additives_total_php: number;
  net_profit_total_php: number;
  quoted_total: number;
  diesel_price_per_liter: number;
  driver_freight_share_pct: number;
  helper_freight_share_pct: number;
  truck_loads: TruckLoadApiLine[];
  pickup_resolution: string;
  dropoff_resolution: string;
  pricing_tier: string;
  routing_method: string;
  toll_matrix_matched?: boolean;
  toll_estimate_message?: string | null;
  toll_entry_point?: string | null;
  toll_exit_point?: string | null;
  toll_effective_date?: string | null;
  estimated_toll_budget_per_truck?: number | null;
  estimated_toll_budget_total?: number | null;
  toll_plaza_options?: string[];
  suggested_toll_entry_point?: string | null;
  suggested_toll_exit_point?: string | null;
  distance_confirmed?: boolean;
  distance_warning?: string | null;
  quote_status?: string | null;
};

export type FreightLineDetail = {
  booking_weight_tons: number;
  total_trucks: number;
  cargo_rate_php_per_ton: number;
  diesel_liters: number;
  diesel_cost_php: number;
  driver_share_php: number;
  helper_share_php: number;
  toll_fees_php: number;
  additives_total_php: number;
  diesel_price_per_liter: number;
  driver_freight_share_pct: number;
  helper_freight_share_pct: number;
  truck_loads: TruckLoadApiLine[];
};

export type QuoteGeoMeta = Pick<
  RouteQuoteApiResponse,
  "pickup_resolution" | "dropoff_resolution" | "pricing_tier" | "routing_method"
>;

export type TollEstimateMeta = {
  matched: boolean;
  message: string | null;
  entryPoint: string | null;
  exitPoint: string | null;
  effectiveDate: string | null;
  budgetPerTruck: number | null;
  budgetTotal: number | null;
  plazaOptions: string[];
  suggestedEntry: string | null;
  suggestedExit: string | null;
};

export type BookingWizardStep = "route" | "shipment" | "documents" | "review";

export const BOOKING_WIZARD_STEPS: { id: BookingWizardStep; label: string }[] = [
  { id: "route", label: "Route" },
  { id: "shipment", label: "Shipment" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" },
];

export type BookingFormState = {
  pickupId: string;
  dropoffId: string;
  sites: CustomerSite[];
  pickup: string;
  dropoff: string;
  weight: string;
  date: string;
  pickedSlot: string;
  cargoDeclaration: File | null;
  termsAgreement: File | null;
  termsAccepted: boolean;
  manualTollEntry: string;
  manualTollExit: string;
  manualVehicleClass: string;
  manualDistanceKm: string;
};
