export type DialCodeOption = {
  dial: string;
  label: string;
  /**
   * Rules apply to the *national significant number* (digits typed in the box),
   * excluding the `dial` country code.
   */
  nationalMinDigits?: number;
  nationalMaxDigits?: number;
  nationalPlaceholder?: string;
};

export function getDialCodeOption(dial: string): DialCodeOption | undefined {
  return DIAL_CODE_OPTIONS.find((opt) => opt.dial === dial);
}

/**
 * Supported dial codes for customer signup and profile editing.
 * Keep this list small + pragmatic; we enforce digit rules for common markets.
 */
export const DIAL_CODE_OPTIONS: DialCodeOption[] = [
  { dial: "+63", label: "Philippines (+63)", nationalMinDigits: 10, nationalMaxDigits: 10, nationalPlaceholder: "9171234567" },
  { dial: "+1", label: "United States / Canada (+1)", nationalMinDigits: 10, nationalMaxDigits: 10, nationalPlaceholder: "4155550123" },
  { dial: "+44", label: "United Kingdom (+44)", nationalMinDigits: 9, nationalMaxDigits: 10, nationalPlaceholder: "7400123456" },
  { dial: "+61", label: "Australia (+61)", nationalMinDigits: 9, nationalMaxDigits: 9, nationalPlaceholder: "412345678" },
  { dial: "+65", label: "Singapore (+65)", nationalMinDigits: 8, nationalMaxDigits: 8, nationalPlaceholder: "81234567" },
];

export const DEFAULT_DIAL_CODE = "+63";
