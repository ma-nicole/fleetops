/** Hybrid customer payment methods — keep in sync with backend/app/constants/payment_methods.py */

export type HybridPaymentMethod = "cash" | "gcash" | "card" | "bank";

export type PaymentChannel = "xendit" | "offline" | "manual";

export type PaymentMethodOption = {
  value: HybridPaymentMethod | "cod" | "manual";
  label: string;
  channel: PaymentChannel;
  requiresProof: boolean;
  description: string;
  xenditOnly?: boolean;
};

/** Primary hybrid options shown on the booking payment page. */
export const HYBRID_PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    value: "gcash",
    label: "GCash",
    channel: "xendit",
    requiresProof: false,
    xenditOnly: true,
    description: "Pay through Xendit hosted checkout or GCash QR. Verified automatically via webhook.",
  },
  {
    value: "card",
    label: "Credit / debit card",
    channel: "xendit",
    requiresProof: false,
    xenditOnly: true,
    description: "Pay with card on the secure Xendit checkout page. Verified automatically.",
  },
  {
    value: "bank",
    label: "Bank transfer",
    channel: "xendit",
    requiresProof: false,
    xenditOnly: true,
    description: "Transfer through Xendit hosted checkout. Verified automatically when Xendit confirms payment.",
  },
  {
    value: "cash",
    label: "Cash",
    channel: "offline",
    requiresProof: false,
    description: "Pay in cash to FleetOps staff. An admin will mark the payment as received — no proof upload required.",
  },
];

/** Legacy manual options when Xendit is disabled or for exceptional channels. */
export const LEGACY_MANUAL_METHODS: PaymentMethodOption[] = [
  {
    value: "bank",
    label: "Bank transfer (manual)",
    channel: "manual",
    requiresProof: true,
    description: "Transfer to the official FleetOps bank account and upload your deposit slip.",
  },
  {
    value: "manual",
    label: "Manual payment proof upload",
    channel: "manual",
    requiresProof: true,
    description: "Pay through another approved channel and upload proof for admin review.",
  },
  {
    value: "cod",
    label: "Cash on delivery",
    channel: "offline",
    requiresProof: false,
    description: "Pay the driver or crew in cash on delivery. Admin confirmation may still apply.",
  },
];

export type CustomerPaymentMethod = HybridPaymentMethod | "cod" | "manual";

export function isXenditMethod(method: string): boolean {
  return ["gcash", "card", "bank"].includes(method.toLowerCase());
}

export function paymentMethodRequiresProof(method: string, xenditEnabled = false): boolean {
  const key = method.toLowerCase().trim();
  if (xenditEnabled && isXenditMethod(key)) return false;
  const opt = [...HYBRID_PAYMENT_METHODS, ...LEGACY_MANUAL_METHODS].find((m) => m.value === key);
  return opt?.requiresProof ?? true;
}

export function formatPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  const key = method.toLowerCase().trim();
  const match = [...HYBRID_PAYMENT_METHODS, ...LEGACY_MANUAL_METHODS].find((m) => m.value === key);
  if (match) return match.label;
  return key.replace(/_/g, " ");
}

export function getPaymentMethodOption(method: string): PaymentMethodOption | undefined {
  return [...HYBRID_PAYMENT_METHODS, ...LEGACY_MANUAL_METHODS].find((m) => m.value === method.toLowerCase().trim());
}

/** Options shown on the booking payment page based on Xendit availability. */
export function getBookingPaymentOptions(xenditEnabled: boolean, gcashBlocked = false): PaymentMethodOption[] {
  if (xenditEnabled) {
    return HYBRID_PAYMENT_METHODS.filter((opt) => !(opt.value === "gcash" && gcashBlocked));
  }
  const cash = HYBRID_PAYMENT_METHODS.find((m) => m.value === "cash");
  return cash ? [...LEGACY_MANUAL_METHODS, cash] : LEGACY_MANUAL_METHODS;
}

/** @deprecated use HYBRID_PAYMENT_METHODS */
export const CUSTOMER_PAYMENT_METHODS = LEGACY_MANUAL_METHODS;
