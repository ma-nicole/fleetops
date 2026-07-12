"use client";

import WorkflowTimeline from "@/components/WorkflowTimeline";
import {
  buildCustomerBookingWorkflowSteps,
  customerWorkflowCurrentLabel,
} from "@/lib/customerBookingWorkflow";
import type { Booking, CustomerBookingRow, Payment } from "@/lib/workflowApi";

type Props = {
  booking: Booking | CustomerBookingRow;
  payment?: Payment | null;
  compact?: boolean;
};

/** Presentation-only booking stage tracker for customers after payment. */
export default function CustomerBookingWorkflowTracker({ booking, payment = null, compact = false }: Props) {
  const steps = buildCustomerBookingWorkflowSteps(booking, payment);
  const currentLabel = customerWorkflowCurrentLabel(booking, payment);
  const doneCount = steps.filter((s) => s.completed).length;

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        padding: compact ? "0.75rem 0.85rem" : "0.9rem 1rem",
        background: "#fff",
        marginBottom: compact ? "0.75rem" : "1rem",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "0.65rem",
          minWidth: 0,
        }}
      >
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151" }}>Booking progress</div>
        <div
          style={{
            fontSize: "0.78rem",
            color: "#B45309",
            fontWeight: 600,
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          Now: {currentLabel}
          <span style={{ color: "#9CA3AF", fontWeight: 500 }}>
            {" "}
            · {doneCount}/{steps.length} done
          </span>
        </div>
      </div>
      <WorkflowTimeline steps={steps} orientation={compact ? "horizontal" : "vertical"} />
    </div>
  );
}
