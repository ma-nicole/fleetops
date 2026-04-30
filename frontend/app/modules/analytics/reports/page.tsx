"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function DashboardReportsPage() {
  useRoleGuard(["manager", "admin"]);
  
  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/manager" },
        { label: "Analytics & Reporting" },
        { label: "Dashboard & Reports" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Dashboard & Reports</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Module: Analytics & Reporting for Fleet Insights → Dashboard & Reports
        </p>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The Dashboard & Reports submodule is the final step in the Analytics & Reporting flow, providing comprehensive dashboards and detailed reports.
          </p>
          <p style={{ color: "#666666" }}>
            It aggregates data from predictive and prescriptive analytics with real-time operational metrics for executive decision-making.
          </p>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Dashboard Features</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li><strong>Executive Dashboard</strong>: High-level KPIs and performance metrics</li>
            <li><strong>Operations Dashboard</strong>: Real-time trip status and fleet activity</li>
            <li><strong>Financial Dashboard</strong>: Revenue, costs, and profitability metrics</li>
            <li><strong>Driver Performance Dashboard</strong>: Driver ratings, efficiency, and safety</li>
            <li><strong>Fleet Health Dashboard</strong>: Vehicle maintenance and utilization</li>
          </ul>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Report Types</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li><strong>Daily Summary</strong>: Trips, revenue, and costs for a specific day</li>
            <li><strong>Weekly Reports</strong>: Trends, performance, and alerts</li>
            <li><strong>Monthly Financial Reports</strong>: Income statement and cost analysis</li>
            <li><strong>Driver Reports</strong>: Individual driver performance and activity</li>
            <li><strong>Route Efficiency Reports</strong>: Fuel efficiency and time metrics</li>
            <li><strong>Customer Reports</strong>: Booking history and satisfaction</li>
            <li><strong>Custom Reports</strong>: Build custom queries and visualizations</li>
          </ul>
        </div>

        <div className="card">
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Key Features</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>Interactive dashboards with real-time updates</li>
            <li>Customizable widgets and layouts</li>
            <li>Advanced filtering and drill-down capabilities</li>
            <li>Multiple visualization types (charts, graphs, maps)</li>
            <li>Scheduled report generation and email delivery</li>
            <li>Export to PDF, Excel, and other formats</li>
            <li>Comparative analysis and trend visualization</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
