"use client";

import { customerAssignmentLatestLocation } from "@/lib/customerAssignmentDisplay";
import type { CustomerBookingAssignment } from "@/lib/workflowApi";

function formatTruckLine(t: CustomerBookingAssignment["truck"]): string {
  if (!t) return "—";
  const plate = t.plate_number ?? t.code;
  return t.model_name ? `${plate} (${t.model_name})` : plate;
}

export default function CustomerBookingAssignmentsList({
  assignments,
  dropoffAddress,
  heading = "Assigned trucks",
}: {
  assignments: CustomerBookingAssignment[] | null | undefined;
  /** When trips are completed / dropped off, latest location shows this booking drop-off line. */
  dropoffAddress?: string | null;
  heading?: string;
}) {
  const sorted = [...(assignments ?? [])].sort((a, b) => (a.trip_id ?? 0) - (b.trip_id ?? 0));

  if (sorted.length === 0) {
    return <div style={{ color: "var(--text-secondary, #6B7280)", fontSize: "0.88rem" }}>Waiting for truck assignment</div>;
  }

  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary, #111827)" }}>{heading}</div>
      {sorted.map((asg) => {
        const tripStatus = (asg.helper_progress_status || asg.trip_status || "—").replace(/_/g, " ");
        return (
          <div
            key={asg.trip_id}
            style={{
              border: "1px solid var(--border, #E5E7EB)",
              borderRadius: "10px",
              padding: "0.65rem 0.75rem",
              background: "var(--surface-elevated, #fff)",
              display: "grid",
              gap: "0.3rem",
              fontSize: "0.86rem",
            }}
          >
            <div style={{ fontWeight: 700 }}>Trip #{asg.trip_id}</div>
            <div>
              <span style={{ color: "var(--text-secondary, #6B7280)" }}>Truck:</span> {formatTruckLine(asg.truck)}
            </div>
            <div>
              <span style={{ color: "var(--text-secondary, #6B7280)" }}>Driver:</span> {asg.driver?.name ?? "—"}
            </div>
            <div>
              <span style={{ color: "var(--text-secondary, #6B7280)" }}>Helper:</span> {asg.helper?.name ?? "—"}
            </div>
            <div>
              <span style={{ color: "var(--text-secondary, #6B7280)" }}>Status:</span> {tripStatus}
            </div>
            <div>
              <span style={{ color: "var(--text-secondary, #6B7280)" }}>Latest location:</span>{" "}
              {customerAssignmentLatestLocation(asg, dropoffAddress)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
