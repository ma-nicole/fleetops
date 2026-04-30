"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type OngoingOperation = {
  tripId: string;
  driverId: string;
  driverName: string;
  vehiclePlate: string;
  status: "pending" | "started" | "in_transit" | "arrived" | "loading" | "unloading";
  currentLocation: string;
  pickupAddress: string;
  deliveryAddress: string;
  startTime: string;
  estimatedCompletion: string;
  progress: number;
};

export default function OngoingOperationsPage() {
  useRoleGuard(["dispatcher"]);

  const [operations] = useState<OngoingOperation[]>([
    {
      tripId: "TRIP-001",
      driverId: "DRV-001",
      driverName: "Carlos Rodriguez",
      vehiclePlate: "AUV-2024-1440",
      status: "in_transit",
      currentLocation: "EDSA, Makati",
      pickupAddress: "Manila Warehouse",
      deliveryAddress: "Makati Branch",
      startTime: "09:30 AM",
      estimatedCompletion: "11:45 AM",
      progress: 65,
    },
    {
      tripId: "TRIP-002",
      driverId: "DRV-002",
      driverName: "Maria Santos",
      vehiclePlate: "AUV-2024-1441",
      status: "loading",
      currentLocation: "Quezon City Depot",
      pickupAddress: "Quezon City Depot",
      deliveryAddress: "Pasig Market",
      startTime: "10:00 AM",
      estimatedCompletion: "01:00 PM",
      progress: 25,
    },
    {
      tripId: "TRIP-003",
      driverId: "DRV-003",
      driverName: "Juan Dela Cruz",
      vehiclePlate: "AUV-2024-1442",
      status: "started",
      currentLocation: "Caloocan Pickup Point",
      pickupAddress: "Caloocan Warehouse",
      deliveryAddress: "San Juan Delivery",
      startTime: "08:45 AM",
      estimatedCompletion: "10:30 AM",
      progress: 35,
    },
    {
      tripId: "TRIP-004",
      driverId: "DRV-005",
      driverName: "Miguel Reyes",
      vehiclePlate: "AUV-2024-1444",
      status: "arrived",
      currentLocation: "Santa Rosa Destination",
      pickupAddress: "Las Piñas Warehouse",
      deliveryAddress: "Santa Rosa Distribution",
      startTime: "06:00 AM",
      estimatedCompletion: "08:30 AM",
      progress: 90,
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#2196F3";
      case "started":
        return "#9C27B0";
      case "in_transit":
        return "#FF6B6B";
      case "arrived":
        return "#FF9800";
      case "loading":
        return "#FFC107";
      case "unloading":
        return "#FF9800";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳ Pending";
      case "started":
        return "▶️ Started";
      case "in_transit":
        return "🚚 In Transit";
      case "arrived":
        return "📍 Arrived";
      case "loading":
        return "📦 Loading";
      case "unloading":
        return "📦 Unloading";
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
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Ongoing Operations</h1>
        <p style={{ color: "#666666", margin: "0" }}>Real-time monitoring of all active trips</p>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "#F9F9F9",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ACTIVE</p>
          <p style={{ color: "#FF6B6B", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {operations.length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "#F9F9F9",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>IN TRANSIT</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {operations.filter((op) => op.status === "in_transit").length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "#F9F9F9",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LOADING/UNLOADING</p>
          <p style={{ color: "#FFC107", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {operations.filter((op) => op.status === "loading" || op.status === "unloading").length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "#F9F9F9",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>COMPLETED</p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            0
          </p>
        </div>
      </div>

      {/* Operations List */}
      <div style={{ display: "grid", gap: "1.5rem" }}>
        {operations.map((op) => (
          <div
            key={op.tripId}
            style={{
              padding: "1.5rem",
              border: `2px solid ${getStatusColor(op.status)}`,
              borderRadius: "8px",
              background: "#F9F9F9",
            }}
          >
            {/* Header Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1.5rem", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0" }}>{op.tripId}</h3>
                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  {op.driverName} • {op.vehiclePlate}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>CURRENT LOCATION</p>
                <p style={{ color: "#2196F3", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  📍 {op.currentLocation}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TIMELINE</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {op.startTime} → {op.estimatedCompletion}
                </p>
              </div>

              <span
                style={{
                  padding: "0.5rem 0.75rem",
                  background: getStatusColor(op.status) + "20",
                  color: getStatusColor(op.status),
                  borderRadius: "4px",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  height: "fit-content",
                  whiteSpace: "nowrap",
                }}
              >
                {getStatusLabel(op.status)}
              </span>
            </div>

            {/* Route Info */}
            <div
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #E8E8E8",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "center" }}>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PICKUP</p>
                  <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {op.pickupAddress}
                  </p>
                </div>
                <p style={{ color: "#999", margin: "0" }}>→</p>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DELIVERY</p>
                  <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {op.deliveryAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>COMPLETION</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>
                  {op.progress}%
                </p>
              </div>
              <div
                style={{
                  height: "8px",
                  background: "#E8E8E8",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: getStatusColor(op.status),
                    width: op.progress + "%",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
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
                onClick={() => alert("Viewing route for " + op.tripId)}
              >
                View Route
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
                onClick={() => alert("Contacting driver " + op.driverName)}
              >
                Contact Driver
              </button>
              {op.status === "arrived" && (
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
                  onClick={() => alert("Confirming delivery for " + op.tripId)}
                >
                  Confirm Delivery
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
