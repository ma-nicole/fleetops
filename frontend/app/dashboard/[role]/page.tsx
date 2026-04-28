"use client";

import { useMemo } from "react";

import { useParams } from "next/navigation";

import Breadcrumbs from "@/components/Breadcrumbs";
import KpiCard from "@/components/KpiCard";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

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

  const config = useMemo(() => roleConfigs[role] || roleConfigs.manager, [role]);

  // Manager role gets the full analytics dashboard
  if (role === "manager") {
    return <AnalyticsDashboard />;
  }

  // Custom layout for customer dashboard
  if (role === "customer") {
    return (
      <main className="container" style={{ display: "grid", gap: "1.5rem", padding: "2rem 1rem" }}>
        {/* Header with role tabs */}
        <section style={{ display: "grid", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "2rem" }}>FleetTrack Analytics</h1>
              <p style={{ margin: "0.5rem 0 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Logistics Management System</p>
            </div>
          </div>

          {/* Role tabs navigation */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {Object.entries(roleConfigs).map(([roleKey, _]) => {
              const isActive = roleKey === role;
              const roleLabel = roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
              return (
                <a
                  key={roleKey}
                  href={`/dashboard/${roleKey}`}
                  style={{
                    padding: "0.75rem 1.25rem",
                    borderRadius: "8px",
                    border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
                    background: isActive ? "rgba(0, 180, 216, 0.12)" : "transparent",
                    color: isActive ? "var(--primary)" : "var(--text)",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    fontSize: "0.95rem",
                    fontWeight: isActive ? "600" : "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span>{roleLabel} Dashboard</span>
                </a>
              );
            })}
          </div>
        </section>

        {/* Two-column layout: Tracking + Quick Booking */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Active Shipment Tracking - Left */}
          <div className="card" style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Active Shipment Tracking</h2>
              <a href="#" style={{ color: "var(--primary)", textDecoration: "none", fontSize: "0.9rem" }}>View All</a>
            </div>

            {/* Order cards */}
            <div style={{ display: "grid", gap: "1rem" }}>
              {[
                {
                  id: "ORD-2024-1245",
                  date: "Mar 11, 2026 · 8:30 AM",
                  from: "Makati Business District",
                  to: "Quezon City Hall",
                  status: "In Transit",
                  progress: 65,
                  eta: "2:30 PM (On Time)",
                },
                {
                  id: "ORD-2024-1246",
                  date: "Mar 11, 2026 · 10:15 AM",
                  from: "Manila Port Area",
                  to: "Pasig Warehouse",
                  status: "Delivered",
                  progress: 100,
                  eta: "Completed",
                },
              ].map((order) => (
                <div
                  key={order.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "1rem",
                    display: "grid",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>{order.id}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Booked: {order.date}</div>
                    </div>
                    <span
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        background: order.status === "In Transit" ? "rgba(0, 180, 216, 0.15)" : "rgba(82, 183, 136, 0.15)",
                        color: order.status === "In Transit" ? "var(--primary)" : "var(--success)",
                      }}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "var(--success)", fontSize: "0.8rem" }}>●</span>
                      <span style={{ color: "var(--text-secondary)" }}>From:</span>
                      <span>{order.from}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "var(--primary)", fontSize: "0.8rem" }}>●</span>
                      <span style={{ color: "var(--text-secondary)" }}>To:</span>
                      <span>{order.to}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Delivery Progress</span>
                      <span style={{ fontWeight: "600" }}>{order.progress}% Complete</span>
                    </div>
                    <div
                      style={{
                        height: "6px",
                        background: "rgba(0, 180, 216, 0.1)",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${order.progress}%`,
                          background: "var(--primary)",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: order.status === "In Transit" ? "var(--success)" : "var(--text-secondary)" }}>
                      <span>✓</span>
                      <span>ETA: {order.eta}</span>
                    </div>
                    {order.status === "In Transit" && (
                      <a href="#" style={{ color: "var(--primary)", textDecoration: "none", fontSize: "0.9rem" }}>Track Live</a>
                    )}
                    {order.status === "Delivered" && (
                      <a href="#" style={{ color: "var(--primary)", textDecoration: "none", fontSize: "0.9rem" }}>View Receipt</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Booking + Account Summary - Right */}
          <div style={{ display: "grid", gap: "1.5rem" }}>
            {/* Quick Booking Card */}
            <div className="card" style={{ display: "grid", gap: "1rem" }}>
              <h2 style={{ margin: 0 }}>Quick Booking</h2>

              <button
                style={{
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #0096c7, #00b4d8)",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                New Booking
              </button>
            </div>

            {/* Account Summary Card */}
            <div className="card" style={{ display: "grid", gap: "1rem" }}>
              <h2 style={{ margin: 0 }}>Account Summary</h2>

              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Account Type</span>
                  <span style={{ fontWeight: "600" }}>Premium</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Member Since</span>
                  <span style={{ fontWeight: "600" }}>Jan 2025</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Default layout for other roles
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
