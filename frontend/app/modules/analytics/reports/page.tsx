"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { downloadBackendReportPdf } from "@/lib/backendReportPdf";
import { getEffectiveRole } from "@/lib/auth";
import { useRoleGuard } from "@/lib/useRoleGuard";

function modulesHomeHref(): string {
  if (typeof window === "undefined") return "/dispatcher/dashboard";
  const r = localStorage.getItem("userRole");
  if (r === "admin") return "/admin/dashboard";
  if (r === "manager") return "/manager/dashboard";
  return "/dispatcher/dashboard";
}

type ReportAction = {
  id: string;
  title: string;
  module: string;
  description: string;
  apiPath: string;
  filenameStem: string;
  roles: Array<"admin" | "manager" | "dispatcher">;
};

const REPORT_ACTIONS: ReportAction[] = [
  {
    id: "bookings",
    title: "Booking Reports",
    module: "Booking Reports",
    description: "All bookings with pickup, dropoff, status, and estimated cost.",
    apiPath: "/reports/bookings",
    filenameStem: "booking_reports",
    roles: ["admin", "manager", "dispatcher"],
  },
  {
    id: "fleet",
    title: "Fleet Reports",
    module: "Fleet Reports",
    description: "Trip-level fleet costs and distances.",
    apiPath: "/reports/fleet",
    filenameStem: "fleet_reports",
    roles: ["admin", "manager"],
  },
  {
    id: "finance",
    title: "Financial Reports",
    module: "Financial Reports",
    description: "Payment ledger for verification and receivables review.",
    apiPath: "/manager/finance-report",
    filenameStem: "financial_reports",
    roles: ["admin", "manager"],
  },
  {
    id: "maintenance",
    title: "Maintenance Reports",
    module: "Maintenance Reports",
    description: "Maintenance records, risk scores, and service dates.",
    apiPath: "/manager/maintenance-report",
    filenameStem: "maintenance_reports",
    roles: ["admin", "manager"],
  },
];

export default function DashboardReportsPage() {
  useRoleGuard(["manager", "admin", "dispatcher"]);

  const [home, setHome] = useState("/dispatcher/dashboard");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "manager" | "dispatcher">("dispatcher");

  useEffect(() => {
    setHome(modulesHomeHref());
    const r = getEffectiveRole();
    if (r === "admin" || r === "manager" || r === "dispatcher") setRole(r);
  }, []);

  const download = async (action: ReportAction) => {
    setBusyId(action.id);
    setError(null);
    try {
      await downloadBackendReportPdf({
        apiPath: action.apiPath,
        moduleName: action.module,
        reportName: action.title,
        filenameStem: action.filenameStem,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed.");
    } finally {
      setBusyId(null);
    }
  };

  const visibleActions = REPORT_ACTIONS.filter((a) => a.roles.includes(role));

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: home },
          { label: "Analytics & Reporting" },
          { label: "Report types & roadmap" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Reporting map</h1>
        <p style={{ color: "#666666", marginBottom: "1.25rem", maxWidth: "44rem" }}>
          Operational staff use predictive and prescriptive tools plus the{" "}
          <Link href="/modules/analytics/operations-snapshot" style={{ color: "var(--brand-text)", fontWeight: 600 }}>
            live data snapshot
          </Link>{" "}
          for database-backed KPIs. Download professionally formatted A4 PDFs below — CSV export is not available.
        </p>

        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            borderLeft: "4px solid var(--brand-text)",
            background: "#F8FAFC",
          }}
        >
          <h2 style={{ color: "#1A1A1A", marginTop: 0, fontSize: "1.05rem" }}>Download PDF reports</h2>
          <p style={{ color: "#4B5563", marginBottom: "1rem" }}>
            PDF-only exports preserve formatting for documentation and presentations and prevent accidental editing of
            exported data.
          </p>
          {error ? (
            <p role="alert" style={{ color: "#B91C1C", marginBottom: "0.75rem" }}>
              {error}
            </p>
          ) : null}
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {visibleActions.map((action) => (
              <div
                key={action.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 0",
                  borderTop: "1px solid #E5E7EB",
                }}
              >
                <div style={{ maxWidth: "32rem" }}>
                  <strong style={{ color: "#111827" }}>{action.title}</strong>
                  <p style={{ margin: "0.25rem 0 0", color: "#6B7280", fontSize: "0.9rem" }}>{action.description}</p>
                </div>
                <button
                  type="button"
                  className="quick-action-btn"
                  disabled={busyId === action.id}
                  onClick={() => void download(action)}
                >
                  {busyId === action.id ? "Preparing PDF…" : "Download PDF"}
                </button>
              </div>
            ))}
          </div>
          <p style={{ color: "#6B7280", marginTop: "1rem", marginBottom: 0, fontSize: "0.9rem" }}>
            For chart-level Analytics / Admin / Dispatcher / Customer / Fleet reports, open Analytics Center and use{" "}
            <strong>Download PDF</strong> on each chart or drill-down panel.
          </p>
        </div>

        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            borderLeft: "4px solid var(--brand-text)",
            background: "#F8FAFC",
          }}
        >
          <h2 style={{ color: "#1A1A1A", marginTop: 0, fontSize: "1.05rem" }}>Where to click</h2>
          <ul style={{ color: "#374151", margin: 0, paddingLeft: "1.25rem", lineHeight: 1.6 }}>
            <li>
              <strong>Dispatcher / ops:</strong>{" "}
              <Link href="/modules/analytics/operations-snapshot">Live data snapshot</Link>,{" "}
              <Link href="/modules/analytics/expenses">Expense summary</Link>,{" "}
              <Link href="/dispatcher/trip-logs">Trip logs</Link>,{" "}
              <Link href="/modules/analytics/predictions">Operational predictions</Link>
            </li>
            <li>
              <strong>Manager:</strong> <Link href="/manager/analytics">Live role analytics and reports</Link>,{" "}
              <Link href="/modules/analytics/accuracy">Accuracy &amp; drift</Link> (+ retrain where allowed)
            </li>
          </ul>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The reporting submodule closes the Analytics & Reporting flow by connecting predictive and
            prescriptive outputs with operational and executive consumers.
          </p>
          <p style={{ color: "#666666", marginBottom: 0 }}>
            Live aggregates come from <code>/api/analytics/dashboard</code>; exploratory scenarios use{" "}
            <code>/api/analytics/predict-trip-cost</code>, <code>whatif</code>, and route optimization endpoints.
          </p>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Dashboard tiers</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>
              <strong>Executive Dashboard</strong>: High-level KPIs and profitability (often manager role + finance APIs).
            </li>
            <li>
              <strong>Operations Dashboard</strong>: Real-time trips and assignments — dispatcher console + snapshot marts.
            </li>
            <li>
              <strong>Fleet Health</strong>: Maintenance mart + predictive maintenance tooling.
            </li>
          </ul>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Report types</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>Daily / shift summary — trips, SLA, utilization</li>
            <li>Weekly trend — congestion, delays, reassignment counts</li>
            <li>Monthly financial rollup — bookings, payments, quoted vs actual costs</li>
            <li>Driver &amp; helper performance — ratings, completions (ties to dispatcher completion workflow)</li>
          </ul>
        </div>

        <div className="card">
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Export policy</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>PDF Download only — standardized A4 FleetOpt report layout</li>
            <li>CSV export removed system-wide to protect exported operational data</li>
            <li>Chart exports embed live chart images; tables paginate with repeating headers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
