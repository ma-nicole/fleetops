"""Allowed customer payment methods — keep in sync with frontend/lib/paymentMethodOptions.ts."""

ALLOWED_PAYMENT_METHODS = frozenset({"card", "gcash", "bank", "cash", "cod", "manual"})

# Methods that may be submitted without an uploaded proof file.
PROOF_OPTIONAL_METHODS = frozenset({"cod"})
