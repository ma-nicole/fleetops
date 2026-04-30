"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function PrescriptiveAnalyticsPage() {
  useRoleGuard(["manager", "admin"]);
  
  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/manager" },
        { label: "Analytics & Reporting" },
        { label: "Prescriptive Analytics" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Prescriptive Analytics</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Module: Analytics & Reporting for Fleet Insights → Prescriptive Analytics
        </p>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The Prescriptive Analytics submodule goes beyond predictions to recommend specific actions and optimizations.
          </p>
          <p style={{ color: "#666666" }}>
            Based on predictive models and business rules, this module suggests concrete improvements to operations and costs.
          </p>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Recommendation Types</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li><strong>Route Optimization</strong>: Suggest shortest/fastest routes to reduce fuel and time</li>
            <li><strong>Pricing Adjustments</strong>: Recommend pricing changes based on demand</li>
            <li><strong>Fleet Allocation</strong>: Suggest vehicle assignments for efficiency</li>
            <li><strong>Maintenance Planning</strong>: Recommend preventive maintenance schedules</li>
            <li><strong>Driver Incentives</strong>: Suggest driver performance incentive programs</li>
            <li><strong>Capacity Optimization</strong>: Recommend load consolidation strategies</li>
            <li><strong>Cost Reduction</strong>: Identify opportunities to reduce operational costs</li>
          </ul>
        </div>

        <div className="card">
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Key Features</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>Actionable recommendations with impact estimates</li>
            <li>Priority ranking of recommendations</li>
            <li>Implementation guidance and steps</li>
            <li>ROI and benefit calculations</li>
            <li>Track implemented recommendations</li>
            <li>Feedback and outcome measurement</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
