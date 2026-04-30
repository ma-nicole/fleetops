"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

type DriverStats = {
  activeTrips: number;
  totalEarnings: string;
  completedTrips: number;
  rating: number;
};

type ActiveTrip = {
  id: string;
  routeId: string;
  pickupLocation: string;
  dropoffLocation: string;
  startTime: string;
  estimatedEndTime: string;
  distance: string;
  status: "not_started" | "in_progress" | "completed";
  cargo: string;
  earnings: string;
};

export default function DriverDashboard() {
  useRoleGuard(["driver"]);
  const router = useRouter();

  const [stats] = useState<DriverStats>({
    activeTrips: 3,
    totalEarnings: "$2,450.50",
    completedTrips: 24,
    rating: 4.8,
  });

  const [activeTrips] = useState<ActiveTrip[]>([
    {
      id: "TRIP-001",
      routeId: "RT-2024-0142",
      pickupLocation: "Makati Distribution Center",
      dropoffLocation: "Quezon City Warehouse",
      startTime: "09:30 AM",
      estimatedEndTime: "11:45 AM",
      distance: "28 km",
      status: "in_progress",
      cargo: "Electronics & Parts (450 kg)",
      earnings: "$245.00",
    },
    {
      id: "TRIP-002",
      routeId: "RT-2024-0143",
      pickupLocation: "Pasig Port Area",
      dropoffLocation: "Makati Central",
      startTime: "12:30 PM",
      estimatedEndTime: "2:15 PM",
      distance: "18 km",
      status: "not_started",
      cargo: "Textile & Fabrics (380 kg)",
      earnings: "$175.50",
    },
    {
      id: "TRIP-003",
      routeId: "RT-2024-0144",
      pickupLocation: "Las Piñas Facility",
      dropoffLocation: "Taguig Logistics Hub",
      startTime: "3:30 PM",
      estimatedEndTime: "5:00 PM",
      distance: "22 km",
      status: "not_started",
      cargo: "Industrial Supplies (520 kg)",
      earnings: "$198.75",
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "#FF9800";
      case "completed":
        return "#4CAF50";
      case "not_started":
        return "#2196F3";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_progress":
        return "🚚 In Progress";
      case "completed":
        return "✅ Completed";
      case "not_started":
        return "📍 Scheduled";
      default:
        return "Unknown";
    }
  };

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Driver Dashboard</h1>
        <p style={{ color: "#666666", margin: "0" }}>Welcome back! Here's your daily overview</p>
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
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {stats.activeTrips}
          </p>
          <p style={{ color: "#666666", margin: "0.5rem 0 0 0", fontSize: "0.85rem" }}>trips today</p>
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
            TODAY'S EARNINGS
          </p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {stats.totalEarnings}
          </p>
          <p style={{ color: "#666666", margin: "0.5rem 0 0 0", fontSize: "0.85rem" }}>estimated</p>
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
            COMPLETED THIS MONTH
          </p>
          <p style={{ color: "#2196F3", fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {stats.completedTrips}
          </p>
          <p style={{ color: "#666666", margin: "0.5rem 0 0 0", fontSize: "0.85rem" }}>trips</p>
        </div>

        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(156, 39, 176, 0.1), rgba(156, 39, 176, 0.05))",
          }}
        >
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.85rem", fontWeight: "600" }}>
            YOUR RATING
          </p>
          <p style={{ color: "#9C27B0", fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {stats.rating} ⭐
          </p>
          <p style={{ color: "#666666", margin: "0.5rem 0 0 0", fontSize: "0.85rem" }}>out of 5.0</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Quick Actions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
          <Link
            href="/driver/active-trips"
            style={{
              padding: "1rem",
              background: "#FF9800",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            🚗 Active Trips
          </Link>
          <Link
            href="/driver/route-info"
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
            📍 Route Info
          </Link>
          <Link
            href="/driver/schedule"
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
            📅 Schedule
          </Link>
          <Link
            href="/driver/pay"
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
            💰 Total Pay
          </Link>
          <Link
            href="/driver/vehicle-status"
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
            🚙 Vehicle Status
          </Link>
          <Link
            href="/driver/accomplishment-report"
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
            📝 Report
          </Link>
        </div>
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "white" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Driver Sequence Flow</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
          {[
            { label: "Active Trips", href: "/driver/active-trips" },
            { label: "Route Info", href: "/driver/route-info" },
            { label: "Enter Start", href: "/driver/job-execution" },
            { label: "Enter End", href: "/driver/job-execution" },
            { label: "Submit Accomplishment", href: "/driver/accomplishment-report" },
            { label: "Activity & Ratings", href: "/driver/activity-ratings" },
            { label: "Designated Schedule", href: "/driver/schedule" },
            { label: "Total Pay", href: "/driver/pay" },
            { label: "Vehicle Status", href: "/driver/vehicle-status" },
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
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Today's Active Trips</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {activeTrips.map((trip) => (
            <div
              key={trip.id}
              style={{
                padding: "1rem",
                border: `2px solid ${getStatusColor(trip.status)}`,
                borderRadius: "6px",
                background: "#F9F9F9",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <div>
                  <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0" }}>{trip.id}</p>
                  <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                    Route: {trip.routeId}
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.5rem 1rem",
                    background: getStatusColor(trip.status) + "15",
                    color: getStatusColor(trip.status),
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                  }}
                >
                  {getStatusLabel(trip.status)}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
                <div>
                  <p style={{ color: "#999", fontSize: "0.8rem", margin: "0" }}>PICKUP</p>
                  <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {trip.pickupLocation}
                  </p>
                </div>
                <div>
                  <p style={{ color: "#999", fontSize: "0.8rem", margin: "0" }}>DROPOFF</p>
                  <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {trip.dropoffLocation}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <p style={{ color: "#999", fontSize: "0.8rem", margin: "0" }}>START</p>
                  <p style={{ color: "#1A1A1A", fontSize: "0.85rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {trip.startTime}
                  </p>
                </div>
                <div>
                  <p style={{ color: "#999", fontSize: "0.8rem", margin: "0" }}>ETA</p>
                  <p style={{ color: "#1A1A1A", fontSize: "0.85rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {trip.estimatedEndTime}
                  </p>
                </div>
                <div>
                  <p style={{ color: "#999", fontSize: "0.8rem", margin: "0" }}>DISTANCE</p>
                  <p style={{ color: "#1A1A1A", fontSize: "0.85rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {trip.distance}
                  </p>
                </div>
                <div>
                  <p style={{ color: "#999", fontSize: "0.8rem", margin: "0" }}>EARNING</p>
                  <p style={{ color: "#4CAF50", fontSize: "0.85rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
                    {trip.earnings}
                  </p>
                </div>
              </div>

              <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0 0 0.75rem 0" }}>
                📦 {trip.cargo}
              </p>

              {trip.status === "in_progress" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <Link
                    href={`/driver/active-trips/${trip.id}`}
                    style={{
                      padding: "0.75rem",
                      background: "#FF9800",
                      color: "white",
                      textAlign: "center",
                      borderRadius: "4px",
                      textDecoration: "none",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                    }}
                  >
                    Update Status
                  </Link>
                  <Link
                    href={`/driver/route-info/${trip.routeId}`}
                    style={{
                      padding: "0.75rem",
                      background: "#2196F3",
                      color: "white",
                      textAlign: "center",
                      borderRadius: "4px",
                      textDecoration: "none",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                    }}
                  >
                    View Route
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
