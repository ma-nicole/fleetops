"use client";

import { useEffect, useMemo } from "react";

import { useParams, useRouter } from "next/navigation";

import Breadcrumbs from "@/components/Breadcrumbs";
import CustomerPortalDashboard from "@/components/CustomerPortalDashboard";
import KpiCard from "@/components/KpiCard";

const roleConfigs: Record<string, {
  title: string;
  subtitle: string;
  modules: string[];
  kpis: Array<{ label: string; value: string }>;
  quickActions: Array<{ label: string; description: string }>;
  alerts: Array<{ label: string; tone: "good" | "warning" | "alert" }>;
  timeline: string[];
}> = {
  customer: {
    title: "Active Shipment Tracking",
    subtitle: "Logistics Management System",
    modules: [
      "Account and profile management",
      "Create and cancel booking requests",
      "View active bookings and booking history",
      "Payment preference and support contact",
    ],
    kpis: [
      { label: "Active Bookings", value: "12" },
      { label: "On-time Deliveries", value: "94%" },
      { label: "Avg Booking Cost", value: "$1,240" },
    ],
    quickActions: [
      { label: "Create a booking", description: "Start a new shipment request with live pricing." },
      { label: "Review recent bookings", description: "Check status and payment history." },
      { label: "Save a location", description: "Store frequent pickup and dropoff points." },
    ],
    alerts: [
      { label: "2 bookings awaiting payment", tone: "warning" },
      { label: "Next delivery due today", tone: "good" },
    ],
    timeline: ["Requested", "Payment pending", "Assigned", "In transit", "Delivered"],
  },
  dispatcher: {
    title: "Dispatcher Console",
    subtitle: "Pending assignments, route issues, and live handoff coordination.",
    modules: [
      "Assign trucks and drivers",
      "Manage schedule conflicts and updates",
      "Approve route plans",
      "Handle delays and exceptions",
    ],
    kpis: [
      { label: "Pending Assignments", value: "8" },
      { label: "Trips Ongoing", value: "21" },
      { label: "Conflict Alerts", value: "3" },
    ],
    quickActions: [
      { label: "Assign next trip", description: "Drag a driver card onto an open route." },
      { label: "Resolve conflicts", description: "Review late arrivals and duplicate loads." },
      { label: "Open route map", description: "Check ETA changes and traffic hot spots." },
    ],
    alerts: [
      { label: "3 routes at risk of delay", tone: "alert" },
      { label: "5 drivers available now", tone: "good" },
    ],
    timeline: ["Pending", "Assigned", "Loaded", "In transit", "Completed"],
  },
  driver: {
    title: "Driver & Helper App",
    subtitle: "Assigned trips, earnings, attendance check-in, and route status.",
    modules: [
      "View assigned trips and alternate routes",
      "Track duration and maintenance status",
      "Salary and deductions visibility",
      "Attendance check-in and trip reporting",
    ],
    kpis: [
      { label: "Trips This Week", value: "6" },
      { label: "Attendance", value: "98%" },
      { label: "Safety Score", value: "4.7/5" },
    ],
    quickActions: [
      { label: "Check in for shift", description: "Mark attendance and confirm readiness." },
      { label: "Open next delivery", description: "Review route, ETA, and cargo notes." },
      { label: "View earnings", description: "See today’s payout and recent settlements." },
    ],
    alerts: [
      { label: "Next delivery in 42 minutes", tone: "warning" },
      { label: "Attendance streak intact", tone: "good" },
    ],
    timeline: ["Check-in", "Pickup", "In transit", "Dropoff", "Invoice"],
  },
  manager: {
    title: "Manager Analytics Hub",
    subtitle: "KPIs, forecasts, cost analysis, driver compliance, and fleet health.",
    modules: [
      "Fleet performance and cost trends",
      "Demand, fuel, and maintenance forecasts",
      "Driver compliance and ratings",
      "Financial and pricing configuration",
    ],
    kpis: [
      { label: "Fuel Spend", value: "$45,200" },
      { label: "Toll Spend", value: "$12,880" },
      { label: "Predicted Demand", value: "+9.2%" },
      { label: "Breakdown Risk", value: "Low" },
    ],
    quickActions: [
      { label: "Review top performers", description: "See the best drivers and routes this week." },
      { label: "Open forecast view", description: "Check upcoming demand and capacity pressure." },
      { label: "Export report", description: "Share KPI snapshots with leadership." },
    ],
    alerts: [
      { label: "3 maintenance issues pending", tone: "alert" },
      { label: "High demand expected next week", tone: "warning" },
    ],
    timeline: ["Today", "This week", "Forecast", "Budget review"],
  },
  admin: {
    title: "Admin Control Center",
    subtitle: "User management, pricing config, fleet inventory, and audit logs.",
    modules: [
      "User and role management",
      "System settings and activity logs",
      "Fleet records and access controls",
      "Governance and policy enforcement",
    ],
    kpis: [
      { label: "Users", value: "138" },
      { label: "Active Sessions", value: "44" },
      { label: "Policy Alerts", value: "2" },
    ],
    quickActions: [
      { label: "Manage users", description: "Update access, roles, and onboarding status." },
      { label: "Review audit log", description: "Trace sensitive changes and approvals." },
      { label: "Update pricing", description: "Adjust tariff and service rules." },
    ],
    alerts: [
      { label: "2 policy exceptions found", tone: "alert" },
      { label: "Fleet inventory up to date", tone: "good" },
    ],
    timeline: ["Users", "Roles", "Pricing", "Fleet", "Audit"],
  },
};

export default function RoleDashboardPage() {
  const params = useParams<{ role: string }>();
  const role = (params.role || "manager").toLowerCase();
  const router = useRouter();

  const config = useMemo(() => roleConfigs[role] || roleConfigs.manager, [role]);

  useEffect(() => {
    if (role === "manager") {
      router.replace("/manager/dashboard");
    }
  }, [role, router]);

  if (role === "manager") {
    return (
      <main className="container" style={{ display: "grid", gap: "0.75rem", padding: "2rem", textAlign: "center", minHeight: "40vh", placeContent: "center" }}>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>Redirecting to manager dashboard…</p>
      </main>
    );
  }

  if (role === "customer") {
    return <CustomerPortalDashboard />;
  }

  return (
    <main className="container" style={{ display: "grid", gap: "1rem" }}>
      <section className="card" style={{ display: "grid", gap: "1rem" }}>
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard/manager" },
            { label: role.charAt(0).toUpperCase() + role.slice(1) },
          ]}
        />
        <h1 style={{ margin: 0 }}>{config.title}</h1>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>{config.subtitle}</p>
        <div className="grid kpi-grid">
          {config.kpis.map((kpi) => (
            <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
          ))}
        </div>
      </section>

      <section className="card" style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Quick actions</h2>
        <div className="quick-action-grid">
          {config.quickActions.map((action) => (
            <div key={action.label} className="quick-action-card">
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>At-a-glance alerts</h2>
        <div className="alert-row">
          {config.alerts.map((alert) => (
            <span key={alert.label} className={`status-chip ${alert.tone}`}>
              {alert.label}
            </span>
          ))}
        </div>
      </section>

      <section className="card" style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Workflow timeline</h2>
        <div className="timeline">
          {config.timeline.map((step, index) => (
            <div key={step} className="timeline-step">
              <span className="timeline-dot" />
              <span>{index + 1}. {step}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ display: "grid", gap: "0.7rem" }}>
        <h2 style={{ margin: 0 }}>Role Modules</h2>
        {config.modules.map((item) => (
          <div key={item} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "0.7rem" }}>
            {item}
          </div>
        ))}
      </section>
    </main>
  );
}
