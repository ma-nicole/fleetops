export type DialCodeOption = {
  dial: string;
  label: string;
};

/** Domestic Philippine mobile numbers only (+63). */
export const DIAL_CODE_OPTIONS: DialCodeOption[] = [{ dial: "+63", label: "Philippines (+63)" }];

export const DEFAULT_DIAL_CODE = "+63";
