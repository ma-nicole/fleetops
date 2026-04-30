"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

type DispatcherStats = {
  activeTrips: number;
  pendingAssignments: number;
  delayedTrips: number;
  completedToday: number;
  availableDrivers: number;
  onTimePercentage: number;
};

type TripSummary = {
  id: string;
  driverName: string;
  route: string;
  status: "pending" | "assigned" | "in_progress" | "delayed" | "completed";
  startTime: string;
  eta: string;
};

export default function DispatcherDashboard() {
  useRoleGuard(["dispatcher"]);
  const router = useRouter();

  const [stats] = useState<DispatcherStats>({
    activeTrips: 18,
    pendingAssignments: 4,
    delayedTrips: 2,
    completedToday: 12,
    availableDrivers: 8,
    onTimePercentage: 94,
  });

  const [recentTrips] = useState<TripSummary[]>([
    {
      id: "TRIP-001",
      driverName: "Carlos Rodriguez",
      route: "Makati → Quezon City",
      status: "in_progress",
      startTime: "09:30 AM",
      eta: "11:45 AM",
    },
    {
      id: "TRIP-002",
      driverName: "Maria Santos",
      route: "Pasig → Makati",
      status: "assigned",
      startTime: "12:30 PM",
      eta: "02:15 PM",
    },
    {
      id: "TRIP-003",
      driverName: "Pending Assignment",
      route: "Las Piñas → Taguig",
      status: "pending",
      startTime: "03:30 PM",
      eta: "05:00 PM",
    },
    {
      id: "TRIP-004",
      driverName: "Juan Dela Cruz",
      route: "Santa Rosa → Paranaque",
      status: "delayed",
      startTime: "06:00 AM",
      eta: "08:30 AM",
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#2196F3";
      case "assigned":
        return "#9C27B0";
      case "in_progress":
        return "#FF9800";
      case "delayed":
        return "#F44336";
      case "completed":
        return "#4CAF50";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳ Pending";
      case "assigned":
        return "✓ Assigned";
      case "in_progress":
        return "🚚 In Progress";
      case "delayed":
        return "⚠️ Delayed";
      case "completed":
        return "✅ Completed";
      default:
        return "Unknown";
    }
  };

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Dispatcher Dashboard</h1>
        <p style={{ color: "#666666", margin: "0" }}>Operations overview and trip management</p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))",
          }}
        >
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.85rem", fontWeight: "600" }}>
            ACTIVE TRIPS
          </p>
          <p style={{ color: "#FF9800", fontSize: "2.5rem", fontWeight: "700", margin: "0" }}>
            {stats.activeTrips}
          </p>
          <p style={{ color: "#666666", margin: "0.5rem 0 0 0", fontSize: "0.85rem" }}>ongoing</p>
        </div>

        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(244, 67, 54, 0.05))",
          }}
        >
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.85rem", fontWeight: "600" }}>
            PENDING ASSIGNMENTS
          </p>
          <p style={{ color: "#F44336", fontSize: "2.5rem", fontWeight: "700", margin: "0" }}>
            {stats.pendingAssignments}
          </p>
          <p style={{ color: "#666666", margin: "0.5rem 0 0 0", fontSize: "0.85rem" }}>trips</p>
        </div>

        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05))",
          }}
        >
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.85rem", fontWeight: "600" }}>
            AVAILABLE DRIVERS
          </p>
          <p style={{ color: "#2196F3", fontSize: "2.5rem", fontWeight: "700", margin: "0" }}>
            {stats.availableDrivers}
          </p>
          <p style={{ color: "#666666", margin: "0.5rem 0 0 0", fontSize: "0.85rem" }}>ready</p>
        </div>

        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))",
          }}
        >
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.85rem", fontWeight: "600" }}>
            ON-TIME PERFORMANCE
          </p>
          <p style={{ color: "#4CAF50", fontSize: "2.5rem", fontWeight: "700", margin: "0" }}>
            {stats.onTimePercentage}%
          </p>
          <p style={{ color: "#666666", margin: "0.5rem 0 0 0", fontSize: "0.85rem" }}>this month</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Quick Actions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
          <Link
            href="/dispatcher/scheduled-bookings"
            style={{
              padding: "1rem",
              background: "#FF9800",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            📅 Bookings
          </Link>
          <Link
            href="/dispatcher/order-details"
            style={{
              padding: "1rem",
              background: "#2196F3",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            📋 Orders
          </Link>
          <Link
            href="/dispatcher/assets"
            style={{
              padding: "1rem",
              background: "#4CAF50",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            👥 Assets
          </Link>
          <Link
            href="/dispatcher/ongoing-operations"
            style={{
              padding: "1rem",
              background: "#9C27B0",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            🔄 Operations
          </Link>
          <Link
            href="/dispatcher/driver-activity"
            style={{
              padding: "1rem",
              background: "#00BCD4",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            🚗 Drivers
          </Link>
          <Link
            href="/dispatcher/log-report"
            style={{
              padding: "1rem",
              background: "#FF6B6B",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            📝 Log Report
          </Link>
        </div>
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "white" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Dispatcher Sequence Flow</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
          {[
            { label: "Scheduled Bookings", href: "/dispatcher/scheduled-bookings" },
            { label: "Order Details", href: "/dispatcher/order-details" },
            { label: "People & Assets", href: "/dispatcher/assets" },
            { label: "Ongoing Operations", href: "/dispatcher/ongoing-operations" },
            { label: "Driver Activity", href: "/dispatcher/driver-activity" },
            { label: "Reported Issues", href: "/dispatcher/reported-issues" },
            { label: "Accomplishment Report", href: "/dispatcher/accomplishment-report" },
            { label: "Log Report", href: "/dispatcher/log-report" },
            { label: "Confirm Completion", href: "/dispatcher/confirm-completion" },
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

      {/* Active Trips List */}
      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Live Trip Monitor</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {recentTrips.map((trip) => (
            <div
              key={trip.id}
              style={{
                padding: "1rem",
                border: `2px solid ${getStatusColor(trip.status)}`,
                borderRadius: "6px",
                background: "#F9F9F9",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0" }}>{trip.id}</p>
                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  Driver: {trip.driverName}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ROUTE</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {trip.route}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TIMELINE</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  {trip.startTime} → {trip.eta}
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <span
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: getStatusColor(trip.status) + "20",
                    color: getStatusColor(trip.status),
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getStatusLabel(trip.status)}
                </span>

                {trip.status === "pending" && (
                  <button
                    style={{
                      padding: "0.4rem 0.75rem",
                      background: "#FF9800",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.75rem",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => alert("Assign trip " + trip.id)}
                  >
                    Assign
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Section */}
      {stats.delayedTrips > 0 && (
        <div style={{ padding: "1.5rem", background: "#FFEBEE", borderRadius: "8px", border: "1px solid #F44336" }}>
          <p style={{ color: "#C62828", fontWeight: "600", margin: "0" }}>⚠️ Delayed Trips Alert</p>
          <p style={{ color: "#C62828", margin: "0.5rem 0 0 0", fontSize: "0.9rem" }}>
            {stats.delayedTrips} trip(s) are currently delayed. Take immediate action to resolve.
          </p>
        </div>
      )}
    </div>
  );
}
