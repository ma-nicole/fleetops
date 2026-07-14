/** Labels for dispatcher Assigned Trips board (display only — no workflow changes). */

export type AssignedTripStatusFields = {
  trip_status?: string | null;
  helper_progress_status?: string | null;
  operational_status?: string | null;
  driver_name?: string | null;
  helper_name?: string | null;
};

const TERMINAL = new Set(["completed", "cancelled"]);

/** True while the trip should stay on the Assigned Trips / active boards. */
export function isActiveAssignedTrip(row: AssignedTripStatusFields): boolean {
  const ts = (row.trip_status || "").trim().toLowerCase();
  return Boolean(ts) && !TERMINAL.has(ts);
}

/**
 * Human-readable status covering the active assignment lifecycle:
 * Assigned → Driver/Helper Assigned → En Route to Pickup → Arrived Pickup →
 * En Route to Destination → Arrived Destination (Completed/Cancelled removed from list).
 */
export function dispatchAssignedTripStatusLabel(row: AssignedTripStatusFields): string {
  const hp = (row.helper_progress_status || "").trim().toLowerCase().replace(/-/g, "_");
  const op = (row.operational_status || "").trim().toLowerCase().replace(/-/g, "_");
  const ts = (row.trip_status || "").trim().toLowerCase().replace(/-/g, "_");
  const key = hp || op || ts;

  if (key === "dropped_off") return "Arrived Destination";
  if (key === "en_route" || key === "out_for_delivery" || key === "in_delivery") return "En Route to Destination";
  if (key === "picked_up" || key === "loading") return "Arrived Pickup";
  if (key === "for_pickup" || key === "accepted" || key === "departed") return "En Route to Pickup";

  if (row.helper_name && row.driver_name) return "Helper Assigned";
  if (row.driver_name) return "Driver Assigned";
  if (key === "assigned" || key === "pending") return "Assigned";
  if (key) return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return "Assigned";
}
