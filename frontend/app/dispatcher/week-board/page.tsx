"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatTimeShort } from "@/lib/appLocale";
import {
  WorkflowApi,
  type ScheduleTimelineEvent,
  type ScheduleTimelineResource,
  type ScheduleTimelineResponse,
  type ScheduleTimelineTripDetail,
} from "@/lib/workflowApi";

const PX_PER_HOUR = 40;
const SIDEBAR_W = 168;

const STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "payment_verification", label: "Payment / slot on hold" },
  { value: "payment_verified", label: "Payment verified" },
  { value: "assigned", label: "Assigned" },
  { value: "for_pickup", label: "For pickup" },
  { value: "picked_up", label: "Picked up" },
  { value: "en_route", label: "En route" },
  { value: "dropped_off", label: "Dropped off" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "maintenance", label: "Maintenance" },
];

function barColors(state: string): { bg: string; fg: string } {
  switch (state) {
    case "payment_verification":
      return { bg: "rgba(251, 191, 36, 0.9)", fg: "#451a03" };
    case "payment_verified":
      return { bg: "rgba(234, 179, 8, 0.85)", fg: "#422006" };
    case "assigned":
      return { bg: "rgba(37, 99, 235, 0.9)", fg: "#fff" };
    case "for_pickup":
      return { bg: "rgba(234, 88, 12, 0.9)", fg: "#fff" };
    case "picked_up":
      return { bg: "rgba(249, 115, 22, 0.9)", fg: "#fff" };
    case "en_route":
      return { bg: "rgba(79, 70, 229, 0.9)", fg: "#fff" };
    case "dropped_off":
      return { bg: "rgba(13, 148, 136, 0.9)", fg: "#fff" };
    case "completed":
      return { bg: "rgba(5, 150, 105, 0.9)", fg: "#fff" };
    case "maintenance":
      return { bg: "rgba(220, 38, 38, 0.88)", fg: "#fff" };
    case "cancelled":
      return { bg: "rgba(100, 116, 139, 0.75)", fg: "#fff" };
    default:
      return { bg: "rgba(71, 85, 105, 0.8)", fg: "#fff" };
  }
}

function fmtRange(isoStart: string, isoEnd: string): string {
  try {
    return `${formatTimeShort(isoStart)}–${formatTimeShort(isoEnd)}`;
  } catch {
    return "";
  }
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function WeekBoardPage() {
  const [mode, setMode] = useState<"day" | "week">("week");
  const [resource, setResource] = useState<"truck" | "driver">("truck");
  const [start, setStart] = useState(todayISO);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [data, setData] = useState<ScheduleTimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<ScheduleTimelineEvent | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [modalTripId, setModalTripId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ScheduleTimelineTripDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 280);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await WorkflowApi.scheduleTimeline({
        start,
        mode,
        resource,
        status: status === "all" ? undefined : status,
        q: qDebounced || undefined,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load timeline");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [start, mode, resource, status, qDebounced]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (modalTripId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalTripId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalTripId]);

  const windowMs = useMemo(() => {
    if (!data) return { start: 0, end: 0, span: 1 };
    const ws = new Date(data.window_start).getTime();
    const we = new Date(data.window_end).getTime();
    return { start: ws, end: we, span: Math.max(we - ws, 3600000) };
  }, [data]);

  const timelineWidthPx = useMemo(() => {
    if (!data) return 800;
    return Math.max(640, (data.total_hours || 24) * PX_PER_HOUR);
  }, [data]);

  const dayMarkHours = useMemo(() => {
    if (!data || data.mode !== "week") return [] as number[];
    const th = Math.max(data.total_hours || 168, 1);
    const out: number[] = [];
    for (let h = 24; h < th; h += 24) out.push(h);
    return out;
  }, [data]);

  const openTrip = async (tripId: number) => {
    setModalTripId(tripId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await WorkflowApi.scheduleTimelineTripDetail(tripId);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const eventLayout = (ev: ScheduleTimelineEvent) => {
    const t0 = new Date(ev.start).getTime();
    const t1 = new Date(ev.end).getTime();
    const left = ((t0 - windowMs.start) / windowMs.span) * 100;
    const width = Math.max(((t1 - t0) / windowMs.span) * 100, 0.35);
    return { left: `${left}%`, width: `${width}%` };
  };

  return (
    <main
      style={{
        padding: "0.75rem 0.85rem 1.25rem",
        background: "#F1F3F5",
        minHeight: "100vh",
        color: "#0F172A",
      }}
    >
      <div style={{ maxWidth: 1600, margin: "0 auto", display: "grid", gap: "0.65rem" }}>
        <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>Schedule timeline</h1>
            <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
              Live trips, maintenance, and slot holds — overlap warnings included.
            </p>
          </div>
          <Link href="/dispatcher/dashboard" style={{ fontSize: "0.8rem", fontWeight: 600, color: "#EA580C" }}>
            ← Dashboard
          </Link>
        </header>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.45rem",
            alignItems: "center",
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 10,
            padding: "0.5rem 0.65rem",
            boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
          }}
        >
          <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Range</span>
          <button
            type="button"
            onClick={() => setMode("day")}
            style={tb(mode === "day")}
          >
            Day
          </button>
          <button type="button" onClick={() => setMode("week")} style={tb(mode === "week")}>
            Week
          </button>
          <span style={{ width: 1, height: 20, background: "#E2E8F0", margin: "0 4px" }} />
          <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>View</span>
          <button type="button" onClick={() => setResource("truck")} style={tb(resource === "truck")}>
            Trucks
          </button>
          <button type="button" onClick={() => setResource("driver")} style={tb(resource === "driver")}>
            Drivers
          </button>
          <span style={{ width: 1, height: 20, background: "#E2E8F0", margin: "0 4px" }} />
          <label style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 6 }}>
            Date
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #CBD5E1" }} />
          </label>
          <button
            type="button"
            onClick={() => setStart(todayISO())}
            style={{ ...tb(false), fontSize: "0.72rem" }}
          >
            Today
          </button>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: "0.78rem" }}>
            {STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Search booking, trip, truck…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: "1 1 180px", minWidth: 140, padding: "6px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: "0.78rem" }}
          />
          {data?.conflicts?.length ? (
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#DC2626" }}>{data.conflicts.length} conflict(s)</span>
          ) : null}
        </div>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.5rem 0.65rem", borderRadius: 8, fontSize: "0.85rem" }}>{error}</div>
        )}

        {loading && !data ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748B" }}>Loading timeline…</p>
        ) : data ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
            }}
          >
            <div style={{ display: "flex", minHeight: 360 }}>
              <div
                style={{
                  width: SIDEBAR_W,
                  flexShrink: 0,
                  borderRight: "1px solid #E2E8F0",
                  background: "#FAFBFC",
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                }}
              >
                <div style={{ height: 36, borderBottom: "1px solid #E2E8F0" }} />
                {data.resources.map((r: ScheduleTimelineResource) => (
                  <div
                    key={r.id}
                    style={{
                      height: 44,
                      padding: "0 8px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      borderBottom: "1px solid #F1F5F9",
                      fontSize: "0.78rem",
                    }}
                  >
                    <div style={{ fontWeight: 800, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
                    <div style={{ fontSize: "0.65rem", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", minWidth: 0 }}>
                <div style={{ width: timelineWidthPx, position: "relative" }}>
                  <div
                    style={{
                      height: 36,
                      borderBottom: "1px solid #E2E8F0",
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                      background: "#fff",
                      display: "flex",
                      alignItems: "flex-end",
                    }}
                  >
                    {Array.from({ length: Math.ceil(data.total_hours / 4) + 1 }).map((_, i) => {
                      const hour = i * 4;
                      const th = Math.max(data.total_hours, 1);
                      if (hour > data.total_hours) return null;
                      const left = (hour / th) * 100;
                      return (
                        <div
                          key={hour}
                          style={{
                            position: "absolute",
                            left: `${left}%`,
                            bottom: 4,
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            color: "#94A3B8",
                            transform: "translateX(-2px)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          +{hour}h
                        </div>
                      );
                    })}
                  </div>

                  {data.mode === "week" &&
                    dayMarkHours.map((h) => {
                      const th = Math.max(data.total_hours, 1);
                      return (
                        <div
                          key={h}
                          style={{
                            position: "absolute",
                            top: 36,
                            height: data.resources.length * 44,
                            left: `${(h / th) * 100}%`,
                            width: 1,
                            background: "rgba(148,163,184,0.35)",
                            zIndex: 1,
                            pointerEvents: "none",
                          }}
                        />
                      );
                    })}

                  {data.resources.map((r: ScheduleTimelineResource) => {
                    const rowEvents = data.events.filter((e) => e.resource_id === r.id && e.resource_kind === data.resource);
                    const hasTrip = rowEvents.some((e) => e.type === "trip");
                    const avail = r.availability === "maintenance" ? "UNDER MAINTENANCE" : r.availability === "lane" ? "HOLDS" : "AVAILABLE";
                    return (
                      <div
                        key={r.id}
                        style={{
                          height: 44,
                          position: "relative",
                          borderBottom: "1px solid #F1F5F9",
                          background: idxEven(r.id) ? "#FDFDFE" : "#fff",
                        }}
                      >
                        {!hasTrip && rowEvents.length === 0 ? (
                          <div
                            style={{
                              position: "absolute",
                              inset: "6px 8px",
                              border: "1px dashed #CBD5E1",
                              borderRadius: 6,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.65rem",
                              fontWeight: 800,
                              color: r.availability === "maintenance" ? "#DC2626" : "#94A3B8",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {avail}
                          </div>
                        ) : null}
                        {rowEvents.map((ev) => {
                          const lay = eventLayout(ev);
                          const c = barColors(ev.state);
                          const clickable = ev.type === "trip" && ev.trip_id != null;
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              title={`${ev.title}\n${fmtRange(ev.start, ev.end)}\n${ev.subtitle}${ev.conflict ? "\n⚠ Conflict" : ""}`}
                              onMouseEnter={(e) => {
                                setHover(ev);
                                setHoverPos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => {
                                setHover(null);
                                setHoverPos(null);
                              }}
                              onClick={() => {
                                if (clickable) void openTrip(ev.trip_id!);
                              }}
                              style={{
                                position: "absolute",
                                top: 5,
                                height: 34,
                                ...lay,
                                minWidth: 4,
                                border: ev.conflict ? "2px solid #DC2626" : "1px solid rgba(255,255,255,0.25)",
                                borderRadius: 6,
                                background: c.bg,
                                color: c.fg,
                                textAlign: "left",
                                padding: "2px 6px",
                                overflow: "hidden",
                                cursor: clickable ? "pointer" : "default",
                                boxShadow: ev.conflict ? "0 0 0 1px rgba(220,38,38,0.4)" : "0 1px 2px rgba(0,0,0,0.12)",
                                zIndex: ev.conflict ? 4 : 2,
                              }}
                            >
                              <div style={{ fontSize: "0.62rem", fontWeight: 800, lineHeight: 1.1 }}>{ev.title}</div>
                              <div style={{ fontSize: "0.58rem", opacity: 0.95, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {ev.type === "trip" ? `#${ev.trip_id} · ${ev.driver_name || "—"}` : ev.subtitle}
                              </div>
                              <div style={{ fontSize: "0.55rem", opacity: 0.85 }}>{ev.trip_status || ev.state}</div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {hover && hoverPos ? (
          <div
            style={{
              position: "fixed",
              left: Math.min(hoverPos.x + 12, typeof window !== "undefined" ? window.innerWidth - 280 : 400),
              top: Math.min(hoverPos.y + 12, typeof window !== "undefined" ? window.innerHeight - 120 : 200),
              zIndex: 50,
              background: "#0F172A",
              color: "#F8FAFC",
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: "0.72rem",
              maxWidth: 280,
              pointerEvents: "none",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontWeight: 800 }}>{hover.title}</div>
            <div style={{ opacity: 0.9, marginTop: 4 }}>{fmtRange(hover.start, hover.end)}</div>
            <div style={{ opacity: 0.85, marginTop: 4 }}>{hover.subtitle}</div>
            {hover.conflict ? <div style={{ color: "#FCA5A5", marginTop: 6, fontWeight: 700 }}>Conflict: {(hover.conflict_reasons || []).join(", ")}</div> : null}
          </div>
        ) : null}

        {modalTripId != null ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
            onClick={() => setModalTripId(null)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                maxWidth: 520,
                width: "100%",
                maxHeight: "90vh",
                overflow: "auto",
                padding: "1rem 1.1rem",
                boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>Trip #{modalTripId}</h2>
                <button type="button" onClick={() => setModalTripId(null)} style={{ border: "none", background: "#F1F5F9", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>
                  Close
                </button>
              </div>
              {detailLoading ? <p style={{ margin: 0, fontSize: "0.85rem" }}>Loading…</p> : null}
              {detail ? (
                <div style={{ display: "grid", gap: 10, fontSize: "0.82rem" }}>
                  <div>
                    <strong>Customer</strong> — {detail.customer}
                    {detail.customer_email ? <div style={{ color: "#64748B" }}>{detail.customer_email}</div> : null}
                  </div>
                  <div>
                    <strong>Cargo</strong> — {detail.cargo_tons} t
                  </div>
                  <div>
                    <strong>Truck</strong> — {detail.truck?.code || "—"}
                  </div>
                  <div>
                    <strong>Driver</strong> — {detail.driver?.name || "—"}
                  </div>
                  <div>
                    <strong>Helper</strong> — {detail.helper?.name || "—"}
                  </div>
                  <div>
                    <strong>Route</strong>
                    <div style={{ color: "#475569", marginTop: 4 }}>{detail.pickup}</div>
                    <div style={{ color: "#475569" }}>→ {detail.dropoff}</div>
                  </div>
                  <div>
                    <strong>Booking</strong> — {detail.booking_status} · <strong>Trip</strong> — {detail.trip_status}
                    {detail.helper_progress ? <span> · {detail.helper_progress}</span> : null}
                  </div>
                  <div>
                    <strong>Payment</strong> — {detail.payment.status || "—"}
                    {detail.payment.amount != null ? ` · ₱${detail.payment.amount}` : ""}
                  </div>
                  <div>
                    <strong>ETA</strong> — {detail.eta ? formatTimeShort(detail.eta) : "—"}
                  </div>
                  <div>
                    <strong>Latest location</strong> — {detail.latest_location ? `${detail.latest_location.text} (${formatTimeShort(detail.latest_location.at)})` : "—"}
                  </div>
                  <div>
                    <strong>Status history</strong>
                    <ul style={{ margin: "6px 0 0", paddingLeft: "1.1rem", maxHeight: 160, overflow: "auto" }}>
                      {detail.status_history.map((h, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          <code>{h.status}</code> @ {formatTimeShort(h.at)} — {h.location}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    href={`/dispatcher/job-assignments?bookingId=${detail.booking_id}`}
                    style={{ display: "inline-block", marginTop: 8, fontWeight: 700, color: "#EA580C" }}
                  >
                    Open assignment for booking #{detail.booking_id}
                  </Link>
                </div>
              ) : !detailLoading ? (
                <p style={{ margin: 0, color: "#64748B" }}>Could not load trip details.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function tb(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 6,
    border: `1px solid ${active ? "var(--brand-text)" : "#CBD5E1"}`,
    background: active ? "var(--brand-text)" : "#fff",
    color: active ? "#fff" : "#334155",
    fontWeight: 700,
    fontSize: "0.75rem",
    cursor: "pointer",
  };
}

function idxEven(id: number): boolean {
  return id % 2 === 0;
}
