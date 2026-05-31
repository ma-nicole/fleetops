"use client";

import { useEffect, useMemo } from "react";

import { useParams, useRouter } from "next/navigation";

import Breadcrumbs from "@/components/Breadcrumbs";
import CustomerPortalDashboard from "@/components/CustomerPortalDashboard";
import KpiCard from "@/components/KpiCard";
import SectionJumpLink from "@/components/ui/SectionJumpLink";

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
      { label: "Active Bookings", value: "—" },
      { label: "On-time Deliveries", value: "—" },
      { label: "Avg Booking Cost", value: "—" },
    ],
    quickActions: [
      { label: "Create a booking", description: "Start a new shipment request with live pricing." },
      { label: "Review recent bookings", description: "Check status and payment history." },
      { label: "Save a location", description: "Store frequent pickup and dropoff points." },
    ],
    alerts: [
      { label: "Open the customer portal for live booking and payment alerts", tone: "good" },
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
      { label: "Pending Assignments", value: "—" },
      { label: "Trips Ongoing", value: "—" },
      { label: "Conflict Alerts", value: "—" },
    ],
    quickActions: [
      { label: "Assign next trip", description: "Drag a driver card onto an open route." },
      { label: "Resolve conflicts", description: "Review late arrivals and duplicate loads." },
      { label: "Open route map", description: "Check ETA changes and traffic hot spots." },
    ],
    alerts: [
      { label: "Use the dispatcher console for live route and assignment alerts", tone: "good" },
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
      { label: "Trips This Week", value: "—" },
      { label: "Attendance", value: "—" },
      { label: "Safety Score", value: "—" },
    ],
    quickActions: [
      { label: "Check in for shift", description: "Mark attendance and confirm readiness." },
      { label: "Open next delivery", description: "Review route, ETA, and cargo notes." },
      { label: "View earnings", description: "See today’s payout and recent settlements." },
    ],
    alerts: [
      { label: "Open the driver app modules for live trip alerts", tone: "good" },
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
      { label: "Fuel Spend", value: "—" },
      { label: "Toll Spend", value: "—" },
      { label: "Predicted Demand", value: "—" },
      { label: "Breakdown Risk", value: "—" },
    ],
    quickActions: [
      { label: "Review top performers", description: "See the best drivers and routes this week." },
      { label: "Open forecast view", description: "Check upcoming demand and capacity pressure." },
      { label: "Export report", description: "Share KPI snapshots with leadership." },
    ],
    alerts: [
      { label: "Use analytics and operations modules for fleet health alerts", tone: "good" },
    ],
    timeline: ["Today", "This week", "Forecast", "Budget review"],
  },
  admin: {
    title: "Admin Control Center",
    subtitle: "User management, fleet inventory, and audit logs.",
    modules: [
      "User and role management",
      "Activity logs and oversight",
      "Fleet records and access controls",
      "Governance and policy enforcement",
    ],
    kpis: [
      { label: "Users", value: "—" },
      { label: "Active Sessions", value: "—" },
      { label: "Policy Alerts", value: "—" },
    ],
    quickActions: [
      { label: "Manage users", description: "Update access, roles, and onboarding status." },
      { label: "Review audit log", description: "Trace sensitive changes and approvals." },
      { label: "Fleet records", description: "Review trucks, assignments, and inventory status." },
    ],
    alerts: [
      { label: "Use admin tools for live access and audit notifications", tone: "good" },
    ],
    timeline: ["Users", "Roles", "Fleet", "Audit"],
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
      <main className="container" style={{ display: "grid", gap: "0.75rem", padding: "var(--page-main-padding)", textAlign: "center", minHeight: "40vh", placeContent: "center" }}>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>Redirecting to manager dashboard…</p>
      </main>
    );
  }

  if (role === "customer") {
    return <CustomerPortalDashboard />;
  }

  return (
    <main className="container" style={{ display: "grid", gap: "1rem" }}>
      <nav className="tab-pills" aria-label="Jump to dashboard section">
        <SectionJumpLink targetId="role-kpis">KPIs</SectionJumpLink>
        <SectionJumpLink targetId="role-actions">Quick actions</SectionJumpLink>
        <SectionJumpLink targetId="role-alerts">Alerts</SectionJumpLink>
        <SectionJumpLink targetId="role-timeline">Timeline</SectionJumpLink>
        <SectionJumpLink targetId="role-modules">Modules</SectionJumpLink>
      </nav>

      <section id="role-kpis" className="card scroll-section" style={{ display: "grid", gap: "1rem" }}>
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

      <section id="role-actions" className="card scroll-section" style={{ display: "grid", gap: "0.75rem" }}>
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

      <section id="role-alerts" className="card scroll-section" style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>At-a-glance alerts</h2>
        <div className="alert-row">
          {config.alerts.map((alert) => (
            <span key={alert.label} className={`status-chip ${alert.tone}`}>
              {alert.label}
            </span>
          ))}
        </div>
      </section>

      <section id="role-timeline" className="card scroll-section" style={{ display: "grid", gap: "0.75rem" }}>
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

      <section id="role-modules" className="card scroll-section" style={{ display: "grid", gap: "0.7rem" }}>
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
