"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { WorkflowApi } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

type Row = {
  trip_id: number;
  trip_status: string;
  helper_progress_status: string | null;
  distance_km: number;
  current_latitude: number | null;
  current_longitude: number | null;
  booking: {
    id: number;
    pickup_location: string;
    dropoff_location: string;
    scheduled_date: string;
    scheduled_time_slot: string;
    cargo_weight_tons: number;
    cargo_description: string | null;
    estimated_cost: number;
    status: string;
  } | null;
  truck: { id: number; code: string; capacity_tons: number } | null;
};

const PHASES = ["for_pick_up", "picked_up", "on_route", "dropped_off", "complete_trip"] as const;

function readCoords(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Could not read GPS — enable location for this site.")),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  });
}

export default function HelperBookingsPage() {
  useRoleGuard(["helper"]);

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<(typeof PHASES)[number]>("for_pick_up");
  const [photo, setPhoto] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    WorkflowApi.helperListBookings()
      .then((r) => setRows(r.bookings as Row[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitProgress = async () => {
    if (!detail) return;
    if (!photo) {
      setMsg("Attach a JPG, PNG, or IMG photo for this update.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { lat, lng } = await readCoords();
      const fd = new FormData();
      fd.append("status", phase);
      fd.append("latitude", String(lat));
      fd.append("longitude", String(lng));
      fd.append("photo", photo);
      await WorkflowApi.helperSubmitProgress(detail.trip_id, fd);
      setMsg("Status updated.");
      setPhoto(null);
      setDetail(null);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.5rem" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: "1rem 0 0.25rem", color: "#1A1A1A" }}>Bookings</h1>
        <p style={{ color: "#666", margin: 0 }}>
          Assigned trips: update field status with photo proof and GPS. After your first fix, each further update must be at
          least <strong>3 km</strong> from your last reported position.
        </p>
      </div>

      {error ? <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div> : null}
      {msg ? <div style={{ background: "#ECFDF5", color: "#047857", padding: 12, borderRadius: 8 }}>{msg}</div> : null}

      <div style={{ border: "1px solid #E8E8E8", borderRadius: 8, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 90px 1fr 160px 100px 100px",
            padding: "0.85rem",
            background: "#F5F5F5",
            fontWeight: 700,
            fontSize: "0.75rem",
            color: "#666",
            gap: 8,
          }}
        >
          <span>TRIP</span>
          <span>BOOKING</span>
          <span>ROUTE</span>
          <span>WINDOW</span>
          <span>STATUS</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <p style={{ padding: "1rem", margin: 0, color: "#666" }}>No bookings assigned to you.</p>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.trip_id}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 90px 1fr 160px 100px 100px",
                padding: "0.85rem",
                gap: 8,
                alignItems: "center",
                borderTop: i === 0 ? undefined : "1px solid #eee",
                fontSize: "0.9rem",
              }}
            >
              <span style={{ fontWeight: 700 }}>#{r.trip_id}</span>
              <span>#{r.booking?.id ?? "—"}</span>
              <span>
                {r.booking ? (
                  <>
                    {r.booking.pickup_location.slice(0, 36)}… → {r.booking.dropoff_location.slice(0, 36)}…
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span>
                {r.booking ? `${r.booking.scheduled_date} ${r.booking.scheduled_time_slot}` : "—"}
              </span>
              <span style={{ textTransform: "capitalize" }}>{r.helper_progress_status ?? r.trip_status}</span>
              <button
                type="button"
                onClick={() => {
                  setDetail(r);
                  setPhase("for_pick_up");
                  setPhoto(null);
                  setMsg(null);
                }}
                style={{
                  padding: "0.45rem 0.65rem",
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
          ))
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
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => !busy && setDetail(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              maxWidth: 520,
              width: "100%",
              padding: "1.5rem",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Trip #{detail.trip_id}</h2>
            {detail.booking ? (
              <div style={{ display: "grid", gap: 8, fontSize: "0.95rem", marginBottom: 12 }}>
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
                  <strong>Estimate:</strong> {formatPhp(detail.booking.estimated_cost)}
                </p>
                <p>
                  <strong>Booking status:</strong> {detail.booking.status}
                </p>
              </div>
            ) : null}
            {detail.truck ? (
              <p>
                <strong>Truck:</strong> {detail.truck.code}
              </p>
            ) : null}

            <hr style={{ margin: "1rem 0", border: "none", borderTop: "1px solid #eee" }} />

            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Update status</h3>
            <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: "0.85rem", color: "#555" }}>Milestone</span>
              <select className="select" value={phase} onChange={(e) => setPhase(e.target.value as (typeof PHASES)[number])}>
                {PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: "0.85rem", color: "#555" }}>Photo proof (.jpg, .png, .img)</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.img,image/jpeg,image/png"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
            <p style={{ fontSize: "0.8rem", color: "#666", margin: "0 0 0.75rem" }}>
              GPS is captured when you submit — allow browser location. Each update after the first must move ≥ 3 km from
              the last saved point.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={busy}
                onClick={submitProgress}
                style={{
                  padding: "0.65rem 1rem",
                  borderRadius: 8,
                  border: "none",
                  background: "#FF9800",
                  color: "white",
                  fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "Submitting…" : "Submit with GPS + photo"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDetail(null)}
                style={{
                  padding: "0.65rem 1rem",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  background: "white",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
