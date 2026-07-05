import BookingCargoWeightField from "@/components/BookingCargoWeightField";
import type { FormErrors } from "./wizardTypes";

type Props = {
  hasEnoughSites: boolean;
  weight: string;
  errors: FormErrors;
  onWeightChange: (value: string) => void;
};

export default function ShipmentStep({ hasEnoughSites, weight, errors, onWeightChange }: Props) {
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
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        FleetOps calculates the required truck count from the cargo weight. Pickup-window availability is checked next.
      </p>
    </div>
  );
}
