export const XENDIT_GCASH_PAYMENT_STEPS = [
  "Click Pay Now to open Xendit checkout, or scan the GCash QR code below.",
  "Choose GCash or another supported Xendit payment method.",
  "Confirm the exact amount and complete payment.",
  "This page updates automatically when payment is received; no screenshot upload is needed.",
] as const;

/** Attempt to open the GCash app (mobile). Falls back silently on desktop. */
export function openGcashApp(): void {
  if (typeof window === "undefined") return;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) {
    window.alert("Open the GCash app on your phone, then tap Scan to pay the QR code shown on this page.");
    return;
  }
  window.location.href = "gcash://";
  window.setTimeout(() => {
    window.alert("If GCash did not open, launch the app manually and use Scan to pay.");
  }, 1200);
}

export function formatXenditStatusLabel(status: string | null | undefined): string {
  switch ((status || "").toUpperCase()) {
    case "PENDING":
      return "Pending payment";
    case "PAID":
      return "Paid";
    case "EXPIRED":
      return "Expired";
    case "FAILED":
      return "Payment failed";
    default:
      return status ? status : "Pending payment";
  }
}

export function formatPaymentExpiry(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
