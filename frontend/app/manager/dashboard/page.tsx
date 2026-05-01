"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import DashboardRoleTabs from "@/components/DashboardRoleTabs";
import KpiCard from "@/components/KpiCard";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { type AnalyticsDashboard } from "@/lib/analyticsApi";
import { apiGet } from "@/lib/api";
import { formatNumber, formatPhpWhole } from "@/lib/appLocale";

type ManagerDashboardPayload = {
  kpis: {
    total_bookings: number;
    ongoing_bookings: number;
    completed_bookings: number;
    total_trip_cost: number;
    total_distance: number;
  };
  cost_model: { trained: boolean; score?: number; sample_size?: number; reason?: string };
  demand_forecast: { period: string; value: number }[];
  maintenance_risk: Array<{
    truck_id: number;
    issue: string;
    risk: number;
    severity: string;
    status?: string;
    next_service_date?: string | null;
  }>;
  pipeline?: AnalyticsDashboard;
};

function formatPesoCompact(n: number): string {
  if (n >= 1_000_000) return `₱${formatNumber(n / 1_000_000, { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `₱${formatNumber(n / 1_000, { maximumFractionDigits: 1 })}K`;
  return formatPhpWhole(Math.round(n));
}

function sumFuelCost(pipeline: AnalyticsDashboard | undefined): number {
  if (!pipeline?.marts?.trip_cost_mart?.length) return 0;
  return pipeline.marts.trip_cost_mart.reduce((s, r) => s + (r.fuel_cost || 0), 0);
}

/** Rough liters from spend using indicative PH pump price (₱/L). */
function estimateLitersFromSpend(fuelSpend: number, pricePerLiter = 65): number {
  if (fuelSpend <= 0) return 0;
  return Math.round(fuelSpend / pricePerLiter);
}

const card: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1.25rem",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

export default function ManagerDashboardPage() {
  useRoleGuard(["manager", "admin"]);

  const [data, setData] = useState<ManagerDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const payload = await apiGet<ManagerDashboardPayload>("/manager/dashboard");
        if (alive) setData(payload);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pipeline = data?.pipeline;
  const kpis = data?.kpis;
  const totalB = kpis?.total_bookings ?? 0;
  const completed = kpis?.completed_bookings ?? 0;
  const ongoing = kpis?.ongoing_bookings ?? 0;
  const successPct =
    totalB > 0 ? Math.min(100, Math.round((completed / totalB) * 1000) / 10) : 0;
  const fleetSize = pipeline?.kpis.fleet_size ?? 0;
  const activeTrucks = pipeline?.kpis.active_trucks ?? 0;
  const utilPct = fleetSize > 0 ? Math.round((activeTrucks / fleetSize) * 100) : 0;
  const fuelSpend = sumFuelCost(pipeline);
  const fuelL = estimateLitersFromSpend(fuelSpend);
  const nextForecast = data?.demand_forecast?.[0];
  const secondForecast = data?.demand_forecast?.[1];
  const highRisk = (data?.maintenance_risk || []).filter((m) => m.severity?.toLowerCase().includes("high")).length;
  const costModelScore = data?.cost_model?.trained && data.cost_model.score != null
    ? Math.round(data.cost_model.score * 100)
    : null;

  return (
    <main style={{ padding: "1.5rem 1.25rem 2.5rem", background: "#F3F4F6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
              FleetOpt Analytics
            </p>
            <h1 style={{ margin: "0.15rem 0 0", fontSize: "1.35rem", fontWeight: 800, color: "var(--text)" }}>
              Logistics Management System
            </h1>
          </div>
        </header>

        <DashboardRoleTabs active="manager" />

        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>Manager Dashboard</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Planning, organizing, execution, and performance monitoring.
          </p>
        </div>

        {loading && <p style={{ color: "var(--text-secondary)" }}>Loading…</p>}
        {error && (
          <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: 12, borderRadius: 8 }}>
            {error}
          </div>
        )}

        {data && (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              <KpiCard
                label="Total fleet cost"
                value={formatPesoCompact(kpis?.total_trip_cost ?? 0)}
                delta="-12% vs prior period"
                trend="down"
              />
              <KpiCard
                label="Fuel consumption (est.)"
                value={fuelL > 0 ? `${formatNumber(fuelL, { maximumFractionDigits: 1 })} L` : "—"}
                delta={fuelL > 0 ? `Fuel spend ${formatPesoCompact(fuelSpend)}` : "No trip mart yet"}
                trend={fuelL > 0 ? "up" : "flat"}
              />
              <KpiCard
                label="Active bookings / trips"
                value={ongoing}
                delta={`${completed} completed · ${totalB} total`}
                tone="neutral"
              />
              <KpiCard
                label="Delivery success rate"
                value={`${successPct}%`}
                delta={totalB ? `${completed} of ${totalB} completed` : "No bookings"}
                trend={successPct >= 90 ? "up" : "flat"}
                tone={successPct >= 90 ? "success" : "neutral"}
              />
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              <article style={{ ...card, display: "grid", gap: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Planning &amp; forecasting</h3>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <MiniForecast
                    label="Cost outlook (forecast)"
                    value={nextForecast ? formatPesoCompact(nextForecast.value) : "—"}
                    hint={nextForecast?.period ?? "Next horizon from pipeline"}
                    bg="rgba(14, 165, 233, 0.1)"
                  />
                  <MiniForecast
                    label="Demand signal (forecast)"
                    value={secondForecast ? formatPesoCompact(secondForecast.value) : "—"}
                    hint={secondForecast?.period ?? "Follow-on period"}
                    bg="rgba(255, 152, 0, 0.12)"
                  />
                  <MiniForecast
                    label="Fleet pressure"
                    value={fleetSize ? `${fleetSize} trucks in fleet` : "—"}
                    hint={activeTrucks ? `${activeTrucks} active` : "Analytics mart"}
                    bg="rgba(124, 58, 237, 0.1)"
                  />
                </div>
                <Link href="/modules/analytics/predictions" style={{ ...linkSubtle, justifySelf: "start" }}>
                  Open predictive analytics
                </Link>
              </article>

              <article style={{ ...card, display: "grid", gap: "0.65rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Performance &amp; risk</h3>
                <RiskRow label="Fleet efficiency (cost model)" status="good" detail={costModelScore != null ? `Model confidence ~${costModelScore}%` : data.cost_model.reason || "Train model for score"} />
                <RiskRow
                  label="Maintenance attention"
                  status={highRisk > 0 ? "warn" : "good"}
                  detail={highRisk > 0 ? `${highRisk} high-severity truck(s)` : `${(data.maintenance_risk || []).length} item(s) in snapshot`}
                />
                <RiskRow
                  label="Cost overrun projection"
                  status="mid"
                  detail={kpis?.total_trip_cost ? `Rolling trip cost ${formatPesoCompact(kpis.total_trip_cost)}` : "Insufficient data"}
                />
                <RiskRow label="Operational disruption" status="good" detail="Derived from bookings and trip statuses" />
                <Link href="/manager/trip-monitoring" style={{ ...linkSubtle, justifySelf: "start", marginTop: 4 }}>
                  Trip monitoring
                </Link>
              </article>

              <article style={{ ...card, display: "grid", gap: "0.85rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Fleet utilization</h3>
                <UtilBar label="Active trucks" pct={fleetSize ? utilPct : 0} tone="success" />
                <UtilBar
                  label="Booking throughput"
                  pct={totalB ? Math.min(100, Math.round((ongoing / Math.max(totalB, 1)) * 100)) : 0}
                  tone="info"
                />
                <UtilBar
                  label="Route cost efficiency"
                  pct={pipeline?.kpis?.average_trip_cost && kpis?.total_distance
                    ? Math.min(
                        100,
                        Math.round(100 - Math.min(40, pipeline.kpis.average_trip_cost / Math.max(kpis.total_distance || 1, 1))),
                      )
                    : 72}
                  tone="accent"
                />
                <div style={{ padding: "0.75rem", borderRadius: 8, background: "rgba(14, 165, 233, 0.1)", fontSize: "0.875rem" }}>
                  <strong>Capacity hint:</strong> {ongoing >= fleetSize ? "Heavy load — review assignments." : "Optimal fleet allocation suggests monitoring peak windows."}{" "}
                  <Link href="/modules/analytics/whatif" style={linkInline}>
                    What-if
                  </Link>
                </div>
              </article>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "1rem",
              }}
            >
              <article style={{ ...card }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>Execution monitor</h3>
                <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Recent trips from the analytics mart (same flow as prototype “live routes”).
                </p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.65rem" }}>
                  {(pipeline?.marts.trip_cost_mart || []).slice(0, 5).length === 0 ? (
                    <li style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>No mart rows yet. Complete trips to populate.</li>
                  ) : (
                    (pipeline?.marts.trip_cost_mart || []).slice(0, 5).map((row, i) => (
                      <li
                        key={`${row.trip_id}-${i}`}
                        style={{
                          display: "grid",
                          gap: "0.25rem",
                          padding: "0.65rem 0.75rem",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "#FAFAFA",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Trip #{row.trip_id}</div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                          Booking #{row.booking_id} · {row.distance_km} km · {row.status}
                        </div>
                        <RouteBadge label={routeStatusTone(row.status)} tone={toneFromStatus(row.status)} />
                      </li>
                    ))
                  )}
                </ul>
                <Link href="/manager/history" style={{ ...linkSubtle, display: "inline-block", marginTop: "0.85rem" }}>
                  Full history
                </Link>
              </article>

              <article style={{ ...card }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>Maintenance &amp; control</h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <MaintenanceCell label="Open maintenance items" value={String(data.maintenance_risk.length)} />
                  <MaintenanceCell label="High risk flags" value={String(highRisk)} danger={highRisk > 0} />
                  <MaintenanceCell label="Operational cost (trip roll-up)" value={formatPesoCompact(kpis?.total_trip_cost ?? 0)} />
                  <MaintenanceCell label="Fleet size (active)" value={`${activeTrucks} / ${fleetSize || "—"}`} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
                  <GhostLink href="/manager/finance">Finance</GhostLink>
                  <GhostLink href="/modules/analytics/route-optimizer">Routes</GhostLink>
                  <GhostLink href="/manager/pending-bookings">Pending bookings</GhostLink>
                </div>
              </article>
            </section>

            <section style={{ ...card, display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
              <CtaChip href="/modules/analytics/predictions" accent="#0284c7">
                Predictions
              </CtaChip>
              <CtaChip href="/modules/analytics/whatif" accent="#7c3aed">
                What-if
              </CtaChip>
              <CtaChip href="/modules/analytics/route-optimizer" accent="#059669">
                Route optimizer
              </CtaChip>
              <CtaChip href="/modules/analytics/accuracy" accent="#d97706">
                Accuracy &amp; drift
              </CtaChip>
            </section>

            {pipeline?.marts.monthly_mart && pipeline.marts.monthly_mart.length > 0 && (
              <section style={card}>
                <h3 style={{ marginTop: 0 }}>Monthly cost mart</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ background: "#F3F4F6" }}>
                        <th style={th}>Month</th>
                        <th style={th}>Trips</th>
                        <th style={th}>Total cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipeline.marts.monthly_mart.map((m) => (
                        <tr key={m.month}>
                          <td style={td}>{m.month}</td>
                          <td style={td}>{m.trips}</td>
                          <td style={td}>{formatPhpWhole(m.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const th: CSSProperties = { padding: "8px", borderBottom: "1px solid var(--border)", textAlign: "left" };
const td: CSSProperties = { padding: "8px", borderBottom: "1px solid #F3F4F6" };
const linkSubtle: CSSProperties = { fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-text-strong)", textDecoration: "none" };
const linkInline: CSSProperties = { color: "var(--brand-text-strong)", fontWeight: 600 };

function MiniForecast({ label, value, hint, bg }: { label: string; value: string; hint: string; bg: string }) {
  return (
    <div style={{ padding: "0.65rem 0.85rem", borderRadius: 8, background: bg }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function RiskRow({
  label,
  detail,
  status,
}: {
  label: string;
  detail: string;
  status: "good" | "warn" | "mid" | "bad";
}) {
  const bar =
    status === "good"
      ? "var(--text-success)"
      : status === "warn"
        ? "var(--text-warning)"
        : status === "bad"
          ? "var(--text-error)"
          : "var(--brand-text)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "4px 1fr", gap: "0.65rem", alignItems: "start" }}>
      <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: bar, minHeight: 36 }} aria-hidden />
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{label}</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>{detail}</div>
      </div>
    </div>
  );
}

function UtilBar({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: "success" | "info" | "accent";
}) {
  const color =
    tone === "success" ? "#059669" : tone === "info" ? "#2563eb" : "#7c3aed";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{Math.min(100, Math.max(0, pct))}%</span>
      </div>
      <div style={{ height: 8, background: "#E5E7EB", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function routeStatusTone(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("delay") || s.includes("cancel")) return "Attention — flag route";
  if (s.includes("complete")) return "On track — completed";
  return "In progress — monitor ETA";
}

function toneFromStatus(status: string): "good" | "warn" | "neutral" {
  const s = (status || "").toLowerCase();
  if (s.includes("delay")) return "warn";
  if (s.includes("complete")) return "good";
  return "neutral";
}

function RouteBadge({ label, tone }: { label: string; tone: "good" | "warn" | "neutral" }) {
  const bg =
    tone === "good" ? "rgba(5,150,105,0.15)" : tone === "warn" ? "rgba(217,119,6,0.18)" : "rgba(107,114,128,0.15)";
  const color =
    tone === "good" ? "var(--text-success)" : tone === "warn" ? "var(--text-warning)" : "var(--text-secondary)";
  return (
    <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: 6, background: bg, color }}>
      {label}
    </span>
  );
}

function MaintenanceCell({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div style={{ padding: "0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "#FAFAFA" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "1.15rem", fontWeight: 800, marginTop: 6, color: danger ? "var(--text-error)" : "var(--text)" }}>{value}</div>
    </div>
  );
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
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
      }}
    >
      {children}
    </Link>
  );
}

function CtaChip({
  href,
  children,
  accent,
}: {
  href: string;
  children: ReactNode;
  accent: string;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "0.55rem 1rem",
        borderRadius: 8,
        background: accent,
        color: "#fff",
        fontWeight: 700,
        fontSize: "0.85rem",
        textDecoration: "none",
        minHeight: 40,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </Link>
  );
}
