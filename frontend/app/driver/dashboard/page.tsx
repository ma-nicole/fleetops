"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardRoleTabs from "@/components/DashboardRoleTabs";
import KpiCard from "@/components/KpiCard";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Trip } from "@/lib/workflowApi";
import { formatDateTime, formatPhpWhole } from "@/lib/appLocale";
import { announce } from "@/lib/useAnnouncer";
import { ApiError } from "@/lib/api";

type SalaryPayload = {
  user_id: number;
  role: string;
  base_salary: number;
  deductions: number;
  net_salary: number;
  rating?: number;
  compliance_status?: string;
};

const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1.25rem",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

function formatRoute(t: Trip): string {
  if (t.route_path && t.route_path.trim()) return t.route_path;
  return `Booking ${t.booking_id}`;
}

export default function DriverDashboardPage() {
  useRoleGuard(["driver", "helper"]);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [salary, setSalary] = useState<SalaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInOk, setCheckInOk] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [t, s] = await Promise.all([
        WorkflowApi.myTrips(),
        WorkflowApi.driverSalary().catch(() => null) as Promise<SalaryPayload | null>,
      ]);
      setTrips(t);
      setSalary(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const accept = async (id: number) => {
    setBusy(id);
    try {
      await WorkflowApi.acceptJob(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setBusy(null);
    }
  };

  const checkIn = async () => {
    setError(null);
    setCheckInOk(null);
    setCheckInBusy(true);
    try {
      await WorkflowApi.driverCheckIn();
      await refresh();
      const msg = "Check-in recorded for this shift.";
      setCheckInOk(msg);
      announce(msg, "polite");
      window.setTimeout(() => setCheckInOk(null), 6000);
    } catch (err) {
      let msg = "Check-in could not be recorded.";
      if (err instanceof ApiError) {
        try {
          const parsed = JSON.parse(err.body) as { detail?: unknown };
          const d = parsed.detail;
          if (typeof d === "string") msg = d;
        } catch {
          if (err.body) msg = err.body.slice(0, 240);
        }
      } else if (err instanceof Error) msg = err.message;
      setError(msg);
      announce(msg, "assertive");
    } finally {
      setCheckInBusy(false);
    }
  };

  const activeTrips = trips.filter((t) => !["completed", "cancelled"].includes(t.status));
  const completedTrips = trips.filter((t) => t.status === "completed");
  const primary = activeTrips[0];
  const totalKmToday = trips.reduce((s, t) => s + (t.distance_km || 0), 0);
  const fuelToday = trips.reduce((s, t) => s + (t.fuel_cost || 0), 0);
  const denom = trips.length || 1;
  const completedRate = completedTrips.length ? Math.round((completedTrips.length / denom) * 100) : 0;

  const historyRows = [...trips]
    .sort((a, b) => b.id - a.id)
    .slice(0, 6);

  const timeline =
    primary
      ? [
          {
            title: "Pickup completed",
            detail: primary.loading_end_time ? `Pickup window closed ${formatDateTime(primary.loading_end_time)}` : "Awaiting pickup / load confirmation",
            state: !!(primary.departure_delivery_time || primary.loading_end_time || primary.departure_time),
          },
          {
            title: "En route to delivery",
            detail: primary.distance_km ? `${primary.distance_km} km booked` : "Navigate via Route Info if needed",
            state: !!(primary.departure_delivery_time || primary.departure_time) && !primary.completed_at,
            current: !!(primary.departure_delivery_time || primary.departure_time) && !primary.completed_at,
          },
          {
            title: "Delivered",
            detail: primary.completed_at ? `Closed ${formatDateTime(primary.completed_at)}` : "POD pending",
            state: !!primary.completed_at,
          },
        ]
      : [];

  return (
    <main style={{ padding: "1.5rem 1.25rem 2.5rem", background: "#F3F4F6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.06em" }}>FleetOpt Analytics</p>
            <h1 style={{ margin: "0.15rem 0 0", fontSize: "1.35rem", fontWeight: 800 }}>Logistics Management System</h1>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => void checkIn()}
            disabled={checkInBusy}
            aria-busy={checkInBusy}
          >
            {checkInBusy ? "Check-in…" : "Check in for shift"}
          </button>
        </header>

        {checkInOk ? (
          <div
            role="status"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: 8,
              background: "var(--bg-success)",
              color: "var(--text-success)",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            {checkInOk}
          </div>
        ) : null}

        <DashboardRoleTabs active="driver" />

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Driver Dashboard</h2>
            <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Trip execution, route updates, and delivery management.
            </p>
          </div>
          <button type="button" className="button" style={{ background: "#E5E7EB", color: "var(--text)" }} onClick={() => refresh()}>
            Refresh
          </button>
        </div>

        {error && (
          <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: 12, borderRadius: 8 }}>
            {error}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <KpiCard
            label="Today’s assignments"
            value={activeTrips.length + completedTrips.length || trips.length || 0}
            delta={`${completedTrips.length} completed · ${activeTrips.length} active`}
            tone="neutral"
          />
          <KpiCard label="Distance (loaded trips)" value={`${totalKmToday.toFixed(1)} km`} delta={`Avg ${trips.length ? (totalKmToday / trips.length).toFixed(1) : "0"} km / trip`} />
          <KpiCard label="Fuel (cost rollup)" value={fuelToday ? formatPhpWhole(fuelToday) : "—"} delta="Based on logged trip fuel_cost" tone="neutral" />
          <KpiCard label="Completion rate (sample)" value={`${completedRate}%`} delta={salary?.rating != null ? `Rating ${salary.rating.toFixed(1)} / 5` : salary?.compliance_status || "Compliance on profile"} tone="success" />
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
            gap: "1rem",
          }}
        >
          <article style={{ ...card }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>Current trip</h3>
                {primary ? (
                  <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                    TRP-{primary.id} · {formatRoute(primary)}
                  </p>
                ) : (
                  <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.88rem" }}>No active trip — check assignments below.</p>
                )}
              </div>
              {primary && (
                <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.35rem 0.65rem", borderRadius: 8, background: "rgba(14,165,233,0.15)", color: "#0369a1" }}>
                  {primary.status.replace(/_/g, " ")}
                </span>
              )}
            </div>

            {!primary ? null : (
              <>
                <ol style={{ margin: "0 0 1rem", padding: 0, listStyle: "none", display: "grid", gap: "0.75rem" }}>
                  {timeline.map((step, idx) => (
                    <li key={step.title} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.65rem" }}>
                      <span
                        aria-hidden
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          marginTop: 4,
                          background: step.state ? "#059669" : step.current ? "#2563eb" : "#D1D5DB",
                          boxShadow: step.current ? "0 0 0 3px rgba(37,99,235,0.2)" : "none",
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{idx + 1}. {step.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{step.detail}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                <div style={{ padding: "0.75rem", borderRadius: 8, background: "rgba(14,165,233,0.08)", marginBottom: "0.65rem", fontSize: "0.88rem" }}>
                  <strong>ETA:</strong>{" "}
                  {primary.estimated_delivery_time ? formatDateTime(primary.estimated_delivery_time) : "Not set"}
                  {" · "}
                  <strong>Distance:</strong> {primary.distance_km} km · <strong>Fuel cost:</strong> {formatPhpWhole(primary.fuel_cost || 0)}
                </div>
                <div style={{ padding: "0.75rem", borderRadius: 8, background: "rgba(5,150,105,0.08)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                  <strong>Optional route tweak:</strong> If traffic builds, planners may suggest alternate arterials via Route Info — coordination with dispatcher first.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {primary.status === "assigned" && (
                    <button type="button" className="button" disabled={busy === primary.id} onClick={() => accept(primary.id)}>
                      {busy === primary.id ? "Working…" : "Accept assignment"}
                    </button>
                  )}
                  <Link href={`/trips/${primary.id}/track`} className="button" style={{ background: "#fff", color: "var(--text)", border: "1px solid var(--border)", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    Track trip
                  </Link>
                  <Link href={`/driver/job-execution?trip=${primary.id}`} className="button" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    Update status / POD
                  </Link>
                </div>
              </>
            )}
          </article>

          <div style={{ display: "grid", gap: "1rem" }}>
            <article style={{ ...card }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>Vehicle snapshot</h3>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                  <span>Fuel allowance (booking roll-up)</span>
                  <span style={{ fontWeight: 700 }}>{primary ? "~65%" : "—"}</span>
                </div>
                <div style={{ height: 10, marginTop: 6, borderRadius: 999, background: "#E5E7EB", overflow: "hidden" }}>
                  <div style={{ width: primary ? "65%" : "0%", height: "100%", background: "#2563eb", borderRadius: 999 }} />
                </div>
              </div>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                <strong>Trip-linked truck:</strong> {primary ? `#${primary.truck_id}` : "—"}
              </p>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                Open <Link href="/driver/vehicle-status" style={{ color: "var(--brand-text-strong)", fontWeight: 700 }}>Vehicle Status</Link> for compliance and mileage notes.
              </p>
              <div style={{ marginTop: "0.85rem", padding: "0.65rem", borderRadius: 8, background: "rgba(251,191,36,0.2)", fontSize: "0.82rem", color: "#92400e" }}>
                Scheduled maintenance reminders appear here once synced from fleet records.
              </div>
              <div style={{ marginTop: "0.5rem", padding: "0.55rem", borderRadius: 8, background: "rgba(14,165,233,0.1)", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Predictive breakdown risk: Low (baseline) — escalate issues via Report Issue below.
              </div>
            </article>

            <article style={{ ...card }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>Quick actions</h3>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <ActionBtn href={`/driver/job-execution${primary ? `?trip=${primary.id}` : ""}`} bg="#059669">
                  Complete segment / POD
                </ActionBtn>
                <ActionBtn href={`/driver/update-status${primary ? `?trip=${primary.id}` : ""}`} bg="#2563eb">
                  Update status
                </ActionBtn>
                <ActionBtn href="/driver/route-info" bg="#ea580c">
                  Report issue / route help
                </ActionBtn>
              </div>
              <p style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Next-slot delay likelihood depends on corridor — dispatcher sees the same ETA stream.
              </p>
            </article>
          </div>
        </section>

        <article style={{ ...card }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>All assignments</h3>
          {activeTrips.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>No active trips scheduled for you.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.65rem" }}>
              {activeTrips.map((t) => (
                <div key={t.id} style={{ display: "grid", gap: "0.5rem", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <strong>TRP-{t.id}</strong>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{formatRoute(t)} · status: {t.status}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {t.status === "assigned" && (
                      <button type="button" className="button" disabled={busy === t.id} onClick={() => accept(t.id)}>
                        Accept
                      </button>
                    )}
                    <Link href={`/trips/${t.id}/track`} className="button" style={{ ...ghostBtn }}>
                      Track
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article style={{ ...card }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>Recent trip history</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", minWidth: 520 }}>
              <thead>
                <tr style={{ background: "#F3F4F6", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.65rem", fontWeight: 700 }}>Trip ID</th>
                  <th style={{ textAlign: "left", padding: "0.65rem", fontWeight: 700 }}>Route</th>
                  <th style={{ textAlign: "right", padding: "0.65rem", fontWeight: 700 }}>Km</th>
                  <th style={{ textAlign: "right", padding: "0.65rem", fontWeight: 700 }}>Fuel ₱</th>
                  <th style={{ textAlign: "left", padding: "0.65rem", fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "1rem", color: "var(--text-secondary)" }}>
                      No trips yet — accept jobs from Dispatch.
                    </td>
                  </tr>
                ) : (
                  historyRows.map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.65rem", fontWeight: 600 }}>TRP-{t.id}</td>
                      <td style={{ padding: "0.65rem", color: "var(--text-secondary)" }}>{formatRoute(t)}</td>
                      <td style={{ padding: "0.65rem", textAlign: "right" }}>{t.distance_km}</td>
                      <td style={{ padding: "0.65rem", textAlign: "right" }}>{formatPhpWhole(t.fuel_cost || 0)}</td>
                      <td style={{ padding: "0.65rem" }}>
                        <StatusPill ok={t.status === "completed"} label={t.status.replace(/_/g, " ")} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <section style={{ ...card, display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          <GhostLink href="/driver/scheduled-trips">Scheduled trips</GhostLink>
          <GhostLink href="/driver/schedule">Designated schedule</GhostLink>
          <GhostLink href="/driver/pay">Total pay</GhostLink>
          <GhostLink href="/driver/completion-report">Completion report</GhostLink>
        </section>
      </div>
    </main>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "0.5rem 0.95rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  textDecoration: "none",
  fontWeight: 600,
  color: "var(--text)",
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        padding: "0.2rem 0.5rem",
        borderRadius: 6,
        background: ok ? "rgba(5,150,105,0.15)" : "rgba(107,114,128,0.15)",
        color: ok ? "#059669" : "#475569",
        textTransform: "capitalize",
      }}
    >
      {label}
    </span>
  );
}

function ActionBtn({
  href,
  bg,
  children,
}: {
  href: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        borderRadius: 8,
        background: bg,
        color: "#fff",
        fontWeight: 700,
        fontSize: "0.92rem",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid var(--border)", fontWeight: 600, textDecoration: "none", color: "var(--text)", background: "#fff" }}>
      {children}
    </Link>
  );
}
