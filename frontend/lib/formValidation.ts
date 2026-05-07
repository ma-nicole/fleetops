import { DEFAULT_DIAL_CODE, DIAL_CODE_OPTIONS, getDialCodeOption } from "@/lib/dialCodes";

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

export function validateFirstName(value: string): string | undefined {
  const t = value.trim();
  if (!t) return "First name is required.";
  if (t.length < 2) return "First name must be at least 2 characters.";
  return undefined;
}

export function validateLastName(value: string): string | undefined {
  const t = value.trim();
  if (!t) return "Last name is required.";
  if (t.length < 2) return "Last name must be at least 2 characters.";
  return undefined;
}

export function validateCompanyName(value: string): string | undefined {
  const t = value.trim();
  if (!t) return "Company name is required.";
  if (t.length < 2) return "Company name must be at least 2 characters.";
  return undefined;
}

export function validateConfirmPassword(password: string, confirm: string): string | undefined {
  if (!confirm) return "Please confirm your password.";
  if (password !== confirm) return "Passwords do not match.";
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
  const opt = getDialCodeOption(dialCode);
  if (opt?.nationalMinDigits && n.length < opt.nationalMinDigits) {
    return "Phone number seems too short.";
  }
  if (opt?.nationalMaxDigits && n.length > opt.nationalMaxDigits) {
    return "Phone number is too long for the selected country code.";
  }

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
 * Customer saved sites: require a routable PH-style line (not stub addresses).
 * Mirrors backend `SavedSiteCreate` rules.
 */
const SITE_ADDRESS_HINT =
  /\b(brgy|barangay|district|village|street|st\.?|road|rd\.?|highway|hwy|avenue|ave|boulevard|blvd|sitio|purok|subd|subdivision|industrial|zone|city|province|philippines|metro|ncr|region|calabarzon)\b/i;

export const CUSTOMER_SITE_ADDRESS_MIN_CHARS = 42;
export const CUSTOMER_SITE_ADDRESS_MIN_WORDS = 6;

export function validateCustomerSiteAddress(value: string): string | undefined {
  const t = value.trim();
  if (!t) return "Site address is required.";
  if (t.length < CUSTOMER_SITE_ADDRESS_MIN_CHARS) {
    return `Use a complete address (at least ${CUSTOMER_SITE_ADDRESS_MIN_CHARS} characters): building/street, district or village, city or municipality, province, and zip code or Philippines.`;
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < CUSTOMER_SITE_ADDRESS_MIN_WORDS) {
    return `Include more address parts (at least ${CUSTOMER_SITE_ADDRESS_MIN_WORDS} words), for example street, district, city, and province.`;
  }
  const hasDigit = /\d/.test(t);
  const hasComma = t.includes(",");
  const hasHint = SITE_ADDRESS_HINT.test(t);
  if (!hasDigit && !hasComma && !hasHint) {
    return "Add a street line, use commas between parts, or include district, city, province (or Philippines).";
  }
  return undefined;
}

/** Parts from the Sites form (saved as one line for booking + map estimate). */
export type CustomerSiteAddressPartsInput = {
  street: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  postalCode: string;
};

export function composeCustomerSiteAddressLine(parts: CustomerSiteAddressPartsInput): string {
  const last = `${parts.province.trim()} ${parts.postalCode.trim()}`.trim();
  return `${parts.street.trim()}, ${parts.barangay.trim()}, ${parts.cityMunicipality.trim()}, ${last}, Philippines`;
}

/** Validates each field, then the composed line (same rules as the API). */
export function validateCustomerSiteStructuredFields(parts: CustomerSiteAddressPartsInput): string | undefined {
  const st = parts.street.trim();
  const bg = parts.barangay.trim();
  const cm = parts.cityMunicipality.trim();
  const pv = parts.province.trim();
  const zc = parts.postalCode.trim();
  if (!st) return "Enter street / building.";
  if (st.length < 5) return "Street must be at least 5 characters.";
  if (!bg) return "Enter district or village.";
  if (bg.length < 2) return "District / village is too short.";
  if (!cm) return "Enter city or municipality.";
  if (cm.length < 3) return "City / municipality is too short.";
  if (!pv) return "Enter province.";
  if (pv.length < 3) return "Province is too short.";
  if (!zc) return "Enter zip code.";
  if (zc.length < 4 || !/\d/.test(zc)) return "Zip code must include a number and be at least 4 characters.";
  return validateCustomerSiteAddress(composeCustomerSiteAddressLine(parts));
}

/** Best-effort split of a stored phone string into dial code + national digits. */
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
