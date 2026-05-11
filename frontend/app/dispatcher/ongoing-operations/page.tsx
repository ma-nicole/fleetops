"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TripBoardDetailModal, type TripBoardRow } from "@/components/TripBoardDetailModal";
import { formatPhp } from "@/lib/appLocale";
import { WorkflowApi } from "@/lib/workflowApi";

export default function OngoingOperationsPage() {
  const [operations, setOperations] = useState<TripBoardRow[]>([]);
  const [detailRow, setDetailRow] = useState<TripBoardRow | null>(null);

  useEffect(() => {
    void (async () => {
      const board = await WorkflowApi.dispatchAssignmentsBoard();
      setOperations(board.assignments);
    })();
  }, []);

  const displayStatus = (a: TripBoardRow) => (a.helper_progress_status || a.trip_status).replace(/_/g, " ");

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Ongoing Operations</h1>
        <p style={{ color: "#666666", margin: "0" }}>Live board: customer, payment, routes, and trip status</p>
      </div>

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
            {operations.length}
          </p>
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
            {operations.filter((op) => (op.helper_progress_status || op.trip_status) === "en_route").length}
          </p>
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
            {operations.filter((op) => ["for_pickup", "picked_up"].includes(op.helper_progress_status || "")).length}
          </p>
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
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>COMPLETED</p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {operations.filter((op) => (op.helper_progress_status || op.trip_status) === "completed").length}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1.5rem" }}>
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
                  <strong>Paid:</strong> {op.paid_amount_verified != null ? formatPhp(op.paid_amount_verified) : "—"} ·{" "}
                  <strong>Quoted total:</strong> {formatPhp(op.estimated_cost)}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>CURRENT LOCATION</p>
                <p style={{ color: "#2196F3", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {op.latest_location ?? "No live update yet"}
                </p>
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
                  color: "#1d4ed8",
                  borderRadius: "4px",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  height: "fit-content",
                  whiteSpace: "nowrap",
                }}
              >
                {displayStatus(op)}
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
