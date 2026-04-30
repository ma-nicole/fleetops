"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type ManagerStats = {
  totalBookings: number;
  totalDrivers: number;
  totalDispatchers: number;
  totalTrucks: number;
  totalRevenue: string;
  completedTrips: number;
  onTimePercentage: number;
  costPerKm: string;
};

type RecentActivity = {
  id: string;
  type: "booking" | "trip" | "driver" | "dispatcher";
  description: string;
  timestamp: string;
  status: "completed" | "in_progress" | "pending";
};

export default function ManagerDashboard() {
  useRoleGuard(["manager", "admin"]);

  const [stats] = useState<ManagerStats>({
    totalBookings: 1247,
    totalDrivers: 45,
    totalDispatchers: 8,
    totalTrucks: 52,
    totalRevenue: "$245,680.50",
    completedTrips: 1156,
    onTimePercentage: 92,
    costPerKm: "$1.45",
  });

  const [recentActivities] = useState<RecentActivity[]>([
    {
      id: "ACT-001",
      type: "booking",
      description: "New booking from ABC Retail Corp - Manila to Cebu",
      timestamp: "Today, 2:30 PM",
      status: "completed",
    },
    {
      id: "ACT-002",
      type: "trip",
      description: "Trip TR-2024-156 completed by Driver Carlos Rodriguez",
      timestamp: "Today, 1:15 PM",
      status: "completed",
    },
    {
      id: "ACT-003",
      type: "driver",
      description: "New driver registration - Maria Santos",
      timestamp: "Today, 10:45 AM",
      status: "completed",
    },
    {
      id: "ACT-004",
      type: "dispatcher",
      description: "Dispatcher John assigned 12 trips",
      timestamp: "Today, 9:30 AM",
      status: "in_progress",
    },
    {
      id: "ACT-005",
      type: "booking",
      description: "Booking BK-2024-847 pending confirmation",
      timestamp: "Today, 8:00 AM",
      status: "pending",
    },
  ]);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>
            Manager Dashboard
          </h1>
          <p style={{ margin: 0, color: "#666", fontSize: "1rem" }}>Welcome back! Here's your fleet overview.</p>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Bookings</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>{stats.totalBookings}</div>
            <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>This month</div>
          </div>

          <div
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Active Drivers</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>{stats.totalDrivers}</div>
            <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>On payroll</div>
          </div>

          <div
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Revenue</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>{stats.totalRevenue}</div>
            <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>This month</div>
          </div>

          <div
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>On-Time %</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>{stats.onTimePercentage}%</div>
            <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>Trip completion</div>
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "2rem",
            marginBottom: "2rem",
          }}
        >
          {/* Recent Activities */}
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem", fontWeight: 700 }}>Recent Activities</h2>
            <div style={{ display: "grid", gap: "1rem" }}>
              {recentActivities.map((activity) => (
                <div key={activity.id} style={{ padding: "1rem", borderLeft: "3px solid #FF9800", background: "#FAFAFA", borderRadius: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "#666", textTransform: "capitalize" }}>{activity.type}</span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "4px",
                        background: activity.status === "completed" ? "#D4EDDA" : activity.status === "in_progress" ? "#FFF3CD" : "#F8D7DA",
                        color: activity.status === "completed" ? "#155724" : activity.status === "in_progress" ? "#856404" : "#721C24",
                        textTransform: "capitalize",
                      }}
                    >
                      {activity.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.5rem 0", fontSize: "0.95rem", color: "#1A1A1A" }}>{activity.description}</p>
                  <div style={{ fontSize: "0.8rem", color: "#999" }}>{activity.timestamp}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem", fontWeight: 700 }}>Quick Access</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <Link
                href="/manager/analytics"
                style={{
                  display: "block",
                  padding: "0.75rem",
                  background: "#FF9800",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                Analytics Overview
              </Link>
              <Link
                href="/manager/driver-profiles"
                style={{
                  display: "block",
                  padding: "0.75rem",
                  background: "#0EA5E9",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                Driver Profiles
              </Link>
              <Link
                href="/manager/truck-management"
                style={{
                  display: "block",
                  padding: "0.75rem",
                  background: "#10B981",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                Truck Management
              </Link>
              <Link
                href="/manager/scheduled-bookings"
                style={{
                  display: "block",
                  padding: "0.75rem",
                  background: "#8B5CF6",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                Scheduled Bookings
              </Link>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
          <Link
            href="/manager/pending-bookings"
            style={{
              padding: "1rem",
              background: "white",
              border: "1px solid #E8E8E8",
              borderRadius: "8px",
              textDecoration: "none",
              textAlign: "center",
              color: "#1A1A1A",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
          >
            📅 Pending Bookings
          </Link>
          <Link
            href="/manager/accomplished-bookings"
            style={{
              padding: "1rem",
              background: "white",
              border: "1px solid #E8E8E8",
              borderRadius: "8px",
              textDecoration: "none",
              textAlign: "center",
              color: "#1A1A1A",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
          >
            ✓ Accomplished
          </Link>
          <Link
            href="/manager/customer-profiles"
            style={{
              padding: "1rem",
              background: "white",
              border: "1px solid #E8E8E8",
              borderRadius: "8px",
              textDecoration: "none",
              textAlign: "center",
              color: "#1A1A1A",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
          >
            👥 Customers
          </Link>
          <Link
            href="/manager/payments"
            style={{
              padding: "1rem",
              background: "white",
              border: "1px solid #E8E8E8",
              borderRadius: "8px",
              textDecoration: "none",
              textAlign: "center",
              color: "#1A1A1A",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
          >
            💳 Payments
          </Link>
        </div>

        <div style={{ marginTop: "1rem", padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "12px", background: "white" }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem", fontWeight: 700 }}>Manager Sequence Flow</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {[
              { label: "Analytics Overview", href: "/manager/analytics" },
              { label: "Driver Profiles", href: "/manager/driver-profiles" },
              { label: "Dispatcher Activity", href: "/manager/dispatcher-activity" },
              { label: "Truck Management", href: "/manager/truck-management" },
              { label: "Scheduled Booking", href: "/manager/scheduled-bookings" },
              { label: "Customer Profiles", href: "/manager/customer-profiles" },
              { label: "Payments", href: "/manager/payments" },
              { label: "Order Details", href: "/manager/order-details" },
              { label: "Accomplishment Report", href: "/manager/accomplishment-report" },
              { label: "History", href: "/manager/history" },
              { label: "Pending Booking", href: "/manager/pending-bookings" },
              { label: "Accomplished Booking", href: "/manager/accomplished-bookings" },
              { label: "Customer Reviews", href: "/manager/customer-reviews" },
            ].map((step) => (
              <Link
                key={step.label}
                href={step.href}
                style={{ padding: "0.55rem 0.85rem", borderRadius: "999px", border: "1px solid #E8E8E8", textDecoration: "none", color: "#1A1A1A", fontSize: "0.85rem", fontWeight: 600, background: "#FAFAFA" }}
              >
                {step.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
