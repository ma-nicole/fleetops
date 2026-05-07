/** Browser fallback pricing — keep in sync with backend `Settings` / `customer_freight_pricing`. */

function num(raw: string | undefined, fallback: number): number {
  if (raw === undefined || String(raw).trim() === "") return fallback;
  const v = Number.parseFloat(String(raw));
  return Number.isFinite(v) ? v : fallback;
}

export type BookingPricingKnobs = {
  dieselPricePhpPerLiter: number;
  truckKmPerLiter: number;
  tripWearPhpPerKm: number;
  tripDepreciationRate: number;
  helperPhpPerTrip: number;
  driverCommissionRate: number;
  cargoWeightMultiplierPerTon: number;
};

/** Defaults match `backend/app/core/config.py`. */
export function bookingPricingKnobs(): BookingPricingKnobs {
  return {
    dieselPricePhpPerLiter: num(process.env.NEXT_PUBLIC_DIESEL_PRICE_PHP_PER_LITER, 74.75),
    truckKmPerLiter: num(process.env.NEXT_PUBLIC_TRUCK_FUEL_KMPL, 4.5),
    tripWearPhpPerKm: num(process.env.NEXT_PUBLIC_TRIP_WEAR_PHP_PER_KM, 3.75),
    tripDepreciationRate: num(process.env.NEXT_PUBLIC_TRIP_DEPRECIATION_RATE, 0.1),
    helperPhpPerTrip: num(process.env.NEXT_PUBLIC_HELPER_PAY_PHP_PER_TRIP, 220),
    driverCommissionRate: num(process.env.NEXT_PUBLIC_DRIVER_FREIGHT_COMMISSION_RATE, 0.15),
    cargoWeightMultiplierPerTon: num(process.env.NEXT_PUBLIC_CARGO_WEIGHT_MULT_PER_TON, 0.07),
  };
}
