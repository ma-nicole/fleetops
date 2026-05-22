import {
  MAX_BOOKING_WEIGHT_TONS,
  FLEET_TRUCK_COUNT,
  formatBookingWeightTons,
  trucksRequiredForWeight,
} from "@/lib/bookingWeightOptions";
import { TRUCK_MAX_LOAD_TONS } from "@/lib/customerPricingConstants";

type BookingCargoWeightDisplayProps = {
  cargoWeightTons: number;
  requiredTruckCount?: number | null;
  cargoDescription?: string | null;
};

export default function BookingCargoWeightDisplay({
  cargoWeightTons,
  requiredTruckCount,
  cargoDescription,
}: BookingCargoWeightDisplayProps) {
  const trucks = requiredTruckCount ?? trucksRequiredForWeight(cargoWeightTons);
  const atMax = cargoWeightTons >= MAX_BOOKING_WEIGHT_TONS - 1e-6;

  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <p style={{ margin: 0, color: "#333" }}>
        <strong>Cargo weight:</strong> {formatBookingWeightTons(cargoWeightTons)} t
        {cargoDescription ? ` — ${cargoDescription}` : ""}
      </p>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
        {trucks} truck{trucks === 1 ? "" : "s"} required (≤ {TRUCK_MAX_LOAD_TONS} t each)
        {atMax ? ` · at fleet maximum (${MAX_BOOKING_WEIGHT_TONS} t)` : ""}
      </p>
    </div>
  );
}
