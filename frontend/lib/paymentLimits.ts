/** GCash per-transaction limit — must match backend/app/constants/payment_limits.py */

export const GCASH_MAX_TRANSACTION_PHP = 100_000;

export function gcashAmountExceedsLimit(amount: number): boolean {
  return amount > GCASH_MAX_TRANSACTION_PHP;
}

export function gcashAllowedForAmount(amount: number): boolean {
  return !gcashAmountExceedsLimit(amount);
}
