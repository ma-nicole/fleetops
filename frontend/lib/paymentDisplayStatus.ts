import type { Payment } from "@/lib/workflowApi";
import { isXenditMethod } from "@/lib/paymentMethodOptions";

export function isXenditPayment(payment: Payment): boolean {
  return Boolean(payment.xendit_external_id) || isXenditMethod(payment.method);
}

export function isCashPayment(payment: Payment): boolean {
  return payment.method === "cash";
}

export function isManualPayment(payment: Payment): boolean {
  if (payment.verification_mode === "manual") return true;
  if (payment.verification_mode === "cash_offline") return false;
  return !isXenditPayment(payment) && payment.method !== "cash";
}

export function paymentDisplayStatus(payment: Payment): string {
  if (payment.display_status) return payment.display_status;
  switch (payment.status) {
    case "for_verification":
      if (isCashPayment(payment)) return "Awaiting Cash Payment";
      if (isXenditPayment(payment)) return "Payment Processing";
      return "Awaiting Payment Verification";
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
  if (isXenditPayment(payment) || isCashPayment(payment)) return false;
  return Boolean(payment.proof_original_filename) || payment.method === "cod";
}

export function canManuallyReject(payment: Payment): boolean {
  return canManuallyApprove(payment);
}

export function canMarkCashReceived(payment: Payment): boolean {
  return isCashPayment(payment) && payment.status === "for_verification";
}

export function transactionReference(payment: Payment): string {
  return (
    payment.xendit_payment_id ||
    payment.xendit_external_id ||
    payment.xendit_invoice_id ||
    payment.reference ||
    "—"
  );
}
