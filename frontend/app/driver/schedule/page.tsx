"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { WorkflowApi, type Trip } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function DriverScheduleBookingsPage() {
  useRoleGuard(["driver"]);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Trip | null>(null);

  useEffect(() => {
    let cancelled = false;
    WorkflowApi.myTrips()
      .then((t) => {
        if (!cancelled) setTrips(t);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load schedule");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalKm = trips.reduce((s, t) => s + (Number(t.distance_km) || 0), 0);
  const completed = trips.filter((t) => t.status === "completed").length;

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Scheduled Bookings</h1>
        <p style={{ color: "#666666", margin: "0" }}>
          Trips assigned to you by the dispatcher — open a row for full booking and truck details.
        </p>
      </div>

      {error ? (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
        <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600" }}>ASSIGNED TRIPS</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0" }}>{trips.length}</p>
        </div>
        <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600" }}>COMPLETED</p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0" }}>{completed}</p>
        </div>
        <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600" }}>TOTAL DIST. (KM)</p>
          <p style={{ color: "#2196F3", fontSize: "2rem", fontWeight: "700", margin: "0" }}>{Math.round(totalKm * 10) / 10}</p>
        </div>
      </div>

      <div style={{ border: "1px solid #E8E8E8", borderRadius: "8px", overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 90px 1fr 140px 120px",
            padding: "1rem",
            background: "#F5F5F5",
            borderBottom: "1px solid #E8E8E8",
            gap: "1rem",
            fontWeight: 700,
            fontSize: "0.75rem",
            color: "#666",
          }}
        >
          <span>TRIP</span>
          <span>BOOKING</span>
          <span>ROUTE</span>
          <span>SCHEDULE</span>
          <span />
        </div>
        {trips.length === 0 ? (
          <p style={{ padding: "1.5rem", color: "#666", margin: 0 }}>No trips assigned yet.</p>
        ) : (
          trips.map((t, idx) => {
            const bk = t.booking;
            return (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 90px 1fr 140px 120px",
                  padding: "1rem",
                  borderBottom: idx < trips.length - 1 ? "1px solid #E8E8E8" : "none",
                  gap: "1rem",
                  alignItems: "center",
                  background: "white",
                }}
              >
                <span style={{ fontWeight: 700 }}>#{t.id}</span>
                <span>#{t.booking_id}</span>
                <span style={{ fontSize: "0.9rem", color: "#333" }}>
                  {bk ? (
                    <>
                      <strong>{bk.pickup_location.slice(0, 48)}</strong>
                      {bk.pickup_location.length > 48 ? "…" : ""}
                      <br />
                      → <strong>{bk.dropoff_location.slice(0, 48)}</strong>
                      {bk.dropoff_location.length > 48 ? "…" : ""}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span style={{ fontSize: "0.85rem" }}>
                  {bk ? (
                    <>
                      {bk.scheduled_date} <br />
                      {bk.scheduled_time_slot}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setDetail(t)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid #FF9800",
                    background: "white",
                    color: "#E65100",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  View
                </button>
              </div>
            );
          })
        )}
      </div>

      {detail ? (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 2000,
            padding: 16,
          }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              maxWidth: 560,
              width: "100%",
              padding: "1.5rem",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Booking #{detail.booking_id} · Trip #{detail.id}</h2>
            {detail.booking ? (
              <div style={{ display: "grid", gap: 8, fontSize: "0.95rem" }}>
                <p>
                  <strong>Status:</strong> {(detail.helper_progress_status || detail.status).replace(/_/g, " ")}
                </p>
                <p>
                  <strong>Customer:</strong> {detail.booking.customer_name ?? "—"}
                </p>
                <p>
                  <strong>Company:</strong> {detail.booking.customer_company_name ?? "—"}
                </p>
                <p>
                  <strong>Pickup:</strong> {detail.booking.pickup_location}
                </p>
                <p>
                  <strong>Dropoff:</strong> {detail.booking.dropoff_location}
                </p>
                <p>
                  <strong>Window:</strong> {detail.booking.scheduled_date} {detail.booking.scheduled_time_slot}
                </p>
                <p>
                  <strong>Cargo:</strong> {detail.booking.cargo_weight_tons} t
                  {detail.booking.cargo_description ? ` — ${detail.booking.cargo_description}` : ""}
                </p>
                <p>
                  <strong>Quoted:</strong> {formatPhp(detail.booking.estimated_cost)}
                </p>
                <p>
                  <strong>Paid (verified):</strong>{" "}
                  {detail.booking.paid_amount_verified != null
                    ? formatPhp(detail.booking.paid_amount_verified)
                    : "—"}
                </p>
              </div>
            ) : null}
            <p style={{ fontSize: "0.95rem" }}>
              <strong>Current location:</strong>{" "}
              {(() => {
                const locs = detail.location_updates;
                const last = locs?.length ? locs[locs.length - 1]?.location_name : null;
                return last || detail.latest_location || "No update yet";
              })()}
            </p>
            {detail.helper_name ? (
              <p style={{ fontSize: "0.95rem" }}>
                <strong>Helper:</strong> {detail.helper_name}
              </p>
            ) : null}
            {detail.truck ? (
              <p style={{ marginTop: 12 }}>
                <strong>Truck:</strong> {detail.truck.code} ({detail.truck.capacity_tons} t rated)
              </p>
            ) : null}
            <p style={{ marginTop: 12, fontSize: "0.9rem", color: "#555" }}>
              <strong>Route / distance:</strong> {Math.round((detail.distance_km || 0) * 10) / 10} km
            </p>
            <button
              type="button"
              onClick={() => setDetail(null)}
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
      ) : null}
    </div>
  );
}
