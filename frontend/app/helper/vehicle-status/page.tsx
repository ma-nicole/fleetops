"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WorkflowApi, type Trip } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function HelperVehicleStatusPage() {
  useRoleGuard(["helper"]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    WorkflowApi.myTrips()
      .then((t) => {
        if (!cancelled) setTrips(t);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load trips");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.25rem", maxWidth: 900 }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: "1rem 0 0.25rem", color: "#1A1A1A" }}>Vehicle status</h1>
        <p style={{ color: "#666", margin: 0, lineHeight: 1.55 }}>
          Helpers do not submit vehicle issue reports (driver workflow). Below are trucks on your assigned trips from
          the database. Ask the assigned driver to file a formal report if something is wrong with the unit.
        </p>
      </div>

      {error ? (
        <div role="alert" style={{ background: "#FEF2F2", color: "#991B1B", padding: 12, borderRadius: 8 }}>
          {error}
        </div>
      ) : null}

      <div style={{ border: "1px solid #E8E8E8", borderRadius: 8, overflow: "hidden" }}>
        <div
          className="helper-vehicle-status-grid"
          style={{
            padding: "0.75rem",
            background: "#F5F5F5",
            fontWeight: 700,
            fontSize: "0.75rem",
            color: "#666",
          }}
        >
          <span>Trip</span>
          <span>Booking</span>
          <span>Plate / model</span>
          <span>Fleet status</span>
          <span>Operational</span>
        </div>
        {trips.length === 0 ? (
          <p style={{ padding: "1rem", margin: 0, color: "#666" }}>No trips assigned.</p>
        ) : (
          trips.map((t, i) => {
            const tk = t.truck;
            const line = tk ? `${tk.code}${tk.model_name ? ` (${tk.model_name})` : ""}` : "—";
            const op = (t.operational_status || t.helper_progress_status || t.status || "").toLowerCase();
            return (
              <div
                key={t.id}
                className="helper-vehicle-status-grid"
                style={{
                  padding: "0.75rem",
                  borderTop: i === 0 ? undefined : "1px solid #eee",
                  fontSize: "0.88rem",
                }}
              >
                <span style={{ fontWeight: 700 }}>#{t.id}</span>
                <span>#{t.booking_id}</span>
                <span>{line}</span>
                <span style={{ textTransform: "lowercase" }}>
                  {(tk?.status || "—").replace(/_/g, " ")}
                  {tk?.availability_status ? ` · ${tk.availability_status}` : ""}
                </span>
                <span style={{ textTransform: "lowercase" }}>{op}</span>
              </div>
            );
          })
        )}
      </div>

      <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748B" }}>
        Need trip updates? Go to{" "}
        <Link href="/helper/bookings" style={{ color: "#EA580C", fontWeight: 600 }}>
          Bookings
        </Link>
        .
      </p>
    </div>
  );
}
