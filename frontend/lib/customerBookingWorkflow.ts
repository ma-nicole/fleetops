/**
 * Customer-facing booking progress stages (presentation only).
 * Maps existing booking/payment/assignment fields — does not change workflow logic.
 */
import type { Booking, CustomerBookingAssignment, CustomerBookingRow, Payment } from "@/lib/workflowApi";

export type CustomerWorkflowStageId =
  | "booking_submitted"
  | "payment_successful"
  | "payment_verified"
  | "goods_review"
  | "dispatcher_assignment"
  | "driver_assigned"
  | "en_route_pickup"
  | "arrived_pickup"
  | "en_route_destination"
  | "arrived_destination"
  | "completed";

export type CustomerWorkflowStep = {
  id: CustomerWorkflowStageId;
  label: string;
  completed: boolean;
  current: boolean;
};

export const CUSTOMER_BOOKING_WORKFLOW_STAGES: ReadonlyArray<{
  id: CustomerWorkflowStageId;
  label: string;
}> = [
  { id: "booking_submitted", label: "Booking Submitted" },
  { id: "payment_successful", label: "Payment Successful" },
  { id: "payment_verified", label: "Payment Verified" },
  { id: "goods_review", label: "Goods Review" },
  { id: "dispatcher_assignment", label: "Dispatcher Assignment" },
  { id: "driver_assigned", label: "Driver Assigned" },
  { id: "en_route_pickup", label: "En Route to Pickup" },
  { id: "arrived_pickup", label: "Arrived at Pickup" },
  { id: "en_route_destination", label: "En Route to Destination" },
  { id: "arrived_destination", label: "Arrived at Destination" },
  { id: "completed", label: "Completed" },
];

const TERMINAL_FAIL = new Set(["cancelled", "rejected", "payment_rejected", "expired"]);

function goodsReviewDone(booking: Booking): boolean {
  const review = (booking.goods_declaration_review_status || "").toLowerCase();
  if (review === "approved") return true;
  if (booking.goods_declaration_validated === true) return true;
  return false;
}

function bestAssignmentProgress(assignments: CustomerBookingAssignment[] | undefined): string | null {
  if (!assignments?.length) return null;
  const rank: Record<string, number> = {
    completed: 6,
    dropped_off: 5,
    en_route: 4,
    out_for_delivery: 4,
    picked_up: 3,
    for_pickup: 2,
    assigned: 1,
  };
  let best: string | null = null;
  let bestRank = -1;
  for (const a of assignments) {
    const helper = (a.helper_progress_status || "").toLowerCase();
    const trip = (a.trip_status || "").toLowerCase();
    for (const key of [helper, trip]) {
      const r = rank[key] ?? -1;
      if (r > bestRank) {
        bestRank = r;
        best = key;
      }
    }
  }
  return best;
}

/**
 * Returns the index of the current (active) stage in CUSTOMER_BOOKING_WORKFLOW_STAGES.
 * Completed stages are all indices strictly less than this (except when fully completed).
 */
export function resolveCustomerWorkflowStageIndex(
  booking: Booking | CustomerBookingRow,
  payment?: Payment | null,
): number {
  const status = booking.status;
  const display = "display_status" in booking ? booking.display_status : status;
  const payStatus = payment?.status;
  const assignments = "assignments" in booking ? booking.assignments : undefined;
  const hasAssignments = Boolean(assignments?.length);
  const hasDriver = Boolean(assignments?.some((a) => a.driver != null));
  const assignProgress = bestAssignmentProgress(assignments);

  if (TERMINAL_FAIL.has(display) || TERMINAL_FAIL.has(status)) {
    if (display === "payment_rejected" || status === "payment_rejected" || payStatus === "rejected") {
      return 1; // stuck needing successful payment again
    }
    // cancelled / rejected / expired — stay on booking submitted as context
    return 0;
  }

  if (display === "completed" || status === "completed" || assignProgress === "completed") {
    return CUSTOMER_BOOKING_WORKFLOW_STAGES.length - 1;
  }

  if (display === "dropped_off" || assignProgress === "dropped_off") return 9;
  if (
    display === "en_route" ||
    display === "out_for_delivery" ||
    status === "enroute" ||
    status === "out_for_delivery" ||
    assignProgress === "en_route" ||
    assignProgress === "out_for_delivery"
  ) {
    return 8;
  }
  if (display === "picked_up" || status === "loading" || assignProgress === "picked_up") return 7;
  if (display === "for_pickup" || status === "accepted" || assignProgress === "for_pickup") return 6;

  if (display === "assigned" || status === "assigned" || hasDriver || assignProgress === "assigned") {
    return 5;
  }

  if (
    display === "approved" ||
    display === "pending_approval" ||
    display === "ready_for_assignment" ||
    status === "approved" ||
    status === "pending_approval" ||
    status === "ready_for_assignment" ||
    hasAssignments
  ) {
    return 4;
  }

  const paymentVerified =
    status === "payment_verified" ||
    display === "payment_verified" ||
    payStatus === "verified";

  if (paymentVerified) {
    if (goodsReviewDone(booking)) return 4;
    return 3;
  }

  const paymentSubmitted =
    status === "payment_verification" ||
    display === "payment_verification" ||
    payStatus === "for_verification" ||
    Boolean(payment);

  if (paymentSubmitted) return 2;

  if (status === "pending_payment" || display === "pending_payment") return 1;

  return 0;
}

export function buildCustomerBookingWorkflowSteps(
  booking: Booking | CustomerBookingRow,
  payment?: Payment | null,
): CustomerWorkflowStep[] {
  const currentIndex = resolveCustomerWorkflowStageIndex(booking, payment);
  const fullyDone =
    ("display_status" in booking ? booking.display_status : booking.status) === "completed" ||
    booking.status === "completed";

  return CUSTOMER_BOOKING_WORKFLOW_STAGES.map((stage, index) => {
    if (fullyDone) {
      return { ...stage, completed: true, current: index === CUSTOMER_BOOKING_WORKFLOW_STAGES.length - 1 };
    }
    return {
      ...stage,
      completed: index < currentIndex,
      current: index === currentIndex,
    };
  });
}

export function customerWorkflowCurrentLabel(
  booking: Booking | CustomerBookingRow,
  payment?: Payment | null,
): string {
  const steps = buildCustomerBookingWorkflowSteps(booking, payment);
  return steps.find((s) => s.current)?.label ?? steps[0]?.label ?? "Booking Submitted";
}
