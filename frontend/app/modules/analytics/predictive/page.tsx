"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function PredictiveAnalyticsPage() {
  useRoleGuard(["manager", "admin"]);
  
  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/manager" },
        { label: "Analytics & Reporting" },
        { label: "Predictive Analytics" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Predictive Analytics</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Module: Analytics & Reporting for Fleet Insights → Predictive Analytics
        </p>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The Predictive Analytics submodule uses historical trip and cost data to forecast future trends and patterns.
          </p>
          <p style={{ color: "#666666" }}>
            This is the first step in the Analytics & Reporting flow and provides data-driven insights for decision making.
          </p>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Predictive Models</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li><strong>Demand Forecasting</strong>: Predict trip volume for future periods</li>
            <li><strong>Revenue Projection</strong>: Estimate future revenue based on trends</li>
            <li><strong>Cost Prediction</strong>: Forecast operational costs</li>
            <li><strong>Fuel Consumption</strong>: Predict fuel requirements for planning</li>
            <li><strong>Driver Performance</strong>: Identify high-performing and at-risk drivers</li>
            <li><strong>Route Optimization</strong>: Recommend efficient routes</li>
            <li><strong>Peak Hour Analysis</strong>: Identify busy periods and trends</li>
          </ul>
        </div>

        <div className="card">
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Key Features</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>Time-series forecasting with trend analysis</li>
            <li>Seasonal pattern detection</li>
            <li>Anomaly detection in data</li>
            <li>Machine learning model visualization</li>
            <li>Confidence intervals and prediction ranges</li>
            <li>Export predictions for planning tools</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
