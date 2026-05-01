"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AnalyticsPipelineService } from "@/lib/analyticsPipelineService";

export default function AnalyticsDashboardPage() {
  useRoleGuard(["manager", "admin"]);
  const pipeline = useMemo(() => AnalyticsPipelineService.runPipeline(), []);

  return (
    <main style={{ padding: "2rem", minHeight: "100vh", background: "#FAFAFA" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 style={{ margin: 0 }}>Analytics Dashboard</h1>
            <p style={{ margin: "0.4rem 0 0", color: "#666" }}>Data ingestion, preparation, and predictive outputs (simulated).</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <Link href="/analytics/predictions" style={{ textDecoration: "none", background: "#3B82F6", color: "white", padding: "0.55rem 0.9rem", borderRadius: "6px", fontWeight: 600 }}>
              Predictions
            </Link>
            <Link href="/analytics/reports" style={{ textDecoration: "none", background: "#10B981", color: "white", padding: "0.55rem 0.9rem", borderRadius: "6px", fontWeight: 600 }}>
              Reports
            </Link>
          </div>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.8rem" }}>
          <div className="card">
            <p style={{ margin: 0, color: "#666" }}>Trips Ingested</p>
            <h2 style={{ margin: "0.35rem 0 0" }}>{pipeline.ingestion.trips}</h2>
          </div>
          <div className="card">
            <p style={{ margin: 0, color: "#666" }}>Fuel Logs</p>
            <h2 style={{ margin: "0.35rem 0 0" }}>{pipeline.ingestion.fuelLogs}</h2>
          </div>
          <div className="card">
            <p style={{ margin: 0, color: "#666" }}>Average Cost / Trip</p>
            <h2 style={{ margin: "0.35rem 0 0" }}>${pipeline.features.averageCostPerTrip.toFixed(2)}</h2>
          </div>
          <div className="card">
            <p style={{ margin: 0, color: "#666" }}>Monthly Forecast</p>
            <h2 style={{ margin: "0.35rem 0 0" }}>${(pipeline.connectorAI.currentMonthForecast?.estimatedMonthlyExpense || 0).toFixed(2)}</h2>
          </div>
        </section>

        <section className="card" style={{ display: "grid", gap: "0.6rem" }}>
          <h3 style={{ margin: 0 }}>Data Preparation Pipeline</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
            <div style={{ padding: "0.7rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
              <strong>1) Ingestion & Validation</strong>
              <p style={{ margin: "0.3rem 0 0", color: "#666" }}>{pipeline.ingestion.validationIssues.length} validation issue(s)</p>
            </div>
            <div style={{ padding: "0.7rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
              <strong>2) Cleaning & Staging</strong>
              <p style={{ margin: "0.3rem 0 0", color: "#666" }}>{pipeline.staging.cleanedTrips} cleaned trip record(s)</p>
            </div>
            <div style={{ padding: "0.7rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
              <strong>3) Feature Engineering</strong>
              <p style={{ margin: "0.3rem 0 0", color: "#666" }}>{pipeline.features.records.length} feature row(s)</p>
            </div>
            <div style={{ padding: "0.7rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
              <strong>4) Data Marts</strong>
              <p style={{ margin: "0.3rem 0 0", color: "#666" }}>{pipeline.marts.monthlyCostMart.length} month bucket(s)</p>
            </div>
          </div>
        </section>

        <section className="card" style={{ overflowX: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Feature Engineered Trip Metrics</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Trip", "Driver", "Distance", "Fuel Efficiency", "Delivery Time", "Cost"].map((label) => (
                  <th key={label} style={{ textAlign: "left", borderBottom: "1px solid #E8E8E8", padding: "0.55rem" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pipeline.features.records.slice(0, 8).map((row) => (
                <tr key={row.tripId}>
                  <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.tripId}</td>
                  <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.driverName}</td>
                  <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.distanceKm.toFixed(1)} km</td>
                  <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.fuelEfficiencyKmPerLiter.toFixed(2)} km/L</td>
                  <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.deliveryHours.toFixed(2)} hrs</td>
                  <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>${row.totalCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

