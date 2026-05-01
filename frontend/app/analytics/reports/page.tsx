"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AnalyticsPipelineService } from "@/lib/analyticsPipelineService";
import { formatPhp } from "@/lib/appLocale";

export default function AnalyticsReportsPage() {
  useRoleGuard(["manager", "admin"]);
  const pipeline = useMemo(() => AnalyticsPipelineService.runPipeline(), []);

  return (
    <main style={{ padding: "2rem", minHeight: "100vh", background: "#FAFAFA" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 style={{ margin: 0 }}>Analytics Reports</h1>
            <p style={{ margin: "0.4rem 0 0", color: "#666" }}>Connector AI summary and reporting data marts.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <Link href="/analytics/dashboard" style={{ textDecoration: "none", background: "#6B7280", color: "white", padding: "0.55rem 0.9rem", borderRadius: "6px", fontWeight: 600 }}>
              Dashboard
            </Link>
            <Link href="/analytics/predictions" style={{ textDecoration: "none", background: "#3B82F6", color: "white", padding: "0.55rem 0.9rem", borderRadius: "6px", fontWeight: 600 }}>
              Predictions
            </Link>
          </div>
        </div>

        <section className="card">
          <h3 style={{ marginTop: 0 }}>Connector AI Output</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "0.7rem" }}>
            <div style={{ padding: "0.7rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
              <p style={{ margin: 0, color: "#666" }}>Top Predicted Trip Cost</p>
              <p style={{ margin: "0.35rem 0 0", fontWeight: 700 }}>
                {pipeline.connectorAI.topTripCostPrediction?.tripId || "-"} •{" "}
                {formatPhp(pipeline.connectorAI.topTripCostPrediction?.predictedCost || 0)}
              </p>
            </div>
            <div style={{ padding: "0.7rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
              <p style={{ margin: 0, color: "#666" }}>Highest Maintenance Risk Vehicle</p>
              <p style={{ margin: "0.35rem 0 0", fontWeight: 700 }}>
                {pipeline.connectorAI.highestRiskVehicle?.truckId || "-"} • {pipeline.connectorAI.highestRiskVehicle?.riskLevel || "Low"}
              </p>
            </div>
            <div style={{ padding: "0.7rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
              <p style={{ margin: 0, color: "#666" }}>Estimated Next Month Expense</p>
              <p style={{ margin: "0.35rem 0 0", fontWeight: 700 }}>
                {formatPhp(pipeline.connectorAI.currentMonthForecast?.estimatedMonthlyExpense || 0)}
              </p>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="card" style={{ overflowX: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Trip Cost Mart</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Trip", "Total Cost", "Cost/Km"].map((label) => (
                    <th key={label} style={{ textAlign: "left", borderBottom: "1px solid #E8E8E8", padding: "0.55rem" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipeline.marts.tripCostMart.map((row) => (
                  <tr key={row.tripId}>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.tripId}</td>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{formatPhp(row.totalCost)}</td>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{formatPhp(row.costPerKm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Monthly Cost Mart</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Month", "Trips", "Total Cost"].map((label) => (
                    <th key={label} style={{ textAlign: "left", borderBottom: "1px solid #E8E8E8", padding: "0.55rem" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipeline.marts.monthlyCostMart.map((row) => (
                  <tr key={row.month}>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.month}</td>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.tripCount}</td>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{formatPhp(row.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

