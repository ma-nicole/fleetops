import type { CustomerBookingAssignment } from "@/lib/workflowApi";

/** Helper milestone or trip DB status means cargo is at (or past) drop-off for display purposes. */
export function isTerminalDeliveryAssignment(asg: CustomerBookingAssignment): boolean {
  const h = (asg.helper_progress_status ?? "").toLowerCase().replace(/\s+/g, "_");
  const ts = (asg.trip_status ?? "").toLowerCase();
  return h === "completed" || h === "dropped_off" || ts === "completed";
}

export function customerAssignmentLatestLocation(
  asg: CustomerBookingAssignment,
  dropoffAddress: string | null | undefined,
  emptyLabel = "No live update yet",
): string {
  const drop = (dropoffAddress ?? "").trim();
  if (isTerminalDeliveryAssignment(asg) && drop) return drop;
  return asg.latest_location_name ?? emptyLabel;
}
