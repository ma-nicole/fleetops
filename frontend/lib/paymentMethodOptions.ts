/** Customer payment methods — keep in sync with backend/app/constants/payment_methods.py */

export type CustomerPaymentMethod = "gcash" | "bank" | "cod" | "manual";

export type PaymentMethodOption = {
  value: CustomerPaymentMethod;
  label: string;
  requiresProof: boolean;
  description: string;
};

export const CUSTOMER_PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    value: "gcash",
    label: "GCash",
    requiresProof: true,
    description: "Scan the FleetOps GCash QR, pay, then upload your transaction receipt for admin verification.",
  },
  {
    value: "bank",
    label: "Bank transfer",
    requiresProof: true,
    description: "Transfer to the official FleetOps bank account and upload your deposit slip.",
  },
  {
    value: "manual",
    label: "Manual payment proof upload",
    requiresProof: true,
    description: "Pay through another approved channel (cheque, over-the-counter, etc.) and upload proof.",
  },
  {
    value: "cod",
    label: "Cash on delivery / payment",
    requiresProof: false,
    description: "Pay the driver or crew in cash when your shipment is delivered. No upfront proof required.",
  },
];

export function paymentMethodRequiresProof(method: string): boolean {
  return CUSTOMER_PAYMENT_METHODS.find((m) => m.value === method)?.requiresProof ?? true;
}

export function formatPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  const key = method.toLowerCase().trim();
  const match = CUSTOMER_PAYMENT_METHODS.find((m) => m.value === key);
  if (match) return match.label;
  switch (key) {
    case "card":
      return "Credit / debit card";
    case "cash":
      return "Cash";
    default:
      return key.replace(/_/g, " ");
  }
}

export function getPaymentMethodOption(method: string): PaymentMethodOption | undefined {
  return CUSTOMER_PAYMENT_METHODS.find((m) => m.value === method.toLowerCase().trim());
}
