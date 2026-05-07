"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import { formatDateTime, formatPhp } from "@/lib/appLocale";
import { AnalyticsApi, type AnalyticsDashboard } from "@/lib/analyticsApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

function modulesHomeHref(): string {
  if (typeof window === "undefined") return "/dispatcher/dashboard";
  const r = localStorage.getItem("userRole");
  if (r === "admin") return "/admin/dashboard";
  if (r === "manager") return "/manager/dashboard";
  return "/dispatcher/dashboard";
}

export default function OperationsSnapshotPage() {
  useRoleGuard(["dispatcher", "manager", "admin"]);

  const [home, setHome] = useState("/dispatcher/dashboard");
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHome(modulesHomeHref());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await AnalyticsApi.dashboard();
        if (!alive) return;
        setData(d);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load analytics pipeline.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const kpis = data?.kpis;

  const card: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid var(--border, #E5E7EB)",
    borderRadius: 12,
    padding: "1.1rem",
  };

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)", paddingBottom: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: home },
          { label: "Analytics" },
          { label: "Live data snapshot" },
        ]}
      />

      <header style={{ marginTop: "1.5rem", marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Live operational data snapshot</h1>
        <p style={{ margin: "0.4rem 0 0", color: "#6B7280", maxWidth: "44rem" }}>
          Database-backed KPIs and cost marts from <code>/api/analytics/dashboard</code> — same preparation layer
          executives use for planning, surfaced here for dispatch and operations. Strategic monthly forecast and model
          retraining remain under manager tooling.
        </p>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <Link href="/modules/analytics/predictions" style={pillLink}>
          Predictions
        </Link>
        <Link href="/modules/analytics/whatif" style={pillLink}>
          What‑if
        </Link>
        <Link href="/modules/analytics/route-optimizer" style={pillLink}>
          Route optimizer
        </Link>
        <Link href="/modules/analytics/accuracy" style={pillLink}>
          Model accuracy
        </Link>
      </div>

      {error && (
        <div role="alert" style={{ padding: "1rem", background: "#FEE2E2", color: "#991B1B", borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: "#6B7280" }}>Loading pipeline…</p>}

      {data && !loading && (
        <>
          <p style={{ fontSize: "0.85rem", color: "#6B7280", marginBottom: "1rem" }}>
            Last ingested reference: <strong>{formatDateTime(data.ingested_at)}</strong>
          </p>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "0.85rem",
              marginBottom: "1.25rem",
            }}
          >
            <KpiTile label="Total bookings" value={String(kpis?.total_bookings ?? "—")} />
            <KpiTile label="Completed" value={String(kpis?.completed_bookings ?? "—")} />
            <KpiTile label="Ongoing bookings" value={String(kpis?.ongoing_bookings ?? "—")} />
            <KpiTile label="Trips" value={String(kpis?.total_trips ?? "—")} />
            <KpiTile label="Fleet size / active trucks" value={`${kpis?.fleet_size ?? "—"} / ${kpis?.active_trucks ?? "—"}`} />
            <KpiTile label="Paid revenue" value={formatPhp(kpis?.total_revenue ?? 0)} />
            <KpiTile label="Receivables (est.)" value={formatPhp(kpis?.outstanding_receivables ?? 0)} />
            <KpiTile label="Avg trip cost" value={formatPhp(kpis?.average_trip_cost ?? 0)} />
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "1rem" }}>
            <div style={card}>
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Trip cost mart</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ background: "#F3F4F6" }}>
                      {["Trip", "Booking", "Distance", "Total", "₱/km", "Status"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #E5E7EB" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.marts.trip_cost_mart.slice(0, 20).map((row) => (
                      <tr key={row.trip_id}>
                        <td style={td}>{row.trip_id}</td>
                        <td style={td}>{row.booking_id}</td>
                        <td style={td}>{row.distance_km?.toFixed?.(1) ?? row.distance_km} km</td>
                        <td style={td}>{formatPhp(row.total_cost)}</td>
                        <td style={td}>{formatPhp(row.cost_per_km)}</td>
                        <td style={td}>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.marts.trip_cost_mart.length === 0 && (
                  <p style={{ color: "#6B7280", margin: "0.5rem 0 0" }}>No trips in the database yet.</p>
                )}
                {data.marts.trip_cost_mart.length > 20 && (
                  <p style={{ fontSize: "0.82rem", color: "#6B7280", marginTop: "0.5rem" }}>Showing 20 of {data.marts.trip_cost_mart.length} rows.</p>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={card}>
                <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Monthly cost mart</h2>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ background: "#F3F4F6" }}>
                      {["Month", "Trips", "Total cost"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #E5E7EB" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.marts.monthly_mart.slice(-12).map((row) => (
                      <tr key={row.month}>
                        <td style={td}>{row.month}</td>
                        <td style={td}>{row.trips}</td>
                        <td style={td}>{formatPhp(row.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.marts.monthly_mart.length === 0 && (
                  <p style={{ color: "#6B7280", margin: "0.5rem 0 0" }}>No completed trips by month yet.</p>
                )}
              </div>

              <div style={card}>
                <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Maintenance mart</h2>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ background: "#F3F4F6" }}>
                      {["Truck", "Events", "Total cost"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #E5E7EB" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.marts.maintenance_mart.slice(0, 15).map((row) => (
                      <tr key={row.truck_id}>
                        <td style={td}>{row.truck_id}</td>
                        <td style={td}>{row.events}</td>
                        <td style={td}>{formatPhp(row.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.marts.maintenance_mart.length === 0 && (
                  <p style={{ color: "#6B7280", margin: "0.5rem 0 0" }}>No maintenance records.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const td: React.CSSProperties = { padding: "0.45rem 0.5rem", borderBottom: "1px solid #F3F4F6" };

const pillLink: React.CSSProperties = {
  display: "inline-block",
  padding: "0.4rem 0.85rem",
  borderRadius: 8,
  background: "#EEF2FF",
  color: "#3730A3",
  fontWeight: 600,
  fontSize: "0.85rem",
  textDecoration: "none",
};

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "0.85rem" }}>
      <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#6B7280", fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: "1.15rem", marginTop: 4 }}>{value}</div>
    </div>
  );
}
