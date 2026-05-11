"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useRoleGuard } from "@/lib/useRoleGuard";

function modulesHomeHref(): string {
  if (typeof window === "undefined") return "/dispatcher/dashboard";
  const r = localStorage.getItem("userRole");
  if (r === "admin") return "/admin/dashboard";
  if (r === "manager") return "/manager/dashboard";
  return "/dispatcher/dashboard";
}

export default function DashboardReportsPage() {
  useRoleGuard(["manager", "admin", "dispatcher"]);

  const [home, setHome] = useState("/dispatcher/dashboard");
  useEffect(() => {
    setHome(modulesHomeHref());
  }, []);

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
          <Link href="/modules/analytics/operations-snapshot" style={{ color: "#2563EB", fontWeight: 600 }}>
            live data snapshot
          </Link>{" "}
          for database-backed KPIs. This page summarizes the analytic reporting layer described in your design (executive vs
          operations vs compliance).
        </p>

        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            borderLeft: "4px solid #2563EB",
            background: "#F8FAFC",
          }}
        >
          <h2 style={{ color: "#1A1A1A", marginTop: 0, fontSize: "1.05rem" }}>Where to click</h2>
          <ul style={{ color: "#374151", margin: 0, paddingLeft: "1.25rem", lineHeight: 1.6 }}>
            <li>
              <strong>Dispatcher / ops:</strong>{" "}
              <Link href="/modules/analytics/operations-snapshot">Live data snapshot</Link>,{" "}
              <Link href="/dispatcher/reports">System reports</Link>,{" "}
              <Link href="/modules/analytics/predictions">Operational predictions</Link>
            </li>
            <li>
              <strong>Manager:</strong> <Link href="/analytics/reports">Analytics reports</Link> (stubbed connector view),{" "}
              <Link href="/modules/analytics/accuracy">Accuracy &amp; drift</Link> (+ retrain where allowed)
            </li>
          </ul>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The reporting submodule closes the Analytics & Reporting flow by connecting predictive and prescriptive outputs
            with operational and executive consumers.
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
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Export &amp; scheduling (roadmap)</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>Scheduled PDF/CSV from snapshot marts</li>
            <li>Email digests to operations leads</li>
            <li>Drill-down from drift alerts into trip-level prediction feedback</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
