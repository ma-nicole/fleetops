"use client";

import { useEffect, useState } from "react";
import { APP_LOCALE, APP_TIMEZONE, formatPhp } from "@/lib/appLocale";
import { apiFullUrl, uploadMediaUrl } from "@/lib/api";
import HelperUpdatesTimeline from "@/components/HelperUpdatesTimeline";
import { WorkflowApi, type CrewTimelineEvent, type DispatchTripMonitoringAssignment } from "@/lib/workflowApi";

type LegacyAssignmentRow = Awaited<ReturnType<typeof WorkflowApi.dispatchAssignmentsBoard>>["assignments"][number];

export type TripBoardRow = DispatchTripMonitoringAssignment | LegacyAssignmentRow;

function operationalLabel(row: TripBoardRow): string {
  if ("operational_status" in row && row.operational_status) {
    return row.operational_status.replace(/_/g, " ");
  }
  return (row.helper_progress_status || row.trip_status).replace(/_/g, " ");
}

function bookingRecordStatus(row: TripBoardRow, tdBookingStatus: string | undefined): string {
  if ("booking_db_status" in row) return row.booking_db_status.replace(/_/g, " ");
  return (tdBookingStatus ?? row.booking_status).replace(/_/g, " ");
}

type Props = {
  row: TripBoardRow | null;
  onClose: () => void;
};

export function TripBoardDetailModal({ row, onClose }: Props) {
  const [td, setTd] = useState<Awaited<ReturnType<typeof WorkflowApi.bookingTrackingDetails>> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!row) {
      setTd(null);
      return;
    }
    let alive = true;
    setLoading(true);
    void WorkflowApi.bookingTrackingDetails(row.booking_id)
      .then((d) => {
        if (alive) setTd(d);
      })
      .catch(() => {
        if (alive) setTd(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [row]);

  if (!row) return null;

  const assignment = td?.assignments?.find((x) => x.trip_id === row.trip_id);
  const timelineEvents: CrewTimelineEvent[] = (() => {
    if (assignment?.timeline_events?.length) return assignment.timeline_events;
    const milestones: CrewTimelineEvent[] = (assignment?.status_timeline ?? []).map((ev) => ({
      at: ev.created_at,
      kind: "milestone",
      code: ev.status,
      title: ev.status,
      detail: ev.location_name || "",
      remarks: ev.remarks,
      photo_url: ev.photo_url,
      submitted_by: assignment?.helper?.name ?? null,
      delivery_status: ev.status,
      evidence_latitude: ev.latitude ?? null,
      evidence_longitude: ev.longitude ?? null,
      driver_name: assignment?.driver?.name ?? null,
    }));
    const locations: CrewTimelineEvent[] = (assignment?.location_updates ?? []).map((ev, i) => ({
      at: ev.created_at,
      kind: "location",
      code: `location_update_${i + 1}`,
      title: ev.location_name ? `Update #${i + 1} — ${ev.location_name}` : `Update #${i + 1}`,
      detail: ev.location_name || "",
      remarks: ev.remarks,
      photo_url: ev.photo_url,
      submitted_by: assignment?.helper?.name ?? null,
      update_index: i + 1,
      delivery_status: "en_route",
      evidence_latitude: ev.latitude ?? null,
      evidence_longitude: ev.longitude ?? null,
      driver_name: assignment?.driver?.name ?? null,
    }));
    return [...milestones, ...locations].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  })();
  const proofCount =
    timelineEvents.filter((x) => !!x.photo_url).length ||
    (assignment?.status_timeline ?? []).filter((x) => !!x.photo_url).length;
  const roadKm = td?.booking?.road_distance_km;
  const displayDistanceKm =
    typeof roadKm === "number" && roadKm > 0 ? roadKm : Number(row.distance_km) || 0;

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 3000,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          maxWidth: 640,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "1.5rem",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>
          Trip #{row.trip_id} · Booking #{row.booking_id}
        </h2>
        {loading ? (
          <p style={{ color: "#64748B" }}>Loading…</p>
        ) : (
          <div style={{ display: "grid", gap: 10, fontSize: "0.95rem" }}>
            <p>
              <strong>Customer:</strong> {row.customer_name ?? "—"}
            </p>
            <p>
              <strong>Company:</strong> {row.customer_company_name ?? "—"}
            </p>
            <p>
              <strong>Operational status:</strong> {operationalLabel(row)}
            </p>
            <p>
              <strong>Booking record status:</strong> {bookingRecordStatus(row, td?.booking?.status)}
            </p>
            <p>
              <strong>Customer-facing status:</strong> {row.booking_status.replace(/_/g, " ")}
            </p>
            <p>
              <strong>Pickup:</strong> {row.pickup_location}
            </p>
            <p>
              <strong>Dropoff:</strong> {row.dropoff_location}
            </p>
            <p>
              <strong>Schedule:</strong> {row.scheduled_date} {row.scheduled_time_slot}
            </p>
            <p>
              <strong>Cargo:</strong> {row.cargo_weight_tons} t
            </p>
            <p>
              <strong>Quoted total:</strong> {formatPhp(row.estimated_cost)}
            </p>
            <p>
              <strong>Paid (verified):</strong>{" "}
              {row.paid_amount_verified != null ? formatPhp(row.paid_amount_verified) : "—"}
            </p>
            <p>
              <strong>Driver:</strong> {row.driver_name ?? "—"}
            </p>
            <p>
              <strong>Helper:</strong> {row.helper_name ?? "—"}
            </p>
            <p>
              <strong>Vehicle:</strong> {row.truck_code}
            </p>
            <p>
              <strong>Latest location:</strong> {assignment?.latest_location_name ?? row.latest_location ?? "—"}
            </p>
            <p>
              <strong>Distance:</strong> {Math.round(displayDistanceKm * 10) / 10} km
            </p>
            <p>
              <strong>Proof photos:</strong> {proofCount}
            </p>
            {timelineEvents.length ? (
              <div>
                <strong style={{ display: "block", marginBottom: 6 }}>Delivery timeline</strong>
                <HelperUpdatesTimeline
                  events={timelineEvents}
                  operationalStatus={assignment?.helper_progress_status || row.helper_progress_status || undefined}
                  mediaSrc={(url) => uploadMediaUrl(url) || apiFullUrl(url.startsWith("/") ? url : `/${url}`)}
                  showPending={false}
                  emptyMessage="No delivery timeline updates yet."
                  title="Delivery timeline"
                />
              </div>
            ) : null}
            {(() => {
              const logs = (td?.operational_logs ?? []).filter((l) => l.trip_id === row.trip_id);
              if (!logs.length) return null;
              return (
                <div>
                  <strong style={{ display: "block", marginBottom: 6 }}>Dispatcher operational logs</strong>
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#475569", fontSize: "0.88rem" }}>
                    {logs.map((lg) => (
                      <li key={lg.id} style={{ marginBottom: "0.35rem" }}>
                        {lg.created_at
                          ? new Intl.DateTimeFormat(APP_LOCALE, {
                              timeZone: APP_TIMEZONE,
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(lg.created_at))
                          : "—"}{" "}
                        — <strong>{lg.report_type_label}</strong> ({lg.priority_level})
                        {lg.dispatcher_name ? ` · ${lg.dispatcher_name}` : ""}
                        <div style={{ marginTop: 2 }}>{lg.operational_details}</div>
                        {lg.attachment_url ? (
                          <a
                            href={apiFullUrl(lg.attachment_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: "0.82rem", color: "var(--brand-text)" }}
                          >
                            Attachment
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 16,
            padding: "0.65rem 1rem",
            borderRadius: 8,
            border: "none",
            background: "#FF9800",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
