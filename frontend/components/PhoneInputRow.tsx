"use client";

import type { CSSProperties } from "react";

import { DIAL_CODE_OPTIONS, getDialCodeOption } from "@/lib/dialCodes";
import { digitsOnly } from "@/lib/formValidation";

type Props = {
  dialCode: string;
  nationalNumber: string;
  onDialCodeChange: (dial: string) => void;
  onNationalChange: (national: string) => void;
  optional?: boolean;
  error?: string;
  variant?: "dark" | "light";
  nationalPlaceholder?: string;
  selectId?: string;
  nationalId?: string;
};

export default function PhoneInputRow({
  dialCode,
  nationalNumber,
  onDialCodeChange,
  onNationalChange,
  optional,
  error,
  variant = "light",
  nationalPlaceholder = "9171234567",
  selectId,
  nationalId,
}: Props) {
  const dark = variant === "dark";
  const opt = getDialCodeOption(dialCode);
  const maxDigits = opt?.nationalMaxDigits;
  const minDigits = opt?.nationalMinDigits;
  const effectivePlaceholder = opt?.nationalPlaceholder ?? nationalPlaceholder;
  const fieldStyle: CSSProperties = dark
    ? {
        width: "100%",
        minHeight: 44,
        padding: 10,
        borderRadius: 8,
        border: error ? "1px solid #ff6b6b" : "1px solid rgba(255,255,255,0.16)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontSize: "1rem",
        boxSizing: "border-box",
      }
    : {
        width: "100%",
        minHeight: 40,
        padding: "0.5rem 0.65rem",
        borderRadius: 6,
        border: error ? "1px solid #DC2626" : "1px solid var(--border, #D1D5DB)",
        background: "#fff",
        color: "var(--text, #111827)",
        fontSize: "1rem",
        boxSizing: "border-box",
      };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="phone-input-row" style={{ display: "grid", gridTemplateColumns: "minmax(min(100%, 140px), 38%) 1fr", gap: 8, alignItems: "stretch" }}>
        <select
          id={selectId}
          value={dialCode}
          onChange={(e) => {
            const nextDial = e.target.value;
            onDialCodeChange(nextDial);

            const nextOpt = getDialCodeOption(nextDial);
            const nextMax = nextOpt?.nationalMaxDigits;
            if (typeof nextMax === "number" && nextMax >= 1) {
              const trimmed = digitsOnly(nationalNumber).slice(0, nextMax);
              if (trimmed !== digitsOnly(nationalNumber)) onNationalChange(trimmed);
            }
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${nationalId ?? selectId}-phone-err` : undefined}
          style={fieldStyle}
        >
          {DIAL_CODE_OPTIONS.map((opt) => (
            <option key={opt.dial} value={opt.dial} style={{ color: "#111827", background: "#fff" }}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          id={nationalId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={effectivePlaceholder}
          value={nationalNumber}
          onChange={(e) => {
            const nextDigits = digitsOnly(e.target.value);
            const limited = typeof maxDigits === "number" && maxDigits >= 1 ? nextDigits.slice(0, maxDigits) : nextDigits;
            onNationalChange(limited);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${nationalId ?? selectId}-phone-err` : undefined}
          style={fieldStyle}
        />
      </div>
      <span style={{ fontSize: "0.8rem", color: dark ? "rgba(255,255,255,0.55)" : "#6B7280" }}>
        Enter your mobile number without the country code.
        {typeof minDigits === "number" && typeof maxDigits === "number" && minDigits === maxDigits
          ? ` (${maxDigits} digits)`
          : typeof maxDigits === "number"
            ? ` (up to ${maxDigits} digits)`
            : ""}
        {optional ? " Leave blank if you prefer not to share a phone." : ""}
      </span>
      {error ? (
        <span id={`${nationalId ?? selectId}-phone-err`} role="alert" style={{ color: dark ? "#ff9b9b" : "#991B1B", fontSize: "0.9rem" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
