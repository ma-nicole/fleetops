"use client";

import { useState } from "react";
import {
  CUSTOM_WEIGHT_SELECT_VALUE,
  FLEET_TRUCK_COUNT,
  MAX_BOOKING_WEIGHT_TONS,
  MIN_BOOKING_WEIGHT_TONS,
  SUGGESTED_BOOKING_WEIGHTS_TONS,
  bookingWeightValidationMessage,
  formatBookingWeightTons,
  isValidBookingWeightTons,
  resolveWeightSelectValue,
} from "@/lib/bookingWeightOptions";
import { TRUCK_MAX_LOAD_TONS } from "@/lib/customerPricingConstants";

type BookingCargoWeightFieldProps = {
  weight: string;
  onWeightChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

export default function BookingCargoWeightField({
  weight,
  onWeightChange,
  disabled,
  error,
}: BookingCargoWeightFieldProps) {
  const [forceCustom, setForceCustom] = useState(false);
  const weightSelect = forceCustom ? CUSTOM_WEIGHT_SELECT_VALUE : resolveWeightSelectValue(weight);
  const isCustom = weightSelect === CUSTOM_WEIGHT_SELECT_VALUE;
  const wNum = parseFloat(weight);
  const isValid = isValidBookingWeightTons(wNum);

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.9rem",
          color: "var(--text-secondary)",
        }}
      >
        <span>Cargo weight (metric tons)</span>
        <span
          className="field-help"
          title={`Choose a common load or enter a custom weight up to ${MAX_BOOKING_WEIGHT_TONS} t (${FLEET_TRUCK_COUNT} trucks × ${TRUCK_MAX_LOAD_TONS} t).`}
        >
          ?
        </span>
        {isValid && !error && <span className="field-valid">✓</span>}
      </label>

      <select
        className="input"
        value={weightSelect}
        disabled={disabled}
        aria-label="Suggested cargo weight"
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_WEIGHT_SELECT_VALUE) {
            setForceCustom(true);
            onWeightChange("");
          } else {
            setForceCustom(false);
            onWeightChange(next);
          }
        }}
        style={error && !isCustom ? { borderColor: "#F44336" } : {}}
      >
        {SUGGESTED_BOOKING_WEIGHTS_TONS.map((tons) => (
          <option key={tons} value={String(tons)}>
            {formatBookingWeightTons(tons)} t
            {tons === TRUCK_MAX_LOAD_TONS ? " (1 truck)" : ""}
            {tons === MAX_BOOKING_WEIGHT_TONS ? " (max fleet)" : ""}
          </option>
        ))}
        <option value={CUSTOM_WEIGHT_SELECT_VALUE}>Custom weight…</option>
      </select>

      {isCustom && (
        <input
          className="input"
          type="number"
          min={MIN_BOOKING_WEIGHT_TONS}
          max={MAX_BOOKING_WEIGHT_TONS}
          step={0.01}
          placeholder={`e.g. 12.5 (max ${MAX_BOOKING_WEIGHT_TONS} t)`}
          value={weight}
          onChange={(e) => onWeightChange(e.target.value)}
          disabled={disabled}
          aria-label="Custom cargo weight in metric tons"
          style={error ? { borderColor: "#F44336" } : {}}
        />
      )}

      <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
        Maximum {MAX_BOOKING_WEIGHT_TONS} t per booking ({FLEET_TRUCK_COUNT} × {TRUCK_MAX_LOAD_TONS} t trucks).
      </p>

      {error && (
        <p style={{ color: "#F44336", fontSize: "0.8rem", margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}

export { bookingWeightValidationMessage, isValidBookingWeightTons };
