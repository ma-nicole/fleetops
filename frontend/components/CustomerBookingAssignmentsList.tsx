"use client";

import { apiFullUrl } from "@/lib/api";
import { customerAssignmentLatestLocation } from "@/lib/customerAssignmentDisplay";
import HelperUpdatesTimeline from "@/components/HelperUpdatesTimeline";
import type { CrewTimelineEvent, CustomerBookingAssignment } from "@/lib/workflowApi";

function formatTruckLine(t: CustomerBookingAssignment["truck"]): string {
  if (!t) return "—";
  const plate = t.plate_number ?? t.code;
  return t.model_name ? `${plate} (${t.model_name})` : plate;
}

function mediaSrc(url: string): string {
  const u = (url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return apiFullUrl(u.startsWith("/") ? u : `/${u}`);
}

function assignmentTimelineEvents(asg: CustomerBookingAssignment): CrewTimelineEvent[] {
  if (asg.timeline_events?.length) {
    return asg.timeline_events;
  }
  const milestones: CrewTimelineEvent[] = (asg.status_timeline ?? []).map((u) => ({
    at: u.created_at,
    kind: "milestone",
    code: u.status,
    title: u.status,
    detail: u.location_name || "",
    remarks: u.remarks,
    photo_url: u.photo_url,
    submitted_by: u.helper_name ?? asg.helper?.name ?? null,
    booking_id: u.booking_id ?? asg.booking_id,
    trip_id: u.trip_id ?? asg.trip_id,
    helper_id: u.helper_id ?? asg.helper?.id ?? null,
    driver_id: u.driver_id ?? asg.driver?.id ?? null,
    driver_name: u.driver_name ?? asg.driver?.name ?? null,
    delivery_status: u.delivery_status ?? u.status,
    evidence_latitude: u.latitude,
    evidence_longitude: u.longitude,
  }));
  const locations: CrewTimelineEvent[] = (asg.location_updates ?? []).map((u, i) => ({
    at: u.created_at,
    kind: "location",
    code: `location_update_${i + 1}`,
    title: u.location_name ? `Update #${i + 1} — ${u.location_name}` : `Update #${i + 1}`,
    detail: u.location_name || "",
    remarks: u.remarks,
    photo_url: u.photo_url,
    submitted_by: u.helper_name ?? asg.helper?.name ?? null,
    update_index: i + 1,
    booking_id: u.booking_id ?? asg.booking_id,
    trip_id: u.trip_id ?? asg.trip_id,
    helper_id: u.helper_id ?? asg.helper?.id ?? null,
    driver_id: u.driver_id ?? asg.driver?.id ?? null,
    driver_name: u.driver_name ?? asg.driver?.name ?? null,
    delivery_status: u.delivery_status ?? "en_route",
    evidence_latitude: u.latitude,
    evidence_longitude: u.longitude,
  }));
  return [...milestones, ...locations].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
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
        const timeline = assignmentTimelineEvents(asg);
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
            <div style={{ marginTop: "0.45rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.35rem" }}>Delivery timeline</div>
              <HelperUpdatesTimeline
                events={timeline}
                operationalStatus={asg.helper_progress_status || asg.trip_status || undefined}
                mediaSrc={mediaSrc}
                showPending={false}
                emptyMessage="No delivery timeline updates yet."
                title={`Trip #${asg.trip_id} delivery timeline`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
