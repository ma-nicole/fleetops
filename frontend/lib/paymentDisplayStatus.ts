import type { Payment } from "@/lib/workflowApi";

export function isXenditPayment(payment: Payment): boolean {
  return Boolean(payment.xendit_external_id);
}

export function isManualPayment(payment: Payment): boolean {
  return payment.verification_mode === "manual" || (!payment.verification_mode && !isXenditPayment(payment));
}

export function paymentDisplayStatus(payment: Payment): string {
  if (payment.display_status) return payment.display_status;
  switch (payment.status) {
    case "for_verification":
      return isXenditPayment(payment) ? "Payment Processing" : "Awaiting Payment Verification";
    case "verified":
      return "Payment Verified";
    case "rejected":
      return payment.xendit_status === "EXPIRED" ? "Payment Expired" : "Payment Rejected";
    case "refunded":
      return "Refunded";
    default:
      return payment.status;
  }
}

export function canManuallyApprove(payment: Payment): boolean {
  if (payment.status !== "for_verification") return false;
  if (!isManualPayment(payment)) return false;
  return Boolean(payment.proof_original_filename) || payment.method === "cod";
}

export function canManuallyReject(payment: Payment): boolean {
  return canManuallyApprove(payment);
}
