"""Allowed customer payment methods — keep in sync with frontend/lib/paymentMethodOptions.ts."""

ALLOWED_PAYMENT_METHODS = frozenset({"card", "gcash", "bank", "cash", "cod", "manual"})

# Xendit-hosted checkout (webhook auto-verification).
XENDIT_ONLINE_METHODS = frozenset({"gcash", "card", "bank"})

# Offline / staff-confirmed payments.
CASH_OFFLINE_METHODS = frozenset({"cash", "cod"})

# Methods that may be submitted without an uploaded proof file.
PROOF_OPTIONAL_METHODS = frozenset({"cod", "cash"})

# Legacy manual proof upload (when Xendit is disabled or for exceptional channels).
MANUAL_PROOF_METHODS = frozenset({"manual"})
