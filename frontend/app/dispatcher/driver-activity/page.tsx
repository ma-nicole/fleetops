"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type DriverActivity = {
  driverId: string;
  driverName: string;
  status: string;
  currentLocation: string;
  distanceTraveledToday: string;
  tripCount: number;
  lastActivity: string;
  uptime: string;
  rating: number;
};

export default function DriverActivityPage() {
  useRoleGuard(["dispatcher"]);

  const [activities] = useState<DriverActivity[]>([
    {
      driverId: "DRV-001",
      driverName: "Carlos Rodriguez",
      status: "on_trip",
      currentLocation: "EDSA, Makati",
      distanceTraveledToday: "85 km",
      tripCount: 3,
      lastActivity: "Started Trip TRIP-001 at 09:30 AM",
      uptime: "8 hours 30 minutes",
      rating: 4.8,
    },
    {
      driverId: "DRV-002",
      driverName: "Maria Santos",
      status: "on_trip",
      currentLocation: "Quezon City",
      distanceTraveledToday: "62 km",
      tripCount: 2,
      lastActivity: "Arrived at pickup location at 10:45 AM",
      uptime: "6 hours 20 minutes",
      rating: 4.6,
    },
    {
      driverId: "DRV-003",
      driverName: "Juan Dela Cruz",
      status: "on_break",
      currentLocation: "Caloocan Rest Area",
      distanceTraveledToday: "45 km",
      tripCount: 2,
      lastActivity: "Took break at 01:00 PM",
      uptime: "4 hours 15 minutes",
      rating: 4.7,
    },
    {
      driverId: "DRV-004",
      driverName: "Rita Gonzales",
      status: "available",
      currentLocation: "Warehouse",
      distanceTraveledToday: "0 km",
      tripCount: 0,
      lastActivity: "Checked in at 07:00 AM",
      uptime: "2 hours (waiting for assignment)",
      rating: 4.5,
    },
    {
      driverId: "DRV-005",
      driverName: "Miguel Reyes",
      status: "completed_shift",
      currentLocation: "Main Office",
      distanceTraveledToday: "145 km",
      tripCount: 5,
      lastActivity: "Completed shift at 05:00 PM",
      uptime: "10 hours",
      rating: 4.9,
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "#4CAF50";
      case "on_trip":
        return "#FF6B6B";
      case "on_break":
        return "#FF9800";
      case "completed_shift":
        return "#2196F3";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "✓ Available";
      case "on_trip":
        return "🚚 On Trip";
      case "on_break":
        return "☕ On Break";
      case "completed_shift":
        return "✅ Shift Complete";
      default:
        return "Unknown";
    }
  };

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Driver Activity Tracking</h1>
        <p style={{ color: "#666666", margin: "0" }}>Monitor real-time driver location and activity</p>
      </div>

      {/* Activity Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ON TRIP</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {activities.filter((a) => a.status === "on_trip").length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>AVAILABLE</p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {activities.filter((a) => a.status === "available").length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ON BREAK</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {activities.filter((a) => a.status === "on_break").length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>SHIFT COMPLETE</p>
          <p style={{ color: "#2196F3", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {activities.filter((a) => a.status === "completed_shift").length}
          </p>
        </div>
      </div>

      {/* Activity List */}
      <div style={{ display: "grid", gap: "1rem" }}>
        {activities.map((activity) => (
          <div
            key={activity.driverId}
            style={{
              padding: "1.5rem",
              border: `2px solid ${getStatusColor(activity.status)}`,
              borderRadius: "8px",
              background: "#F9F9F9",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1.5rem", marginBottom: "1rem", alignItems: "center" }}>
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0" }}>{activity.driverName}</h3>
                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  {activity.driverId} • ⭐ {activity.rating}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LOCATION</p>
                <p style={{ color: "#2196F3", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  📍 {activity.currentLocation}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TODAY'S ACTIVITY</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {activity.distanceTraveledToday} • {activity.tripCount} trips
                </p>
              </div>

              <span
                style={{
                  padding: "0.4rem 0.75rem",
                  background: getStatusColor(activity.status) + "20",
                  color: getStatusColor(activity.status),
                  borderRadius: "4px",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                }}
              >
                {getStatusLabel(activity.status)}
              </span>
            </div>

            <div
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #E8E8E8",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LAST ACTIVITY</p>
                  <p style={{ color: "#1A1A1A", fontSize: "0.9rem", margin: "0.25rem 0 0 0" }}>
                    {activity.lastActivity}
                  </p>
                </div>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>UPTIME</p>
                  <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {activity.uptime}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                style={{
                  padding: "0.5rem 1rem",
                  background: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                }}
                onClick={() => alert("Viewing map for " + activity.driverName)}
              >
                View Location
              </button>
              <button
                style={{
                  padding: "0.5rem 1rem",
                  background: "#FF9800",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                }}
                onClick={() => alert("Contacting " + activity.driverName)}
              >
                Contact
              </button>
              {activity.status === "available" && (
                <button
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                  }}
                  onClick={() => alert("Assigning trip to " + activity.driverName)}
                >
                  Assign Trip
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
