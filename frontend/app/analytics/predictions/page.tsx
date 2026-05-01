"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AnalyticsPipelineService } from "@/lib/analyticsPipelineService";
import { formatPhp } from "@/lib/appLocale";

export default function AnalyticsPredictionsPage() {
  useRoleGuard(["manager", "admin"]);
  const pipeline = useMemo(() => AnalyticsPipelineService.runPipeline(), []);

  return (
    <main style={{ padding: "2rem", minHeight: "100vh", background: "#FAFAFA" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 style={{ margin: 0 }}>Predictive Models</h1>
            <p style={{ margin: "0.4rem 0 0", color: "#666" }}>Simulated trip cost prediction, maintenance risk, and monthly cost forecasting.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <Link href="/analytics/dashboard" style={{ textDecoration: "none", background: "#6B7280", color: "white", padding: "0.55rem 0.9rem", borderRadius: "6px", fontWeight: 600 }}>
              Dashboard
            </Link>
            <Link href="/analytics/reports" style={{ textDecoration: "none", background: "#10B981", color: "white", padding: "0.55rem 0.9rem", borderRadius: "6px", fontWeight: 600 }}>
              Reports
            </Link>
          </div>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "0.8rem" }}>
          <div className="card">
            <p style={{ margin: 0, color: "#666" }}>Trip Cost Prediction</p>
            <h3 style={{ margin: "0.4rem 0 0" }}>
              {formatPhp(pipeline.connectorAI.topTripCostPrediction?.predictedCost || 0)}
            </h3>
          </div>
          <div className="card">
            <p style={{ margin: 0, color: "#666" }}>Maintenance Risk</p>
            <h3 style={{ margin: "0.4rem 0 0" }}>{pipeline.connectorAI.highestRiskVehicle?.riskLevel || "Low"}</h3>
          </div>
          <div className="card">
            <p style={{ margin: 0, color: "#666" }}>Monthly Cost Forecast</p>
            <h3 style={{ margin: "0.4rem 0 0" }}>
              {formatPhp(pipeline.connectorAI.currentMonthForecast?.estimatedMonthlyExpense || 0)}
            </h3>
          </div>
        </section>

        <section className="card" style={{ overflowX: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Trip Cost Prediction Model</h3>
          <p style={{ marginTop: 0, color: "#666" }}>Formula: fuel + toll + labor + fixed rate</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Trip", "Predicted Cost", "Model Formula"].map((label) => (
                  <th key={label} style={{ textAlign: "left", borderBottom: "1px solid #E8E8E8", padding: "0.55rem" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pipeline.predictions.tripCost.map((row) => (
                <tr key={row.tripId}>
                  <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.tripId}</td>
                  <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{formatPhp(row.predictedCost)}</td>
                  <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="card" style={{ overflowX: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Maintenance Risk Model</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Vehicle", "Maintenance Frequency", "Risk Level"].map((label) => (
                    <th key={label} style={{ textAlign: "left", borderBottom: "1px solid #E8E8E8", padding: "0.55rem" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipeline.predictions.maintenanceRisk.map((row) => (
                  <tr key={row.truckId}>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.truckId}</td>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.maintenanceFrequency}</td>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.riskLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Monthly Forecasting Model</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Period", "Estimated Expense"].map((label) => (
                    <th key={label} style={{ textAlign: "left", borderBottom: "1px solid #E8E8E8", padding: "0.55rem" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipeline.predictions.monthlyForecast.map((row) => (
                  <tr key={row.month}>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{row.month}</td>
                    <td style={{ borderBottom: "1px solid #F1F1F1", padding: "0.55rem" }}>{formatPhp(row.estimatedMonthlyExpense)}</td>
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

