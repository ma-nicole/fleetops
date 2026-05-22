import { apiFullUrl } from "./api";

/** GCash merchant QR served by GET /api/payments/gcash-qr */
export function gcashQrImageUrl(): string {
  return apiFullUrl("/payments/gcash-qr");
}

export const GCASH_PAYMENT_STEPS = [
  "Scan the official FleetOps GCash QR code below.",
  "Pay the exact amount shown and include your booking number in the note if possible.",
  "Upload your GCash receipt or screenshot, then wait for admin verification.",
] as const;
