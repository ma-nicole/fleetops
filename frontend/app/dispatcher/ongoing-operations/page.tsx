"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TripBoardDetailModal, type TripBoardRow } from "@/components/TripBoardDetailModal";
import { formatPhp } from "@/lib/appLocale";
import { WorkflowApi, type DispatchTripMonitoringBoardResponse } from "@/lib/workflowApi";
import { announce } from "@/lib/useAnnouncer";

const REFRESH_MS = 45_000;

function humanizeStatus(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayOperationalStatus(a: TripBoardRow): string {
  if ("operational_status" in a && a.operational_status) return humanizeStatus(a.operational_status);
  return humanizeStatus(a.helper_progress_status || a.trip_status);
}

export default function OngoingOperationsPage() {
  const [board, setBoard] = useState<DispatchTripMonitoringBoardResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailRow, setDetailRow] = useState<TripBoardRow | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await WorkflowApi.dispatchTripMonitoringBoard();
      setBoard(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load trip monitoring data.";
      setLoadError(msg);
      announce(msg, "assertive");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const operations = board?.active_assignments ?? [];
  const summary = board?.summary;

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Ongoing Operations</h1>
        <p style={{ color: "#666666", margin: "0" }}>
          Live board from the database — one row per active trip leg (multi-truck bookings show every leg). Refreshes
          every {REFRESH_MS / 1000}s.
        </p>
        {board?.generated_at ? (
          <p style={{ color: "#94A3B8", margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
            Last snapshot: {new Date(board.generated_at).toLocaleString()}
          </p>
        ) : null}
      </div>

      {loadError ? (
        <div role="alert" style={{ padding: "0.85rem 1rem", borderRadius: "8px", background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
          {loadError}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "#F9F9F9",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ACTIVE</p>
          <p style={{ color: "#FF6B6B", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {loading ? "—" : (summary?.active_legs ?? 0)}
          </p>
          <p style={{ color: "#94A3B8", fontSize: "0.7rem", margin: "0.35rem 0 0" }}>Non-completed legs</p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "#F9F9F9",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>IN TRANSIT</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {loading ? "—" : (summary?.in_transit_legs ?? 0)}
          </p>
          <p style={{ color: "#94A3B8", fontSize: "0.7rem", margin: "0.35rem 0 0" }}>Picked up · En route</p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "#F9F9F9",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LOADING/UNLOADING</p>
          <p style={{ color: "#FFC107", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {loading ? "—" : (summary?.loading_unloading_legs ?? 0)}
          </p>
          <p style={{ color: "#94A3B8", fontSize: "0.7rem", margin: "0.35rem 0 0" }}>For pickup · Dropped off</p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "#F9F9F9",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>COMPLETED (TODAY)</p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {loading ? "—" : (summary?.completed_trip_legs_today ?? 0)}
          </p>
          <p style={{ color: "#94A3B8", fontSize: "0.7rem", margin: "0.35rem 0 0" }}>
            All-time legs: {summary?.completed_trip_legs_total ?? 0} · Bookings fully closed: {summary?.bookings_all_legs_completed ?? 0}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1.5rem" }}>
        {!loading && operations.length === 0 && !loadError ? (
          <p style={{ color: "#64748B", margin: 0 }}>No active trip legs right now.</p>
        ) : null}
        {operations.map((op) => (
          <div
            key={op.trip_id}
            style={{
              padding: "1.5rem",
              border: "2px solid #FFB74D",
              borderRadius: "8px",
              background: "#F9F9F9",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto auto",
                gap: "1rem",
                marginBottom: "1rem",
                alignItems: "start",
              }}
            >
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0" }}>Trip #{op.trip_id}</h3>
                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  Booking #{op.booking_id} · {op.driver_name ?? "No driver"} · {op.truck_code} · Helper: {op.helper_name ?? "—"}
                </p>
                <p style={{ color: "#444", fontSize: "0.88rem", margin: "0.5rem 0 0" }}>
                  <strong>Customer:</strong> {op.customer_name ?? "—"}
                  {op.customer_company_name ? ` · ${op.customer_company_name}` : ""}
                </p>
                <p style={{ color: "#444", fontSize: "0.88rem", margin: "0.25rem 0 0" }}>
                  <strong>Paid (verified):</strong> {op.paid_amount_verified != null ? formatPhp(op.paid_amount_verified) : "—"} ·{" "}
                  <strong>Quoted total:</strong> {formatPhp(op.estimated_cost)}
                </p>
                <p style={{ color: "#444", fontSize: "0.88rem", margin: "0.25rem 0 0" }}>
                  <strong>Payment / booking record:</strong> {humanizeStatus(op.booking_db_status)}
                </p>
                <p style={{ color: "#444", fontSize: "0.88rem", margin: "0.25rem 0 0" }}>
                  <strong>Customer-facing status:</strong> {humanizeStatus(op.booking_status)}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LATEST LOCATION</p>
                <p style={{ color: "#2196F3", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{op.latest_location?.trim() || "—"}</p>
                {op.last_updated ? (
                  <p style={{ color: "#94A3B8", fontSize: "0.75rem", margin: "0.35rem 0 0" }}>
                    Updated {new Date(op.last_updated).toLocaleString()}
                  </p>
                ) : null}
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TIMELINE</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {op.scheduled_date} {op.scheduled_time_slot}
                </p>
              </div>

              <span
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "rgba(37,99,235,0.12)",
                  color: "var(--brand-text-strong)",
                  borderRadius: "4px",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  height: "fit-content",
                  whiteSpace: "nowrap",
                }}
              >
                {displayOperationalStatus(op)}
              </span>

              <button
                type="button"
                onClick={() => setDetailRow(op)}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid #FF9800",
                  background: "white",
                  color: "#E65100",
                  fontWeight: 700,
                  cursor: "pointer",
                  height: "fit-content",
                  whiteSpace: "nowrap",
                }}
              >
                View details
              </button>
            </div>

            <div
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #E8E8E8",
                marginBottom: "0",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "center" }}>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PICKUP</p>
                  <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{op.pickup_location}</p>
                </div>
                <p style={{ color: "#999", margin: "0" }}>→</p>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DELIVERY</p>
                  <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{op.dropoff_location}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <TripBoardDetailModal row={detailRow} onClose={() => setDetailRow(null)} />
    </div>
  );
}
