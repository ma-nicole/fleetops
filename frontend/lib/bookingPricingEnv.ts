/** Browser fallback: admin only edits diesel + toll in DB; these env vars mimic that when offline. */

function num(raw: string | undefined, fallback: number): number {
  if (raw === undefined || String(raw).trim() === "") return fallback;
  const v = Number.parseFloat(String(raw));
  return Number.isFinite(v) ? v : fallback;
}

export type BookingPricingKnobs = {
  dieselPricePhpPerLiter: number;
  tollFeesPhpPerTrip: number;
};

/** Defaults align with backend `Settings` seed for `booking_freight_settings`. */
export function bookingPricingKnobs(): BookingPricingKnobs {
  return {
    dieselPricePhpPerLiter: num(process.env.NEXT_PUBLIC_DIESEL_PRICE_PHP_PER_LITER, 74.75),
    tollFeesPhpPerTrip: num(process.env.NEXT_PUBLIC_TOLL_FEES_PHP_PER_TRIP, 0),
  };
}
