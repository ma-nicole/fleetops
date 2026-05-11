"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { WorkflowApi, type TripBookingSummary } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

type Row = {
  trip_id: number;
  trip_status: string;
  helper_progress_status: string | null;
  location_updates_submitted: number;
  required_location_updates: number;
  latest_location_name: string | null;
  driver_name: string | null;
  recent_locations: Array<{
    location_name: string;
    remarks: string | null;
    photo_url: string | null;
    created_at: string;
  }>;
  distance_km: number;
  latest_location: string | null;
  booking: TripBookingSummary | null;
  truck: { id: number; code: string; capacity_tons: number } | null;
};

const PHASES = ["for_pickup", "picked_up", "en_route", "dropped_off", "completed"] as const;
const PHOTO_REQUIRED = new Set(["picked_up", "dropped_off"]);

export default function HelperBookingsPage() {
  useRoleGuard(["helper"]);

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<(typeof PHASES)[number]>("for_pickup");
  const [photo, setPhoto] = useState<File | null>(null);
  const [locationPhoto, setLocationPhoto] = useState<File | null>(null);
  const [locationName, setLocationName] = useState("");
  const [remarks, setRemarks] = useState("");
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

  const normalizeStatus = (s: string | null | undefined): (typeof PHASES)[number] => {
    const v = (s ?? "").toLowerCase() as (typeof PHASES)[number];
    return PHASES.includes(v) ? v : "for_pickup";
  };

  const nextStatus = (s: (typeof PHASES)[number]): (typeof PHASES)[number] | null => {
    if (s === "for_pickup") return "picked_up";
    if (s === "picked_up") return "en_route";
    if (s === "en_route") return "dropped_off";
    if (s === "dropped_off") return "completed";
    return null;
  };

  const submitStatus = async () => {
    if (!detail) return;
    const current = normalizeStatus(detail.helper_progress_status ?? detail.trip_status);
    const allowed = nextStatus(current);
    if (!allowed) {
      setMsg("Trip is already completed.");
      return;
    }
    if (phase !== allowed) {
      setMsg(`Only next status is allowed: ${allowed.replace(/_/g, " ")}`);
      return;
    }
    if (phase === "dropped_off" && detail.location_updates_submitted < 3) {
      setMsg(`Cannot set dropped off yet. Location updates submitted: ${detail.location_updates_submitted}/3.`);
      return;
    }
    if (PHOTO_REQUIRED.has(phase) && !photo) {
      setMsg(`Photo proof is required for ${phase.replace(/_/g, " ")}.`);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("status", phase);
      fd.append("location_name", "");
      if (photo) fd.append("photo", photo);
      await WorkflowApi.helperSubmitProgress(detail.trip_id, fd);
      setMsg("Update saved.");
      setPhoto(null);
      await load();
      setDetail(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const submitLocation = async () => {
    if (!detail) return;
    if (!locationName.trim()) {
      setMsg("Location name is required.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("location_name", locationName.trim());
      fd.append("remarks", remarks.trim());
      if (locationPhoto) fd.append("photo", locationPhoto);
      await WorkflowApi.helperSubmitLocation(detail.trip_id, fd);
      setMsg("Location update saved.");
      setLocationPhoto(null);
      setLocationName("");
      setRemarks("");
      await load();
      setDetail((prev) => (prev ? { ...prev, location_updates_submitted: prev.location_updates_submitted + 1 } : prev));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Location update failed");
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
          Assigned trips with real-time helper-controlled status and location updates.
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
              <span style={{ textTransform: "capitalize" }}>{(r.helper_progress_status ?? r.trip_status).replace(/_/g, " ")}</span>
              <button
                type="button"
                onClick={() => {
                  setDetail(r);
                  const current = normalizeStatus(r.helper_progress_status ?? r.trip_status);
                  const allowed = nextStatus(current);
                  setPhase(allowed ?? current);
                  setPhoto(null);
                  setLocationPhoto(null);
                  setLocationName("");
                  setRemarks("");
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
                  <strong>Quoted total:</strong> {formatPhp(detail.booking.estimated_cost)}
                </p>
                <p>
                  <strong>Paid (verified):</strong>{" "}
                  {detail.booking.paid_amount_verified != null
                    ? formatPhp(detail.booking.paid_amount_verified)
                    : "—"}
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
            <p>
              <strong>Driver:</strong> {detail.driver_name ?? "—"}
            </p>
            <p>
              <strong>Current status:</strong> {(detail.helper_progress_status ?? detail.trip_status).replace(/_/g, " ")}
            </p>
            <p>
              <strong>Current location:</strong>{" "}
              {detail.latest_location_name ?? detail.latest_location ?? "No update yet"}
            </p>
            <p>
              <strong>Location updates submitted:</strong> {detail.location_updates_submitted}/{detail.required_location_updates}
            </p>

            <hr style={{ margin: "1rem 0", border: "none", borderTop: "1px solid #eee" }} />

            {(() => {
              const current = normalizeStatus(detail.helper_progress_status ?? detail.trip_status);
              const allowed = nextStatus(current);
              const needsLocationOnly = current === "en_route" && detail.location_updates_submitted < 3;
              const effectivePhase =
                needsLocationOnly ? "en_route" : (phase as (typeof PHASES)[number]);
              const canUpdate = current !== "completed";
              return (
                <>
                  {current === "completed" ? (
                    <div style={{ padding: "0.75rem", borderRadius: 8, background: "#ECFDF5", color: "#065F46", fontWeight: 700 }}>
                      Trip Completed
                    </div>
                  ) : (
                    <>
                      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Update status</h3>
                      <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: "0.85rem", color: "#555" }}>Milestone</span>
                        <select
                          className="select"
                          value={effectivePhase}
                          onChange={(e) => setPhase(e.target.value as (typeof PHASES)[number])}
                        >
                          {PHASES.map((p) => {
                            const disabled = p !== allowed || (p === "dropped_off" && detail.location_updates_submitted < 3);
                            return (
                              <option key={p} value={p} disabled={disabled}>
                                {p.replace(/_/g, " ")}
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      {needsLocationOnly ? (
                        <>
                          <p style={{ fontSize: "0.82rem", color: "#1E40AF", margin: "0 0 0.65rem" }}>
                            Submit 3 location updates first before dropped off. Current: {detail.location_updates_submitted}/3.
                          </p>
                          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                            <span style={{ fontSize: "0.85rem", color: "#555" }}>Real location name (required)</span>
                            <input
                              className="input"
                              value={locationName}
                              onChange={(e) => setLocationName(e.target.value)}
                              placeholder="e.g., Timog Ave, Quezon City"
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                            <span style={{ fontSize: "0.85rem", color: "#555" }}>Remarks (optional)</span>
                            <input
                              className="input"
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                              placeholder="Traffic moderate near EDSA"
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                            <span style={{ fontSize: "0.85rem", color: "#555" }}>Location photo (optional)</span>
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.img,image/jpeg,image/png"
                              onChange={(e) => setLocationPhoto(e.target.files?.[0] ?? null)}
                            />
                          </label>
                        </>
                      ) : (
                        <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                          <span style={{ fontSize: "0.85rem", color: "#555" }}>
                            Photo proof (.jpg, .png, .img) {PHOTO_REQUIRED.has(effectivePhase) ? "(required)" : "(optional)"}
                          </span>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.img,image/jpeg,image/png"
                            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                          />
                        </label>
                      )}

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={busy || !canUpdate}
                          onClick={needsLocationOnly ? submitLocation : submitStatus}
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
                          {busy ? "Saving..." : "Save Update"}
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
                    </>
                  )}
                </>
              );
            })()}
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: "0.82rem", margin: "0 0 0.4rem", color: "#555" }}>Recent location updates</p>
              <div style={{ display: "grid", gap: 6 }}>
                {(detail.recent_locations ?? []).map((x) => (
                  <div key={`${x.created_at}-${x.location_name}`} style={{ fontSize: "0.82rem", color: "#444" }}>
                    {new Date(x.created_at).toLocaleString()} - {x.location_name}
                  </div>
                ))}
                {(detail.recent_locations ?? []).length === 0 ? (
                  <div style={{ fontSize: "0.82rem", color: "#777" }}>No location updates yet.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
