import BookingCargoWeightField from "@/components/BookingCargoWeightField";
import { CARGO_TYPE_CATEGORIES } from "@/lib/cargoTypeCategories";
import type { FormErrors } from "./wizardTypes";

type Props = {
  hasEnoughSites: boolean;
  weight: string;
  cargoDescription: string;
  cargoTypeCategory: string;
  errors: FormErrors;
  onWeightChange: (value: string) => void;
  onCargoDescriptionChange: (value: string) => void;
  onCargoTypeCategoryChange: (value: string) => void;
};

export default function ShipmentStep({
  hasEnoughSites,
  weight,
  cargoDescription,
  cargoTypeCategory,
  errors,
  onWeightChange,
  onCargoDescriptionChange,
  onCargoTypeCategoryChange,
}: Props) {
  return (
    <div className="booking-wizard-step" style={{ display: "grid", gap: "1rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "1rem",
        }}
      >
        <BookingCargoWeightField
          weight={weight}
          onWeightChange={onWeightChange}
          disabled={!hasEnoughSites}
          error={errors.cargo_weight_tons}
        />
      </div>

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Cargo description</span>
        <textarea
          value={cargoDescription}
          disabled={!hasEnoughSites}
          rows={3}
          maxLength={500}
          placeholder="Describe what you are shipping (required)"
          onChange={(e) => onCargoDescriptionChange(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            padding: "0.65rem 0.75rem",
            borderRadius: 8,
            border: errors.cargo_description ? "1px solid #DC2626" : "1px solid #D1D5DB",
            resize: "vertical",
            font: "inherit",
          }}
        />
        {errors.cargo_description ? (
          <span style={{ color: "#DC2626", fontSize: "0.8rem" }}>{errors.cargo_description}</span>
        ) : (
          <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
            Required. Be specific enough for operations (e.g. “Palletized electronics — 12 pallets”).
          </span>
        )}
      </label>

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Cargo type / category</span>
        <select
          value={cargoTypeCategory}
          disabled={!hasEnoughSites}
          onChange={(e) => onCargoTypeCategoryChange(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            padding: "0.65rem 0.75rem",
            borderRadius: 8,
            border: errors.cargo_type_category ? "1px solid #DC2626" : "1px solid #D1D5DB",
            font: "inherit",
            background: "#fff",
          }}
        >
          <option value="">— select cargo type —</option>
          {CARGO_TYPE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
              {c.restricted ? " (restricted — admin review)" : ""}
            </option>
          ))}
        </select>
        {errors.cargo_type_category ? (
          <span style={{ color: "#DC2626", fontSize: "0.8rem" }}>{errors.cargo_type_category}</span>
        ) : (
          <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
            If you are unsure, choose <strong>Other / mixed</strong> — admin can reclassify later.
          </span>
        )}
      </label>

      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        FleetOps calculates the required truck count from the cargo weight. Pickup-window availability is checked next.
      </p>
    </div>
  );
}
