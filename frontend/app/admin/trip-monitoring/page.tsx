"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TripBoardDetailModal } from "@/components/TripBoardDetailModal";
import { formatPhp } from "@/lib/appLocale";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi } from "@/lib/workflowApi";

type BoardRow = Awaited<ReturnType<typeof WorkflowApi.dispatchAssignmentsBoard>>["assignments"][number];

type SortKey = "trip" | "booking" | "status" | "customer";

export default function AdminTripMonitoringPage() {
  useRoleGuard(["admin", "manager"]);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [detailRow, setDetailRow] = useState<BoardRow | null>(null);

  const load = useCallback(async () => {
    const board = await WorkflowApi.dispatchAssignmentsBoard();
    setRows(board.assignments);
  }, []);

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, [load]);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  };

  const sortedTrips = useMemo(() => {
    if (!sortKey) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "trip") return (a.trip_id - b.trip_id) * dir;
      if (sortKey === "booking") return (a.booking_id - b.booking_id) * dir;
      if (sortKey === "customer") return ((a.customer_name || "").localeCompare(b.customer_name || "")) * dir;
      return (a.trip_status + (a.helper_progress_status || "")).localeCompare(b.trip_status + (b.helper_progress_status || "")) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const thBtn: React.CSSProperties = {
    border: "none",
    background: "transparent",
    padding: 0,
    font: "inherit",
    fontWeight: 600,
    color: "#111827",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div>
          <Link href="/admin/payment-approval" style={{ color: "#0EA5E9", textDecoration: "none" }}>
            ← Payment approval
          </Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Trip Execution & Monitoring</h1>
          <p style={{ margin: 0, color: "#64748B", fontSize: "0.95rem" }}>
            Assigned trips with customer, route, payment, and live location. Use View details per row.
          </p>
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E8E8E8" }}>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>
                  <button type="button" style={thBtn} onClick={() => toggleSort("trip")}>
                    Trip
                    <span style={{ fontSize: "0.85rem", opacity: sortKey === "trip" ? 1 : 0.35 }} aria-hidden>
                      {sortKey === "trip" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                    </span>
                  </button>
                </th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>
                  <button type="button" style={thBtn} onClick={() => toggleSort("customer")}>
                    Customer
                    <span style={{ fontSize: "0.85rem", opacity: sortKey === "customer" ? 1 : 0.35 }} aria-hidden>
                      {sortKey === "customer" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                    </span>
                  </button>
                </th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Company</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Pickup / Dropoff</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Paid</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Driver</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Helper</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Vehicle</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Location</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>
                  <button type="button" style={thBtn} onClick={() => toggleSort("booking")}>
                    Booking
                    <span style={{ fontSize: "0.85rem", opacity: sortKey === "booking" ? 1 : 0.35 }} aria-hidden>
                      {sortKey === "booking" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                    </span>
                  </button>
                </th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>
                  <button type="button" style={thBtn} onClick={() => toggleSort("status")}>
                    Status
                    <span style={{ fontSize: "0.85rem", opacity: sortKey === "status" ? 1 : 0.35 }} aria-hidden>
                      {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                    </span>
                  </button>
                </th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}> </th>
              </tr>
            </thead>
            <tbody>
              {sortedTrips.map((trip) => (
                <tr key={trip.trip_id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 700 }}>#{trip.trip_id}</td>
                  <td style={{ padding: "0.75rem" }}>{trip.customer_name ?? "—"}</td>
                  <td style={{ padding: "0.75rem", color: "#475569", fontSize: "0.88rem" }}>
                    {trip.customer_company_name ?? "—"}
                  </td>
                  <td style={{ padding: "0.75rem", maxWidth: 220, fontSize: "0.82rem", color: "#334155" }}>
                    <div title={trip.pickup_location}>
                      {trip.pickup_location.slice(0, 42)}
                      {trip.pickup_location.length > 42 ? "…" : ""}
                    </div>
                    <div style={{ color: "#94A3B8" }}>→</div>
                    <div title={trip.dropoff_location}>
                      {trip.dropoff_location.slice(0, 42)}
                      {trip.dropoff_location.length > 42 ? "…" : ""}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem", whiteSpace: "nowrap", fontWeight: 600 }}>
                    {trip.paid_amount_verified != null ? formatPhp(trip.paid_amount_verified) : "—"}
                  </td>
                  <td style={{ padding: "0.75rem" }}>{trip.driver_name ?? "—"}</td>
                  <td style={{ padding: "0.75rem" }}>{trip.helper_name ?? "—"}</td>
                  <td style={{ padding: "0.75rem" }}>{trip.truck_code}</td>
                  <td style={{ padding: "0.75rem", maxWidth: 140, fontSize: "0.85rem" }}>
                    {trip.latest_location ?? "No update yet"}
                  </td>
                  <td style={{ padding: "0.75rem" }}>#{trip.booking_id}</td>
                  <td style={{ padding: "0.75rem", textTransform: "capitalize" }}>
                    {(trip.helper_progress_status || trip.trip_status).replace(/_/g, " ")}
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <button
                      type="button"
                      title="View full details"
                      aria-label="View details"
                      onClick={() => setDetailRow(trip)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "0.4rem 0.65rem",
                        borderRadius: 8,
                        border: "1px solid #CBD5E1",
                        background: "#F8FAFC",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#0F172A",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <TripBoardDetailModal row={detailRow} onClose={() => setDetailRow(null)} />
    </main>
  );
}
