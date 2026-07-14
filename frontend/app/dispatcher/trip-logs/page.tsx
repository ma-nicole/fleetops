"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiFullUrl, uploadMediaUrl } from "@/lib/api";
import { DispatchApi, type TripLogRow, type TripLogTimelineEntry } from "@/lib/dispatchApi";
import { announce } from "@/lib/useAnnouncer";
import StatusBanner from "@/components/ui/StatusBanner";

function mediaSrc(url: string): string {
  return uploadMediaUrl(url) || apiFullUrl(url.startsWith("/") ? url : `/${url}`);
}

function kindAccent(kind: TripLogTimelineEntry["kind"]): { border: string; dot: string; label: string } {
  switch (kind) {
    case "milestone":
      return { border: "#94A3B8", dot: "#64748B", label: "Milestone" };
    case "helper_status":
      return { border: "#F59E0B", dot: "#D97706", label: "Helper" };
    case "location_ping":
      return { border: "var(--accent)", dot: "var(--brand-text)", label: "Location" };
    case "issue":
      return { border: "#EF4444", dot: "#DC2626", label: "Issue" };
    case "delivery_proof":
      return { border: "#22C55E", dot: "#16A34A", label: "Proof" };
    case "operational_log":
      return { border: "#7C3AED", dot: "#6D28D9", label: "Dispatcher log" };
    default:
      return { border: "#CBD5E1", dot: "#94A3B8", label: "Event" };
  }
}

function formatWhen(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TripLogsPage() {
  const [rows, setRows] = useState<TripLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await DispatchApi.tripLogs();
      setRows(data.trips ?? []);
      announce(`Loaded ${data.trips?.length ?? 0} trip logs`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load trip logs.";
      setErr(msg);
      announce(msg, "assertive");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.5rem", maxWidth: "1100px" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", margin: "1rem 0 0.35rem", fontSize: "1.65rem" }}>Trip Logs</h1>
        <p style={{ color: "#64748B", margin: 0, maxWidth: "52rem", lineHeight: 1.55 }}>
          Centralized operational history per trip leg: milestones, helper progress, location pings, issues, delivery
          proof, dispatcher operational logs, and remarks — newest activity first within each trip.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            background: "#fff",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            color: "#1A1A1A",
          }}
        >
          Refresh
        </button>
        {loading ? <span style={{ color: "#64748B", fontSize: "0.9rem" }}>Loading…</span> : null}
      </div>

      {err ? <StatusBanner tone="error">{err}</StatusBanner> : null}

      {!loading && !err && rows.length === 0 ? (
        <div style={{ padding: "2rem", borderRadius: "10px", border: "1px dashed #CBD5E1", color: "#64748B", textAlign: "center" }}>
          No trip legs found in the recent history window.
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "1rem" }}>
        {rows.map((trip) => {
          const open = openId === trip.trip_id;
          const routeLabel = [trip.pickup, trip.dropoff].filter(Boolean).join(" → ") || "—";
          const statusLine = [trip.trip_status, trip.helper_progress_status].filter(Boolean).join(" · ");

          return (
            <article
              key={trip.trip_id}
              style={{
                borderRadius: "12px",
                border: "1px solid #E8E8E8",
                background: "#fff",
                boxShadow: open ? "0 4px 20px rgba(15,23,42,0.06)" : "none",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenId(open ? null : trip.trip_id);
                  announce(open ? "Trip log collapsed" : `Trip ${trip.trip_id} log expanded`);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "1rem 1.15rem",
                  border: "none",
                  background: open ? "#FFFBF5" : "#FAFAFA",
                  cursor: "pointer",
                  display: "grid",
                  gap: "0.35rem",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem", alignItems: "baseline" }}>
                  <span style={{ fontWeight: 700, color: "#1A1A1A", fontSize: "1.02rem" }}>
                    Trip #{trip.trip_id}
                    <span style={{ fontWeight: 500, color: "#64748B", marginLeft: "0.65rem" }}>Booking #{trip.booking_id}</span>
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#64748B" }}>{open ? "Hide timeline ▲" : "Show timeline ▼"}</span>
                </div>
                <div style={{ fontSize: "0.92rem", color: "#334155", lineHeight: 1.45 }}>
                  <strong style={{ fontWeight: 600 }}>{trip.truck_code ?? "—"}</strong>
                  {" · "}
                  {trip.driver_name ?? "—"}
                  {trip.helper_name ? ` · Helper: ${trip.helper_name}` : ""}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#475569" }}>{routeLabel}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginTop: "0.15rem" }}>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "0.2rem 0.55rem",
                      borderRadius: "999px",
                      background: "rgba(255,152,0,0.15)",
                      color: "#C2410C",
                      border: "1px solid rgba(251,146,60,0.45)",
                    }}
                  >
                    {statusLine || "—"}
                  </span>
                  {trip.latest_location ? (
                    <span style={{ fontSize: "0.82rem", color: "#64748B" }}>Latest: {trip.latest_location}</span>
                  ) : null}
                  {trip.completed_at ? (
                    <span style={{ fontSize: "0.82rem", color: "#15803D" }}>Completed {formatWhen(trip.completed_at)}</span>
                  ) : null}
                </div>
              </button>

              {open ? (
                <div style={{ padding: "1rem 1.15rem 1.25rem", borderTop: "1px solid #F1F5F9" }}>
                  {trip.timeline.length === 0 ? (
                    <p style={{ margin: 0, color: "#64748B", fontSize: "0.9rem" }}>No detailed events recorded for this leg yet.</p>
                  ) : (
                    <div style={{ position: "relative", paddingLeft: "1.1rem" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: "6px",
                          top: "4px",
                          bottom: "4px",
                          width: "2px",
                          background: "linear-gradient(#E2E8F0, #F8FAFC)",
                          borderRadius: "2px",
                        }}
                      />
                      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.85rem" }}>
                        {trip.timeline.map((ev, idx) => {
                          const acc = kindAccent(ev.kind);
                          return (
                            <li key={`${ev.at}-${idx}`} style={{ position: "relative", paddingLeft: "0.5rem" }}>
                              <span
                                style={{
                                  position: "absolute",
                                  left: "-5px",
                                  top: "6px",
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "50%",
                                  background: acc.dot,
                                  border: "2px solid #fff",
                                  boxShadow: "0 0 0 1px " + acc.border,
                                }}
                              />
                              <div
                                style={{
                                  borderLeft: `3px solid ${acc.border}`,
                                  padding: "0.65rem 0.85rem",
                                  borderRadius: "8px",
                                  background: "#F8FAFC",
                                }}
                              >
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                                  <time style={{ fontSize: "0.8rem", color: "#64748B", fontWeight: 600 }}>{formatWhen(ev.at)}</time>
                                  <span
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      color: acc.dot,
                                    }}
                                  >
                                    {acc.label}
                                  </span>
                                  {ev.kind === "issue" && ev.severity ? (
                                    <span style={{ fontSize: "0.72rem", color: "#B91C1C" }}>{ev.severity}</span>
                                  ) : null}
                                  {ev.kind === "operational_log" && ev.priority ? (
                                    <span style={{ fontSize: "0.72rem", color: "#5B21B6" }}>{ev.priority}</span>
                                  ) : null}
                                  {ev.kind === "issue" && typeof ev.resolved === "boolean" ? (
                                    <span style={{ fontSize: "0.72rem", color: ev.resolved ? "#15803D" : "#B45309" }}>
                                      {ev.resolved ? "Resolved" : "Open"}
                                    </span>
                                  ) : null}
                                </div>
                                <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.92rem" }}>{ev.label}</div>
                                {ev.actor ? (
                                  <div style={{ fontSize: "0.8rem", color: "#64748B", marginTop: "0.15rem" }}>{ev.actor}</div>
                                ) : null}
                                {ev.detail ? (
                                  <p style={{ margin: "0.35rem 0 0", fontSize: "0.88rem", color: "#475569", lineHeight: 1.5 }}>{ev.detail}</p>
                                ) : null}
                                {ev.photos.length > 0 ? (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.5rem" }}>
                                    {ev.photos.map((ph) =>
                                      ph.toLowerCase().endsWith(".pdf") ? (
                                        <a
                                          key={ph}
                                          href={mediaSrc(ph)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-text)" }}
                                        >
                                          View PDF attachment
                                        </a>
                                      ) : (
                                        <a
                                          key={ph}
                                          href={mediaSrc(ph)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ display: "block" }}
                                        >
                                          <img
                                            src={mediaSrc(ph)}
                                            alt="Delivery or checkpoint proof"
                                            style={{
                                              width: "72px",
                                              height: "72px",
                                              objectFit: "cover",
                                              borderRadius: "8px",
                                              border: "1px solid #E2E8F0",
                                            }}
                                          />
                                        </a>
                                      ),
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
