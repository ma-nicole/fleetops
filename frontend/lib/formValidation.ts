import { DEFAULT_DIAL_CODE, DIAL_CODE_OPTIONS, getDialCodeOption } from "@/lib/dialCodes";

export const AUTH_EMAIL_MAX_LENGTH = 254;
export const AUTH_PASSWORD_MAX_LENGTH = 72;
export const AUTH_NAME_MAX_LENGTH = 100;
export const AUTH_COMPANY_MAX_LENGTH = 255;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "qwerty",
  "admin123",
]);

export type PasswordRequirementCheck = {
  id: string;
  label: string;
  met: boolean;
};

/** Strip control characters only — keep trailing spaces so multi-word names can be typed. */
export function sanitizeAuthNameInput(value: string, maxLength: number): string {
  return value.replace(CONTROL_CHARS, "").replace(/ {2,}/g, " ").slice(0, maxLength);
}

/** Final name normalize for submit/blur: trim ends and collapse internal whitespace. */
export function normalizeAuthName(value: string, maxLength: number): string {
  return value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Strip control characters and trim; preserve inner spaces for names. Prefer sanitizeAuthNameInput while typing. */
export function sanitizeAuthText(value: string, maxLength: number): string {
  return normalizeAuthName(value, maxLength);
}

/** Normalize email for auth forms: trim, lowercase, strip control chars, cap length. */
export function sanitizeAuthEmail(value: string): string {
  return value.replace(CONTROL_CHARS, "").trim().toLowerCase().slice(0, AUTH_EMAIL_MAX_LENGTH);
}

/** Remove control characters; cap length (bcrypt limit). Do not trim — spaces may be intentional. */
export function sanitizeAuthPassword(value: string): string {
  return value.replace(CONTROL_CHARS, "").slice(0, AUTH_PASSWORD_MAX_LENGTH);
}

function normalizedForWeakPasswordCheck(password: string): string {
  return password.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCommonWeakPassword(password: string): boolean {
  const lowered = password.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(lowered)) return true;
  return COMMON_WEAK_PASSWORDS.has(normalizedForWeakPasswordCheck(password));
}

export function getPasswordRequirementChecks(password: string): PasswordRequirementCheck[] {
  return [
    {
      id: "length",
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      id: "uppercase",
      label: "At least one uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lowercase",
      label: "At least one lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      id: "number",
      label: "At least one number",
      met: /\d/.test(password),
    },
    {
      id: "special",
      label: "At least one special character",
      met: /[^A-Za-z0-9]/.test(password),
    },
    {
      id: "not-common",
      label: "Not a commonly used password",
      met: password.length > 0 && !isCommonWeakPassword(password),
    },
  ];
}

export function isStrongPassword(password: string): boolean {
  return getPasswordRequirementChecks(password).every((check) => check.met);
}

export function isValidEmail(value: string): boolean {
  const mail = sanitizeAuthEmail(value);
  if (!mail || mail.length > AUTH_EMAIL_MAX_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
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

export function validateLoginEmail(value: string): string | undefined {
  const mail = sanitizeAuthEmail(value);
  if (!mail) return "Email is required.";
  if (!isValidEmail(mail)) return "Enter a valid email address (e.g. you@example.com).";
  return undefined;
}

export function validateLoginPassword(value: string): string | undefined {
  const password = sanitizeAuthPassword(value);
  if (!password) return "Password is required.";
  if (password.length > AUTH_PASSWORD_MAX_LENGTH) {
    return "Password must be at most 72 characters.";
  }
  return undefined;
}

export function validateForgotPasswordEmail(value: string): string | undefined {
  return validateLoginEmail(value);
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

/** Backend `/auth/register` and password reset/change — strong policy. */
export function validateCustomerPassword(value: string): string | undefined {
  const password = sanitizeAuthPassword(value);
  if (!password) return "Password is required.";
  if (password.length > AUTH_PASSWORD_MAX_LENGTH) {
    return "Password must be at most 72 characters.";
  }

  const checks = getPasswordRequirementChecks(password);
  const firstUnmet = checks.find((check) => !check.met);
  if (firstUnmet?.id === "not-common") {
    return "This password is too common. Please choose a stronger password.";
  }
  if (firstUnmet) return `Password must meet all requirements (${firstUnmet.label.toLowerCase()}).`;
  return undefined;
}

/** Standard initial password for admin-created users (staff + customers). Meets full password policy. */
export const STANDARD_STAFF_INITIAL_PASSWORD = "FleetOpt@Staff1";

/** Same strength rules as customer signup — applies to all users. */
export function validateAdminInitialPassword(value: string): string | undefined {
  return validateCustomerPassword(value);
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Drop trunk 0 / duplicated country code from the national part before building E.164. */
export function normalizeNationalDigits(dialCode: string, nationalDigits: string): string {
  let n = digitsOnly(nationalDigits);
  const cc = digitsOnly(dialCode);
  if (!n) return "";

  // User pasted full international into the national field (e.g. 639171234567).
  if (cc && n.startsWith(cc)) {
    n = n.slice(cc.length);
  }
  // National trunk prefix (PH 09…, UK 07…, etc.) must not sit after +country.
  if (n.startsWith("0")) {
    n = n.replace(/^0+/, "");
  }
  return n;
}

export function buildInternationalPhone(dialCode: string, nationalDigits: string): string {
  const cc = digitsOnly(dialCode);
  const n = normalizeNationalDigits(dialCode, nationalDigits);
  if (!n) return "";
  return `+${cc}${n}`;
}

/** Empty national digits → valid (optional phone). Otherwise E.164-style total length 10–15. */
export function validateOptionalInternationalPhone(dialCode: string, nationalNumber: string): string | undefined {
  const n = normalizeNationalDigits(dialCode, nationalNumber);
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
      // Normalize stored mistakes like +6309… for the national field.
      return { dial: opt.dial, national: normalizeNationalDigits(opt.dial, digits.slice(cc.length)) };
    }
  }

  return { dial: DEFAULT_DIAL_CODE, national: normalizeNationalDigits(DEFAULT_DIAL_CODE, digits) };
}
