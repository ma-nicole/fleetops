import { getCountryDataList } from "countries-list";

export type DialCodeOption = {
  dial: string;
  label: string;
  nationalMinDigits?: number;
  nationalMaxDigits?: number;
  nationalPlaceholder?: string;
};

/** Manual length hints for frequent markets; others rely on generic E.164 checks. */
const NATIONAL_RULES: Partial<
  Record<
    string,
    Pick<
      DialCodeOption,
      "nationalMinDigits" | "nationalMaxDigits" | "nationalPlaceholder"
    >
  >
> = {
  "+63": {
    nationalMinDigits: 10,
    nationalMaxDigits: 10,
    nationalPlaceholder: "9171234567",
  },
  "+1": {
    nationalMinDigits: 10,
    nationalMaxDigits: 10,
    nationalPlaceholder: "4155550123",
  },
  "+44": {
    nationalMinDigits: 9,
    nationalMaxDigits: 10,
    nationalPlaceholder: "7400123456",
  },
  "+61": {
    nationalMinDigits: 9,
    nationalMaxDigits: 9,
    nationalPlaceholder: "412345678",
  },
  "+65": {
    nationalMinDigits: 8,
    nationalMaxDigits: 8,
    nationalPlaceholder: "81234567",
  },
  "+353": {
    nationalMinDigits: 7,
    nationalMaxDigits: 9,
    nationalPlaceholder: "851234567",
  },
};

function dialNumericKey(dial: string): bigint {
  return BigInt(dial.replace(/\D/g, ""));
}

function mergeDialCodes(): DialCodeOption[] {
  const dialToNames = new Map<string, Set<string>>();
  for (const country of getCountryDataList()) {
    for (const p of country.phone) {
      const dial = `+${p}`;
      if (!dialToNames.has(dial)) dialToNames.set(dial, new Set());
      dialToNames.get(dial)!.add(country.name);
    }
  }

  const sortedDials = [...dialToNames.keys()].sort((a, b) => {
    const na = dialNumericKey(a);
    const nb = dialNumericKey(b);
    if (na < nb) return -1;
    if (na > nb) return 1;
    return a.localeCompare(b);
  });

  const out: DialCodeOption[] = [];
  for (const dial of sortedDials) {
    const names = dialToNames.get(dial)!;
    let label: string;
    if (dial === "+1") {
      label =
        "United States / Canada and other NANP regions (+1)";
    } else {
      const sorted = [...names].sort((x, y) => x.localeCompare(y));
      if (sorted.length <= 3) {
        label = `${sorted.join(", ")} (${dial})`;
      } else {
        label = `${sorted.slice(0, 3).join(", ")}, … (+${sorted.length - 3} areas) (${dial})`;
      }
    }
    out.push({
      dial,
      label,
      ...NATIONAL_RULES[dial],
    });
  }
  return out;
}

export function getDialCodeOption(dial: string): DialCodeOption | undefined {
  return DIAL_CODE_OPTIONS.find((opt) => opt.dial === dial);
}

/** All ITU-derived country codes from `countries-list` (merged where sharing a dial). */
export const DIAL_CODE_OPTIONS: DialCodeOption[] = mergeDialCodes();

export const DEFAULT_DIAL_CODE = "+63";
