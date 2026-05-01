"use client";

import DashboardRoleTabs from "@/components/DashboardRoleTabs";
import KpiCard from "@/components/KpiCard";
import { formatTimeShort } from "@/lib/appLocale";
import { DispatchApi, type DispatcherDashboardTrip } from "@/lib/dispatchApi";
import Link from "next/link";
import { useEffect, useState } from "react";

type TripSummary = {
  id: string;
  driverName: string;
  route: string;
  status: "pending" | "assigned" | "in_progress" | "delayed" | "completed";
  startTime: string;
  eta: string;
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return formatTimeShort(iso);
}

function mapTripStatus(api: string, etaIso: string | null): TripSummary["status"] {
  const now = Date.now();
  if (api === "completed") return "completed";
  if (api === "cancelled") return "pending";
  if (api === "pending") return "pending";
  if (["assigned", "accepted"].includes(api)) return "assigned";
  if (["departed", "loading", "in_delivery"].includes(api)) {
    if (etaIso) {
      const etaMs = new Date(etaIso).getTime();
      if (!Number.isNaN(etaMs) && etaMs < now) return "delayed";
    }
    return "in_progress";
  }
  return "assigned";
}

function tripsFromApi(rows: DispatcherDashboardTrip[]): TripSummary[] {
  return rows.map((r) => ({
    id: r.display_id,
    driverName: r.driver_name,
    route: r.route,
    status: mapTripStatus(r.status, r.eta),
    startTime: fmtTime(r.start_time),
    eta: fmtTime(r.eta),
  }));
}

const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1.25rem",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

export default function DispatcherDashboard() {
  const [stats, setStats] = useState({
    todayTrips: 0,
    todayCompleted: 0,
    todayActive: 0,
    availableTrucks: 0,
    activeDrivers: 0,
    driversOnBreak: 0,
    pendingOrders: 0,
  });
  const [recentTrips, setRecentTrips] = useState<TripSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await DispatchApi.dashboard();
        if (!alive) return;
        setStats({
          todayTrips: d.kpis.today_volume,
          todayCompleted: d.kpis.trips_completed_today,
          todayActive: d.kpis.active_trips,
          availableTrucks: d.kpis.available_trucks,
          activeDrivers: d.kpis.drivers_busy,
          driversOnBreak: d.kpis.drivers_idle,
          pendingOrders: d.kpis.pending_orders,
        });
        setRecentTrips(tripsFromApi(d.recent_trips));
        setLoadError(null);
      } catch (e) {
        if (!alive) return;
        setLoadError(e instanceof Error ? e.message : "Could not load dispatcher dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const getStatusColors = (status: TripSummary["status"]) => {
    switch (status) {
      case "pending":
        return { fg: "#2563eb", bg: "rgba(37, 99, 235, 0.12)", label: "Pending" };
      case "assigned":
        return { fg: "#7c3aed", bg: "rgba(124, 58, 237, 0.12)", label: "Assigned" };
      case "in_progress":
        return { fg: "#d97706", bg: "rgba(217, 119, 6, 0.15)", label: "Active" };
      case "delayed":
        return { fg: "#dc2626", bg: "rgba(220, 38, 38, 0.12)", label: "Delayed" };
      case "completed":
        return { fg: "#059669", bg: "rgba(5, 150, 105, 0.12)", label: "Completed" };
      default:
        return { fg: "#6b7280", bg: "#F3F4F6", label: "Unknown" };
    }
  };

  const scheduleBands = [
    { time: "06:00", count: 12, label: "", tone: "success" as const },
    { time: "10:00", count: 18, label: "Peak", tone: "warning" as const },
    { time: "14:00", count: 9, label: "", tone: "info" as const },
  ];
  const maxBand = Math.max(...scheduleBands.map((b) => b.count));

  return (
    <main style={{ padding: "1.5rem 1.25rem 2.5rem", background: "#F3F4F6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <header>
          <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
            FleetOpt Analytics
          </p>
          <h1 style={{ margin: "0.15rem 0 0", fontSize: "1.35rem", fontWeight: 800 }}>Logistics Management System</h1>
        </header>

        <DashboardRoleTabs active="dispatcher" />

        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Dispatcher Dashboard</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Trip scheduling, route coordination, and order monitoring.
          </p>
        </div>

        {loadError && (
          <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: 12, borderRadius: 8 }}>
            {loadError}
          </div>
        )}
        {loading && <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading live stats…</p>}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <KpiCard
            label="Today’s trips"
            value={stats.todayTrips}
            delta={`${stats.todayCompleted} completed · ${stats.todayActive} active`}
            trend="up"
          />
          <KpiCard label="Available trucks" value={stats.availableTrucks} delta="Ready for dispatch" tone="neutral" />
          <KpiCard
            label="Active drivers"
            value={stats.activeDrivers}
            delta={`${stats.driversOnBreak} on break`}
            tone="neutral"
          />
          <KpiCard label="Pending orders" value={stats.pendingOrders} delta="Needs assignment" tone="warning" />
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            gap: "1rem",
          }}
        >
          <article style={{ ...card, display: "grid", gap: "0.85rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Trip schedule optimization</h3>
            <InsightRow title="Best dispatch window" detail="06:00 – 08:00 AM · Estimated efficiency uplift +18% (baseline)" accent="rgba(14,165,233,0.15)" />
            <InsightRow title="Workload forecast" detail="Peak 10:00 AM – 2:00 PM · Consider extra coverage on the board." accent="rgba(251,146,60,0.18)" />
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: 8 }}>Volume by slot</div>
              {scheduleBands.map((b) => (
                <div key={b.time} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span>{b.time}</span>
                    <span style={{ fontWeight: 600 }}>
                      {b.count} trips {b.label ? `· ${b.label}` : ""}
                    </span>
                  </div>
                  <div style={{ height: 10, background: "#E5E7EB", borderRadius: 6, overflow: "hidden", marginTop: 4 }}>
                    <div
                      style={{
                        width: `${Math.round((b.count / maxBand) * 100)}%`,
                        height: "100%",
                        background:
                          b.tone === "success" ? "#059669" : b.tone === "warning" ? "#d97706" : "#2563eb",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Link href="/dispatcher/week-board" style={{ ...linkStrong, justifySelf: "start" }}>
              Open weekly schedule board
            </Link>
          </article>

          <article style={{ ...card, display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Route coordination</h3>
            <InsightRow title="Suggested corridor" detail="Manila → Quezon → Marikina · Approx. 42 km · Saves ~15 min vs default" accent="rgba(5,150,105,0.12)" />
            <InsightRow title="Traffic hotspot" detail="Heavy EDSA segment 08:00 – 10:00 · Predict +25 min if dispatched into window" accent="rgba(220,38,38,0.1)" />
            <div style={{ fontSize: "0.82rem", fontWeight: 700, marginTop: 4 }}>Route performance snapshot</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
              <li>MNL-North corridor — on-time ~95%</li>
              <li>MNL-South corridor — on-time ~78%</li>
            </ul>
            <Link href="/modules/analytics/route-optimizer" style={{ ...linkStrong, justifySelf: "start" }}>
              Route optimizer
            </Link>
          </article>

          <article style={{ ...card, display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Fleet &amp; driver assignment</h3>
            <div style={{ padding: "0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "#FAFAFA" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>TRK-001</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: 6, background: "rgba(5,150,105,0.15)", color: "#059669" }}>
                  Available
                </span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 6 }}>Utilization about 85%. Open Assets for the live fleet table.</div>
            </div>
            <div style={{ padding: "0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "#FAFAFA" }}>
              <div style={{ fontWeight: 700 }}>Active driver snapshot</div>
              <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginTop: 6 }}>Detailed ETAs and next jobs live under Driver Activity.</div>
              <Link href="/dispatcher/driver-activity" style={{ ...linkStrong, marginTop: 10, display: "inline-block" }}>
                Driver activity
              </Link>
            </div>
            <InsightRow title="Capacity hint" detail="Forecast: consider +3 trucks around 15:00 for afternoon surge." accent="rgba(124,58,237,0.12)" />
          </article>

          <article style={{ ...card, display: "grid", gap: "0.65rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Order monitoring</h3>
            <OrderRow order="ORD-1234" line="Metro delivery" badge="On track" tone="good" />
            <OrderRow order="ORD-1235" line="Laguna loop · Possible traffic slip" badge="Attention" tone="warn" />
            <OrderRow order="ORD-1236" line="Warehouse transfer" badge="Unassigned" tone="muted" />
            <div style={{ padding: "0.65rem 0.85rem", borderRadius: 8, background: "rgba(124,58,237,0.08)", fontSize: "0.82rem", marginTop: 6 }}>
              <strong>Fleet strain:</strong> Shortage risk late afternoon. Review jobs and the week board together.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: 6 }}>
              <GhostLink href="/dispatcher/job-assignments">Job assignments</GhostLink>
              <GhostLink href="/dispatcher/order-details">Order details</GhostLink>
            </div>
          </article>
        </section>

        <section style={card}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>Live trips</h3>
          {loading && recentTrips.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading trips…</p>
          ) : recentTrips.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>No recent trips yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.65rem" }}>
              {recentTrips.map((trip) => {
                const c = getStatusColors(trip.status);
                return (
                <div
                  key={trip.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "0.75rem",
                    alignItems: "center",
                    padding: "0.85rem",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "#FAFAFA",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{trip.id}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Driver · {trip.driverName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 600 }}>ROUTE</div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{trip.route}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 600 }}>TIME</div>
                    <div style={{ fontSize: "0.85rem" }}>
                      {trip.startTime} → {trip.eta}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.35rem 0.6rem", borderRadius: 6, background: c.bg, color: c.fg }}>{c.label}</span>
                    {trip.status === "pending" && (
                      <Link
                        href="/dispatcher/job-assignments"
                        style={{
                          fontSize: "0.78rem",
                          padding: "0.35rem 0.65rem",
                          borderRadius: 8,
                          textDecoration: "none",
                          textAlign: "center",
                          background: "var(--brand-text-strong)",
                          color: "#fff",
                          fontWeight: 700,
                        }}
                      >
                        Assign
                      </Link>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ ...card, display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <GhostLink href="/dispatcher/week-board">Week board</GhostLink>
          <GhostLink href="/dispatcher/schedules">Schedules</GhostLink>
          <GhostLink href="/dispatcher/assets-drivers">Assets &amp; drivers</GhostLink>
          <GhostLink href="/dispatcher/reported-issues">Reported issues</GhostLink>
          <GhostLink href="/dispatcher/confirm-completion">Confirm completion</GhostLink>
        </section>
      </div>
    </main>
  );
}

const linkStrong: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 700,
  color: "var(--brand-text-strong)",
  textDecoration: "none",
};

function InsightRow({ title, detail, accent }: { title: string; detail: string; accent: string }) {
  return (
    <div style={{ padding: "0.65rem 0.85rem", borderRadius: 8, background: accent }}>
      <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{title}</div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 4 }}>{detail}</div>
    </div>
  );
}

function OrderRow({
  order,
  line,
  badge,
  tone,
}: {
  order: string;
  line: string;
  badge: string;
  tone: "good" | "warn" | "muted";
}) {
  const colors =
    tone === "good"
      ? { bg: "rgba(5,150,105,0.12)", fg: "#059669" }
      : tone === "warn"
        ? { bg: "rgba(217,119,6,0.15)", fg: "#b45309" }
        : { bg: "#F3F4F6", fg: "#6b7280" };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{order}</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{line}</div>
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.25rem 0.55rem", borderRadius: 6, background: colors.bg, color: colors.fg }}>{badge}</span>
    </div>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: "0.45rem 0.85rem",
        borderRadius: 8,
        border: "1px solid var(--border)",
        fontSize: "0.82rem",
        fontWeight: 600,
        textDecoration: "none",
        color: "var(--text)",
        background: "#fff",
      }}
    >
      {children}
    </Link>
  );
}
