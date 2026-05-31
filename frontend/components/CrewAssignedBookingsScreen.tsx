"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { apiFullUrl } from "@/lib/api";
import { WorkflowApi, type CrewAssignedBookingRow } from "@/lib/workflowApi";
import CrewSchedulingPlotPanel, { schedulingPlotFromCrewRow } from "@/components/CrewSchedulingPlotPanel";
import HelperUpdatesTimeline from "@/components/HelperUpdatesTimeline";
import DeliveryCompletionPanel from "@/components/DeliveryCompletionPanel";

const PHASES = ["for_pickup", "picked_up", "en_route", "dropped_off", "completed"] as const;
type Phase = (typeof PHASES)[number];
const PHOTO_REQUIRED = new Set<Phase>(["picked_up", "dropped_off"]);

function mediaSrc(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return apiFullUrl(u.startsWith("/") ? u : `/${u}`);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function truncate(s: string, max: number): string {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function operationalSlug(r: CrewAssignedBookingRow): string {
  return (r.operational_status || r.helper_progress_status || r.trip_status || "").toLowerCase();
}

function statusPillStyle(slug: string): CSSProperties {
  const base: CSSProperties = {
    display: "inline-block",
    fontSize: "0.68rem",
    fontWeight: 700,
    padding: "0.2rem 0.5rem",
    borderRadius: "999px",
    whiteSpace: "nowrap",
    border: "1px solid transparent",
    textTransform: "lowercase" as const,
  };
  switch (slug) {
    case "completed":
      return { ...base, background: "#DCFCE7", color: "#166534", borderColor: "#86EFAC" };
    case "dropped_off":
      return { ...base, background: "#E0F2FE", color: "#075985", borderColor: "#7DD3FC" };
    case "en_route":
      return { ...base, background: "#EDE9FE", color: "#5B21B6", borderColor: "#C4B5FD" };
    case "picked_up":
      return { ...base, background: "#FEF3C7", color: "#92400E", borderColor: "#FCD34D" };
    case "for_pickup":
      return { ...base, background: "#FFEDD5", color: "#9A3412", borderColor: "#FDBA74" };
    case "assigned":
      return { ...base, background: "#F1F5F9", color: "#334155", borderColor: "#CBD5E1" };
    default:
      return { ...base, background: "#F5F5F5", color: "#525252", borderColor: "#E5E5E5" };
  }
}

function routeKm(r: CrewAssignedBookingRow): number {
  const x = r.road_distance_km;
  if (typeof x === "number" && x > 0) return x;
  return Number(r.distance_km) || 0;
}

function truckPlateLine(r: CrewAssignedBookingRow): string {
  const tk = r.truck;
  if (!tk) return "—";
  const model = (tk.model_name || "").trim();
  return model ? `${tk.code} (${model})` : tk.code;
}

function workflowPhase(r: CrewAssignedBookingRow): Phase {
  const op = (r.operational_status || "").toLowerCase();
  if (op === "assigned") return "for_pickup";
  if (PHASES.includes(op as Phase)) return op as Phase;
  const hp = (r.helper_progress_status || "").toLowerCase();
  if (PHASES.includes(hp as Phase)) return hp as Phase;
  return "for_pickup";
}

function nextPhase(s: Phase): Phase | null {
  if (s === "for_pickup") return "picked_up";
  if (s === "picked_up") return "en_route";
  if (s === "en_route") return "dropped_off";
  if (s === "dropped_off") return "completed";
  return null;
}

function progressNeedsWarning(r: CrewAssignedBookingRow): boolean {
  const slug = operationalSlug(r);
  return slug === "en_route" && r.location_updates_submitted < r.required_location_updates;
}

const th: CSSProperties = {
  padding: "0.7rem 0.5rem",
  textAlign: "left",
  fontWeight: 700,
  fontSize: "0.72rem",
  color: "#64748B",
  borderBottom: "1px solid #E8E8E8",
  background: "#F8FAFC",
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "0.6rem 0.5rem",
  borderBottom: "1px solid #F1F5F9",
  fontSize: "0.78rem",
  verticalAlign: "top",
  lineHeight: 1.35,
};

const sectionTitle: CSSProperties = {
  margin: "0 0 0.5rem",
  fontSize: "0.82rem",
  fontWeight: 800,
  color: "#0f172a",
  letterSpacing: "0.02em",
};

const divider: CSSProperties = {
  border: "none",
  borderTop: "1px solid #E8E8E8",
  margin: "1rem 0",
};

export type CrewAssignedBookingsScreenProps = {
  variant: "driver" | "helper";
  dashboardHref: string;
  dashboardLabel?: string;
  pageTitle: string;
  pageSubtitle: string;
  showSummaryTiles?: boolean;
};

export default function CrewAssignedBookingsScreen({
  variant,
  dashboardHref,
  dashboardLabel = "← Dashboard",
  pageTitle,
  pageSubtitle,
  showSummaryTiles = false,
}: CrewAssignedBookingsScreenProps) {
  const [rows, setRows] = useState<CrewAssignedBookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CrewAssignedBookingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("for_pickup");
  const [photo, setPhoto] = useState<File | null>(null);
  const [locationPhoto, setLocationPhoto] = useState<File | null>(null);
  const [locationName, setLocationName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [deliveryReady, setDeliveryReady] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r =
        variant === "driver" ? await WorkflowApi.driverAssignedBookings() : await WorkflowApi.helperListBookings();
      const list = r.bookings;
      setRows(list);
      setDetail((prev) => {
        if (!prev) return null;
        return list.find((x) => x.trip_id === prev.trip_id) ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [variant]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalKm = useMemo(() => rows.reduce((s, r) => s + routeKm(r), 0), [rows]);
  const completed = useMemo(() => rows.filter((r) => operationalSlug(r) === "completed" || r.trip_status === "completed").length, [rows]);

  const submitStatus = async () => {
    if (!detail || variant !== "helper") return;
    const current = workflowPhase(detail);
    const allowed = nextPhase(current);
    if (!allowed) {
      setMsg("Trip is already completed.");
      return;
    }
    if (phase !== allowed) {
      setMsg(`Only next status is allowed: ${allowed.replace(/_/g, " ")}`);
      return;
    }
    if (phase === "dropped_off" && detail.location_updates_submitted < detail.required_location_updates) {
      setMsg(
        `Cannot set dropped off yet. Location updates submitted: ${detail.location_updates_submitted}/${detail.required_location_updates}.`,
      );
      return;
    }
    if (PHOTO_REQUIRED.has(phase) && !photo) {
      setMsg(`Photo proof is required for ${phase.replace(/_/g, " ")}.`);
      return;
    }
    if (phase === "completed" && !deliveryReady) {
      setMsg("Upload receiving document, verify QR code, and capture digital signature before completing delivery.");
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
      setDetail(null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const submitLocation = async () => {
    if (!detail || variant !== "helper") return;
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
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Location update failed");
    } finally {
      setBusy(false);
    }
  };

  const openDetail = (r: CrewAssignedBookingRow) => {
    setDetail(r);
    const current = workflowPhase(r);
    const allowed = nextPhase(current);
    setPhase(allowed ?? current);
    setPhoto(null);
    setLocationPhoto(null);
    setLocationName("");
    setRemarks("");
    setMsg(null);
    setDeliveryReady(Boolean(r.delivery_receiving?.ready_for_completion));
  };

  const detailProofs = detail?.proof_photo_urls ?? [];
  const isHelper = variant === "helper";

  const helperProofCallout = (
    <div
      style={{
        padding: "0.85rem 1rem",
        borderRadius: 10,
        border: "1px solid #BFDBFE",
        background: "#EFF6FF",
        marginBottom: "1rem",
        fontSize: "0.86rem",
        color: "#1e3a8a",
        lineHeight: 1.5,
      }}
    >
      <strong>Proof &amp; receiving documents</strong>
      <ul style={{ margin: "0.45rem 0 0", paddingLeft: "1.15rem" }}>
        <li>Photo proof (JPG/PNG) is required when marking <em>picked up</em> and <em>dropped off</em>.</li>
        <li>Submit all required location updates while <em>en route</em> before drop-off.</li>
        <li>
          Before <em>completed</em>: upload receiving document, verify trip QR code, and capture recipient digital
          signature.
        </li>
      </ul>
    </div>
  );

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.5rem" }}>
      <div>
        <Link href={dashboardHref} style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          {dashboardLabel}
        </Link>
        <h1 style={{ margin: "1rem 0 0.25rem", color: "#1A1A1A" }}>{pageTitle}</h1>
        <p style={{ color: "#666", margin: 0, maxWidth: "52rem", lineHeight: 1.5 }}>{pageSubtitle}</p>
      </div>

      {error ? <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div> : null}
      {msg ? <div style={{ background: "#ECFDF5", color: "#047857", padding: 12, borderRadius: 8 }}>{msg}</div> : null}

      {showSummaryTiles ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: 8 }}>
            <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 600 }}>ASSIGNED TRIPS</p>
            <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: 700, margin: 0 }}>{rows.length}</p>
          </div>
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: 8 }}>
            <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 600 }}>COMPLETED</p>
            <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: 700, margin: 0 }}>{completed}</p>
          </div>
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: 8 }}>
            <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 600 }}>TOTAL ROUTE (KM)</p>
            <p style={{ color: "#2196F3", fontSize: "2rem", fontWeight: 700, margin: 0 }}>{Math.round(totalKm * 10) / 10}</p>
          </div>
        </div>
      ) : null}

      <div style={{ border: "1px solid #E8E8E8", borderRadius: 8, overflow: "hidden", background: "white" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", minWidth: isHelper ? 980 : 1680, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {!isHelper ? <th style={th}>Trip ID</th> : null}
                <th style={th}>Booking ID</th>
                {!isHelper ? <th style={{ ...th, minWidth: 120 }}>Customer / Company</th> : null}
                <th style={{ ...th, minWidth: 140 }}>Pickup</th>
                <th style={{ ...th, minWidth: 140 }}>Dropoff</th>
                <th style={th}>Schedule window</th>
                <th style={{ ...th, textAlign: "right" }}>Cargo (t)</th>
                {!isHelper ? <th style={th}>Truck / plate</th> : null}
                <th style={{ ...th, minWidth: 100 }}>Driver</th>
                {!isHelper ? <th style={{ ...th, minWidth: 100 }}>Helper</th> : null}
                <th style={th}>Current status</th>
                {!isHelper ? <th style={{ ...th, minWidth: 120 }}>Latest location</th> : null}
                {!isHelper ? <th style={th}>Payment status</th> : null}
                <th style={th}>{isHelper ? "Your tasks" : "Progress updates"}</th>
                <th style={{ ...th, textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={isHelper ? 9 : 15} style={{ ...td, padding: "1.5rem", color: "#666" }}>
                    No assigned trips.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const bk = r.booking;
                  const slug = operationalSlug(r);
                  const custLine = bk
                    ? [bk.customer_name || "—", bk.customer_company_name].filter(Boolean).join(" · ")
                    : "—";
                  const warn = progressNeedsWarning(r);
                  return (
                    <tr key={r.trip_id}>
                      {!isHelper ? <td style={{ ...td, fontWeight: 700 }}>#{r.trip_id}</td> : null}
                      <td style={{ ...td, fontWeight: isHelper ? 700 : undefined }}>#{r.booking_id}</td>
                      {!isHelper ? (
                        <td style={td} title={custLine}>
                          {truncate(custLine, 40)}
                        </td>
                      ) : null}
                      <td style={td} title={bk?.pickup_location}>
                        {bk ? truncate(bk.pickup_location, 44) : "—"}
                      </td>
                      <td style={td} title={bk?.dropoff_location}>
                        {bk ? truncate(bk.dropoff_location, 44) : "—"}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {bk ? (
                          <>
                            {bk.scheduled_date}
                            <br />
                            {bk.scheduled_time_slot}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{bk ? String(bk.cargo_weight_tons) : "—"}</td>
                      {!isHelper ? (
                        <td style={td} title={truckPlateLine(r)}>
                          {truncate(truckPlateLine(r), 32)}
                        </td>
                      ) : null}
                      <td style={td} title={r.driver_name || ""}>
                        {r.driver_name ?? "—"}
                      </td>
                      {!isHelper ? (
                        <td style={td} title={r.helper_name || ""}>
                          {r.helper_name ?? "—"}
                        </td>
                      ) : null}
                      <td style={td}>
                        <span style={statusPillStyle(slug)} title={slug}>
                          {slug}
                        </span>
                      </td>
                      {!isHelper ? (
                        <td style={td} title={r.latest_location || ""}>
                          {truncate(r.latest_location || "—", 40)}
                        </td>
                      ) : null}
                      {!isHelper ? (
                        <td style={{ ...td, whiteSpace: "nowrap", textTransform: "lowercase" }} title={r.payment_status}>
                          {r.payment_status}
                        </td>
                      ) : null}
                      <td style={td}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            padding: "0.15rem 0.45rem",
                            borderRadius: 6,
                            background: warn ? "#FEF3C7" : "#F1F5F9",
                            color: warn ? "#92400E" : "#334155",
                            border: warn ? "1px solid #FCD34D" : "1px solid #E2E8F0",
                          }}
                          title={warn ? "En route: submit required location updates before drop-off." : undefined}
                        >
                          {isHelper
                            ? `Locations ${r.location_updates_submitted}/${r.required_location_updates}`
                            : `${r.location_updates_submitted}/${r.required_location_updates}`}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => openDetail(r)}
                          style={{
                            padding: "0.45rem 0.65rem",
                            borderRadius: 6,
                            border: "1px solid #FF9800",
                            background: "white",
                            color: "#E65100",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isHelper ? "Open" : "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
              maxWidth: 920,
              width: "100%",
              padding: "1.5rem 1.65rem",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              {isHelper ? `Booking #${detail.booking_id}` : `Trip #${detail.trip_id} · Booking #${detail.booking_id}`}
            </h2>
            <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#64748B", lineHeight: 1.45 }}>
              {variant === "driver"
                ? "View only — trip milestones and location updates are submitted by your helper."
                : "Your assigned leg — update milestones, locations, and proof photos below."}
            </p>

            {variant === "driver" ? (
              <CrewSchedulingPlotPanel plot={schedulingPlotFromCrewRow(detail)} />
            ) : null}

            {isHelper ? (
              <>
                {helperProofCallout}
                <div style={{ padding: "0.85rem 1rem", border: "1px solid #E8E8E8", borderRadius: 10, background: "#FAFAFA", marginBottom: "1rem" }}>
                  <h3 style={sectionTitle}>Trip details</h3>
                  {detail.booking ? (
                    <div style={{ display: "grid", gap: 6, fontSize: "0.88rem" }}>
                      <div>
                        <strong>Pickup:</strong> {detail.booking.pickup_location}
                      </div>
                      <div>
                        <strong>Dropoff:</strong> {detail.booking.dropoff_location}
                      </div>
                      <div>
                        <strong>Schedule:</strong> {detail.booking.scheduled_date} {detail.booking.scheduled_time_slot}
                      </div>
                      <div>
                        <strong>Driver:</strong> {detail.driver_name ?? "—"}
                      </div>
                      <div>
                        <strong>Cargo:</strong> {detail.booking.cargo_weight_tons} t
                        {detail.booking.cargo_description ? ` — ${detail.booking.cargo_description}` : ""}
                      </div>
                      <div>
                        <strong>Status:</strong>{" "}
                        <span style={statusPillStyle(operationalSlug(detail))}>{operationalSlug(detail)}</span>
                      </div>
                      <div>
                        <strong>Latest location:</strong> {detail.latest_location ?? "—"}
                      </div>
                      <div>
                        <strong>Location updates:</strong>{" "}
                        <span
                          style={{
                            fontWeight: 700,
                            padding: "0.1rem 0.4rem",
                            borderRadius: 6,
                            background: progressNeedsWarning(detail) ? "#FEF3C7" : "#ECFDF5",
                            color: progressNeedsWarning(detail) ? "#92400E" : "#065F46",
                          }}
                        >
                          {detail.location_updates_submitted}/{detail.required_location_updates}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "#64748B" }}>No booking details.</p>
                  )}
                </div>

                <h3 style={sectionTitle}>Helper updates timeline</h3>
                <HelperUpdatesTimeline
                  events={detail.timeline_events}
                  operationalStatus={operationalSlug(detail)}
                  locationUpdatesSubmitted={detail.location_updates_submitted}
                  requiredLocationUpdates={detail.required_location_updates}
                  mediaSrc={mediaSrc}
                />

                <h3 style={sectionTitle}>Submitted proof photos</h3>
                {detailProofs.length === 0 ? (
                  <p style={{ margin: "0 0 1rem", color: "#64748B", fontSize: "0.88rem" }}>None on file yet.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                    {detailProofs.map((ph) =>
                      ph.toLowerCase().endsWith(".pdf") ? (
                        <a
                          key={ph}
                          href={mediaSrc(ph)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-text)" }}
                        >
                          PDF proof
                        </a>
                      ) : (
                        <a key={ph} href={mediaSrc(ph)} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                          <img
                            src={mediaSrc(ph)}
                            alt="Proof"
                            style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid #E2E8F0" }}
                          />
                        </a>
                      ),
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              <div style={{ padding: "0.85rem 1rem", border: "1px solid #E8E8E8", borderRadius: 10, background: "#FAFAFA" }}>
                <h3 style={sectionTitle}>Booking &amp; customer</h3>
                {detail.booking ? (
                  <div style={{ display: "grid", gap: 6, fontSize: "0.88rem" }}>
                    <div>
                      <strong>Customer:</strong> {detail.booking.customer_name ?? "—"}
                    </div>
                    <div>
                      <strong>Company:</strong> {detail.booking.customer_company_name ?? "—"}
                    </div>
                    <div>
                      <strong>Pickup:</strong> {detail.booking.pickup_location}
                    </div>
                    <div>
                      <strong>Dropoff:</strong> {detail.booking.dropoff_location}
                    </div>
                    <div>
                      <strong>Schedule window:</strong> {detail.booking.scheduled_date} {detail.booking.scheduled_time_slot}
                    </div>
                    <div>
                      <strong>Cargo weight:</strong> {detail.booking.cargo_weight_tons} t
                      {detail.booking.cargo_description ? ` — ${detail.booking.cargo_description}` : ""}
                    </div>
                    <div>
                      <strong>Booking workflow status:</strong>{" "}
                      <span style={{ textTransform: "lowercase" }}>{detail.booking.status}</span>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "#64748B" }}>No booking payload.</p>
                )}
              </div>

              <div style={{ padding: "0.85rem 1rem", border: "1px solid #E8E8E8", borderRadius: 10, background: "#FAFAFA" }}>
                <h3 style={sectionTitle}>Payment</h3>
                <div style={{ display: "grid", gap: 6, fontSize: "0.88rem" }}>
                  <div>
                    <strong>Quoted total:</strong>{" "}
                    {detail.booking != null ? formatPhp(detail.booking.estimated_cost) : "—"}
                  </div>
                  <div>
                    <strong>Paid (verified):</strong>{" "}
                    {detail.booking?.paid_amount_verified != null ? formatPhp(detail.booking.paid_amount_verified) : "—"}
                  </div>
                  <div>
                    <strong>Latest payment record amount:</strong>{" "}
                    {detail.payment_latest_amount_php != null ? formatPhp(detail.payment_latest_amount_php) : "—"}
                  </div>
                  <div>
                    <strong>Payment status (DB):</strong>{" "}
                    <span style={{ textTransform: "lowercase", fontWeight: 700 }}>{detail.payment_status}</span>
                  </div>
                </div>
              </div>
            </div>

            <hr style={divider} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              <div style={{ padding: "0.85rem 1rem", border: "1px solid #E8E8E8", borderRadius: 10 }}>
                <h3 style={sectionTitle}>Fleet &amp; crew</h3>
                <div style={{ display: "grid", gap: 6, fontSize: "0.88rem" }}>
                  <div>
                    <strong>Truck plate:</strong> {detail.truck?.code ?? "—"}
                  </div>
                  <div>
                    <strong>Truck model:</strong> {detail.truck?.model_name?.trim() || "—"}
                  </div>
                  <div>
                    <strong>Driver:</strong> {detail.driver_name ?? "—"}
                  </div>
                  <div>
                    <strong>Helper:</strong> {detail.helper_name ?? "—"}
                  </div>
                  {detail.driver_profile ? (
                    <div>
                      <strong>Driver profile:</strong> rating {detail.driver_profile.rating.toFixed(1)} ·{" "}
                      {detail.driver_profile.compliance_status}
                    </div>
                  ) : null}
                  {detail.helper_profile ? (
                    <div>
                      <strong>Helper profile:</strong> rating {detail.helper_profile.rating.toFixed(1)}
                    </div>
                  ) : null}
                  {detail.truck_assignment_status ? (
                    <div>
                      <strong>Truck assignment status:</strong>{" "}
                      <span style={{ textTransform: "lowercase" }}>{detail.truck_assignment_status}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ padding: "0.85rem 1rem", border: "1px solid #E8E8E8", borderRadius: 10 }}>
                <h3 style={sectionTitle}>Trip execution</h3>
                <div style={{ display: "grid", gap: 6, fontSize: "0.88rem" }}>
                  <div>
                    <strong>Trip DB status:</strong>{" "}
                    <span style={{ textTransform: "lowercase" }}>{detail.trip_status}</span>
                  </div>
                  <div>
                    <strong>Operational status:</strong>{" "}
                    <span style={statusPillStyle(operationalSlug(detail))}>{operationalSlug(detail)}</span>
                  </div>
                  <div>
                    <strong>Latest location:</strong> {detail.latest_location ?? "—"}
                  </div>
                  <div>
                    <strong>Location update count:</strong> {detail.location_update_count}
                  </div>
                  <div>
                    <strong>Location updates (required leg):</strong>{" "}
                    <span
                      style={{
                        fontWeight: 700,
                        padding: "0.1rem 0.4rem",
                        borderRadius: 6,
                        background: progressNeedsWarning(detail) ? "#FEF3C7" : "#ECFDF5",
                        color: progressNeedsWarning(detail) ? "#92400E" : "#065F46",
                      }}
                    >
                      {detail.location_updates_submitted}/{detail.required_location_updates}
                    </span>
                  </div>
                  <div>
                    <strong>Route distance:</strong> {Math.round(routeKm(detail) * 10) / 10} km
                    {typeof detail.road_distance_km === "number" && detail.road_distance_km > 0
                      ? " (routed pickup→dropoff)"
                      : " (leg distance if routed km unavailable)"}
                  </div>
                  <div>
                    <strong>Completion time:</strong> {detail.completed_at ? formatWhen(detail.completed_at) : "—"}
                  </div>
                  {detail.pod_notes ? (
                    <div>
                      <strong>POD notes:</strong> {detail.pod_notes}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <hr style={divider} />

            <h3 style={sectionTitle}>Timeline (chronological)</h3>
            {detail.timeline_events.length === 0 ? (
              <p style={{ margin: "0 0 1rem", color: "#64748B", fontSize: "0.88rem" }}>No milestones or location updates yet.</p>
            ) : (
              <ul style={{ margin: "0 0 1rem", paddingLeft: "1.1rem", color: "#334155", fontSize: "0.86rem", lineHeight: 1.5 }}>
                {detail.timeline_events.map((ev, i) => (
                  <li key={`${ev.at}-${ev.kind}-${i}`} style={{ marginBottom: "0.35rem" }}>
                    <strong>{formatWhen(ev.at)}</strong> — {ev.title}
                    {ev.submitted_by ? (
                      <>
                        {" "}
                        <span style={{ color: "#64748B" }}>({ev.submitted_by})</span>
                      </>
                    ) : null}
                    {ev.detail && ev.kind === "milestone" ? ` · ${ev.detail}` : null}
                    {ev.remarks ? ` · ${ev.remarks}` : null}
                    {ev.photo_url ? (
                      <>
                        {" "}
                        ·{" "}
                        <a href={mediaSrc(ev.photo_url)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-text)" }}>
                          Photo
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <h3 style={sectionTitle}>Submitted location updates</h3>
            {detail.location_updates.length === 0 ? (
              <p style={{ margin: "0 0 1rem", color: "#64748B", fontSize: "0.88rem" }}>None yet.</p>
            ) : (
              <ul style={{ margin: "0 0 1rem", paddingLeft: "1.1rem", fontSize: "0.86rem", color: "#334155" }}>
                {detail.location_updates.map((lu, i) => (
                  <li key={lu.id ?? `${lu.created_at}-${i}`} style={{ marginBottom: "0.35rem" }}>
                    <strong>{formatWhen(lu.created_at)}</strong> — {lu.location_name}
                    {lu.submitted_by ? (
                      <span style={{ color: "#64748B" }}> ({lu.submitted_by})</span>
                    ) : null}
                    {lu.remarks ? ` · ${lu.remarks}` : null}
                    {lu.photo_url ? (
                      <>
                        {" "}
                        ·{" "}
                        <a href={mediaSrc(lu.photo_url)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-text)" }}>
                          Photo
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <h3 style={sectionTitle}>Uploaded proof photos</h3>
            {detailProofs.length === 0 ? (
              <p style={{ margin: "0 0 1rem", color: "#64748B", fontSize: "0.88rem" }}>None on file.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                {detailProofs.map((ph) =>
                  ph.toLowerCase().endsWith(".pdf") ? (
                    <a
                      key={ph}
                      href={mediaSrc(ph)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-text)" }}
                    >
                      PDF proof
                    </a>
                  ) : (
                    <a key={ph} href={mediaSrc(ph)} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                      <img
                        src={mediaSrc(ph)}
                        alt="Proof"
                        style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid #E2E8F0" }}
                      />
                    </a>
                  ),
                )}
              </div>
            )}

            {(detail.general_operational_reports?.length ?? 0) > 0 || (detail.vehicle_issue_reports?.length ?? 0) > 0 ? (
              <>
                <hr style={divider} />
                <h3 style={sectionTitle}>Operational notes &amp; reports</h3>
                {detail.general_operational_reports?.map((rep) => (
                  <div
                    key={`g-${rep.id}`}
                    style={{
                      marginBottom: "0.75rem",
                      padding: "0.65rem 0.75rem",
                      border: "1px solid #E8E8E8",
                      borderRadius: 8,
                      fontSize: "0.84rem",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      General report · {rep.category}{" "}
                      <span style={{ color: "#64748B", fontWeight: 500 }}>({rep.report_date})</span>
                    </div>
                    <div style={{ marginTop: 4 }}>{rep.description}</div>
                    {rep.notes ? <div style={{ marginTop: 4, color: "#475569" }}>{rep.notes}</div> : null}
                    {rep.attachment_url ? (
                      <a
                        href={mediaSrc(rep.attachment_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-block", marginTop: 6, color: "var(--brand-text)", fontWeight: 600 }}
                      >
                        Attachment
                      </a>
                    ) : null}
                    <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#94A3B8" }}>{formatWhen(rep.created_at)}</div>
                  </div>
                ))}
                {detail.vehicle_issue_reports?.map((rep) => (
                  <div
                    key={`v-${rep.id}`}
                    style={{
                      marginBottom: "0.75rem",
                      padding: "0.65rem 0.75rem",
                      border: "1px solid #FDE68A",
                      borderRadius: 8,
                      fontSize: "0.84rem",
                      background: "#FFFBEB",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      Vehicle issue · {rep.issue_type}{" "}
                      <span style={{ textTransform: "lowercase", color: "#92400E" }}>({rep.status})</span>
                    </div>
                    <div style={{ marginTop: 4 }}>{rep.description}</div>
                    {rep.attachment_url ? (
                      <a
                        href={mediaSrc(rep.attachment_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-block", marginTop: 6, color: "var(--brand-text)", fontWeight: 600 }}
                      >
                        Attachment
                      </a>
                    ) : null}
                    <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#94A3B8" }}>{formatWhen(rep.created_at)}</div>
                  </div>
                ))}
              </>
            ) : null}
              </>
            )}

            {variant === "helper" ? (
              <>
                <hr style={divider} />
                {(() => {
                  const current = workflowPhase(detail);
                  const allowed = nextPhase(current);
                  const needsLocationOnly = current === "en_route" && detail.location_updates_submitted < detail.required_location_updates;
                  const effectivePhase = needsLocationOnly ? "en_route" : phase;
                  const canUpdate = current !== "completed";
                  return current === "completed" ? (
                    <div>
                      <div style={{ padding: "0.75rem", borderRadius: 8, background: "#ECFDF5", color: "#065F46", fontWeight: 700 }}>
                        Trip completed — no further updates.
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setDetail(null)}
                        style={{
                          marginTop: "0.75rem",
                          padding: "0.65rem 1rem",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: "white",
                          cursor: busy ? "not-allowed" : "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 style={{ ...sectionTitle, marginTop: 0 }}>Update status</h3>
                      <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: "0.85rem", color: "#555" }}>Milestone</span>
                        <select
                          className="select"
                          value={effectivePhase}
                          onChange={(e) => setPhase(e.target.value as Phase)}
                        >
                          {PHASES.map((p) => {
                            const disabled =
                              p !== allowed ||
                              (p === "dropped_off" && detail.location_updates_submitted < detail.required_location_updates);
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
                            Submit {detail.required_location_updates} location updates while en route before dropped off.
                            Current: {detail.location_updates_submitted}/{detail.required_location_updates}.
                          </p>
                          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                            <span style={{ fontSize: "0.85rem", color: "#555" }}>Location name (required)</span>
                            <input className="input" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
                          </label>
                          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                            <span style={{ fontSize: "0.85rem", color: "#555" }}>Remarks (optional)</span>
                            <input className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                          </label>
                          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                            <span style={{ fontSize: "0.85rem", color: "#555" }}>Photo (optional)</span>
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.img,image/jpeg,image/png"
                              onChange={(e) => setLocationPhoto(e.target.files?.[0] ?? null)}
                            />
                          </label>
                        </>
                      ) : (
                        <>
                          {effectivePhase === "completed" || current === "dropped_off" ? (
                            <DeliveryCompletionPanel
                              tripId={detail.trip_id}
                              compact
                              onReadyChange={setDeliveryReady}
                            />
                          ) : null}
                          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                          <span style={{ fontSize: "0.85rem", color: "#555" }}>
                            Milestone photo (.jpg, .png) {PHOTO_REQUIRED.has(effectivePhase) ? "(required)" : "(optional)"}
                          </span>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.img,image/jpeg,image/png"
                            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                          />
                        </label>
                        </>
                      )}

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={busy || !canUpdate || (effectivePhase === "completed" && !deliveryReady)}
                          onClick={() => void (needsLocationOnly ? submitLocation() : submitStatus())}
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
                          {busy ? "Saving…" : "Save update"}
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
                          Close
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div style={{ marginTop: "1rem", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDetail(null)}
                  style={{
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
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
