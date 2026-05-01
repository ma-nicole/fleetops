import { DEFAULT_DIAL_CODE, DIAL_CODE_OPTIONS } from "@/lib/dialCodes";

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Matches backend customer self-registration (min 3). */
export function validateFullName(value: string): string | undefined {
  const t = value.trim();
  if (!t) return "Full name is required.";
  if (t.length < 3) return "Full name must be at least 3 characters.";
  return undefined;
}

/** Display name / admin — still require something sensible. */
export function validatePersonNameLoose(value: string): string | undefined {
  const t = value.trim();
  if (!t) return "Full name is required.";
  if (t.length < 2) return "Full name must be at least 2 characters.";
  return undefined;
}

/** Backend `/auth/register` requires ≥ 8. */
export function validateCustomerPassword(value: string): string | undefined {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  return undefined;
}

/** Backend admin create user: 6–72. */
export function validateAdminInitialPassword(value: string): string | undefined {
  if (!value) return "Password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  if (value.length > 72) return "Password must be at most 72 characters.";
  return undefined;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function buildInternationalPhone(dialCode: string, nationalDigits: string): string {
  const cc = digitsOnly(dialCode);
  const n = digitsOnly(nationalDigits);
  if (!n) return "";
  return `+${cc}${n}`;
}

/** Empty national digits → valid (optional phone). Otherwise E.164-style total length 10–15. */
export function validateOptionalInternationalPhone(dialCode: string, nationalNumber: string): string | undefined {
  const n = digitsOnly(nationalNumber);
  if (!n) return undefined;
  const cc = digitsOnly(dialCode);
  const total = cc.length + n.length;
  if (total < 10) return "Phone number seems too short.";
  if (total > 15) return "Phone number is too long (max 15 digits including country code).";
  return undefined;
}

export function validateRequiredInternationalPhone(dialCode: string, nationalNumber: string): string | undefined {
  const n = digitsOnly(nationalNumber);
  if (!n) return "Phone number is required.";
  return validateOptionalInternationalPhone(dialCode, nationalNumber);
}

/**
 * Best-effort split of a stored phone string into dial code + national digits.
 */
export function splitInternationalPhone(raw: string): { dial: string; national: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { dial: DEFAULT_DIAL_CODE, national: "" };

  const digits = digitsOnly(trimmed.startsWith("+") ? trimmed : trimmed.replace(/^tel:/i, ""));
  if (!digits) return { dial: DEFAULT_DIAL_CODE, national: "" };

  const sorted = [...DIAL_CODE_OPTIONS].sort((a, b) => digitsOnly(b.dial).length - digitsOnly(a.dial).length);
  for (const opt of sorted) {
    const cc = digitsOnly(opt.dial);
    if (digits.startsWith(cc)) {
      return { dial: opt.dial, national: digits.slice(cc.length) };
    }
  }

  return { dial: DEFAULT_DIAL_CODE, national: digits };
}
