/** Canonical customer payment URL for an existing API booking id. */
export function customerBookingPaymentPath(bookingId: number | string): string {
  const id = String(bookingId).trim();
  return `/booking/payment?bookingId=${encodeURIComponent(id)}`;
}

/** True when id is a positive integer booking id from the API. */
export function isApiBookingId(value: unknown): value is number {
  if (typeof value === "number") return Number.isInteger(value) && value > 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) && Number.parseInt(trimmed, 10) > 0;
  }
  return false;
}
