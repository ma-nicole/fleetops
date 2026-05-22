/** Booking cargo weight limits — must match `backend/app/constants/fleet_capacity.py`. */
import { TRUCK_MAX_LOAD_TONS } from "./customerPricingConstants";

export const FLEET_TRUCK_COUNT = 4;
export const MAX_BOOKING_WEIGHT_TONS = FLEET_TRUCK_COUNT * TRUCK_MAX_LOAD_TONS;
export const MIN_BOOKING_WEIGHT_TONS = 0.1;

/** Common preset loads (≤ fleet maximum). Full truck = 42 t. */
export const SUGGESTED_BOOKING_WEIGHTS_TONS = [1, 5, 10, 15, 20, 30, 42, 84, 126, 168] as const;

export const CUSTOM_WEIGHT_SELECT_VALUE = "custom";

export function formatBookingWeightTons(tons: number): string {
  const n = Number(tons);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export function isValidBookingWeightTons(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_BOOKING_WEIGHT_TONS && value <= MAX_BOOKING_WEIGHT_TONS;
}

export function bookingWeightValidationMessage(): string {
  return `Weight must be ${MIN_BOOKING_WEIGHT_TONS}–${MAX_BOOKING_WEIGHT_TONS} metric tons (fleet: four trucks × ${TRUCK_MAX_LOAD_TONS} t).`;
}

export function resolveWeightSelectValue(weightStr: string): string {
  const w = parseFloat(weightStr);
  if (
    Number.isFinite(w) &&
    (SUGGESTED_BOOKING_WEIGHTS_TONS as readonly number[]).some((opt) => Math.abs(opt - w) < 1e-6)
  ) {
    return formatBookingWeightTons(w);
  }
  return CUSTOM_WEIGHT_SELECT_VALUE;
}

export function trucksRequiredForWeight(cargoWeightTons: number): number {
  const w = Number(cargoWeightTons);
  if (!Number.isFinite(w) || w <= 0) return 1;
  return Math.min(FLEET_TRUCK_COUNT, Math.max(1, Math.ceil(w / TRUCK_MAX_LOAD_TONS)));
}
