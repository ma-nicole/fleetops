"use client";

import { useEffect, useState } from "react";
import { APP_LOCALE, APP_TIMEZONE, formatPhp } from "@/lib/appLocale";
import { WorkflowApi } from "@/lib/workflowApi";

export type TripBoardRow = Awaited<ReturnType<typeof WorkflowApi.dispatchAssignmentsBoard>>["assignments"][number];

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
  const proofCount = (assignment?.status_timeline ?? []).filter((x) => !!x.photo_url).length;
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
              <strong>Status:</strong> {(row.helper_progress_status || row.trip_status).replace(/_/g, " ")}
            </p>
            <p>
              <strong>Booking status:</strong> {td?.booking?.status ?? row.booking_status}
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
              <strong>Current location:</strong> {assignment?.latest_location_name ?? row.latest_location ?? "—"}
            </p>
            <p>
              <strong>Distance:</strong> {Math.round(displayDistanceKm * 10) / 10} km
            </p>
            <p>
              <strong>Proof photos:</strong> {proofCount}
            </p>
            {assignment?.status_timeline?.length ? (
              <div>
                <strong style={{ display: "block", marginBottom: 6 }}>Recent timeline</strong>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#475569", fontSize: "0.88rem" }}>
                  {assignment.status_timeline.slice(-10).map((ev) => (
                    <li key={`${ev.created_at}-${ev.status}-${ev.location_name}`}>
                      {new Intl.DateTimeFormat(APP_LOCALE, {
                        timeZone: APP_TIMEZONE,
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(ev.created_at))}{" "}
                      — {ev.status.replace(/_/g, " ")}
                      {ev.location_name ? ` · ${ev.location_name}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
