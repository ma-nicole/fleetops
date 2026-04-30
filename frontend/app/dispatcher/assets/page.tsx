"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type Driver = {
  id: string;
  name: string;
  license: string;
  status: "available" | "on_trip" | "on_break" | "off_duty";
  assignedVehicle: string;
  phone: string;
  rating: number;
  trips: number;
};

type Vehicle = {
  id: string;
  plate: string;
  type: string;
  status: "available" | "in_use" | "maintenance" | "inspection";
  driver?: string;
  fuelLevel: number;
  mileage: number;
};

export default function AssetsPage() {
  useRoleGuard(["dispatcher"]);

  const [activeTab, setActiveTab] = useState<"drivers" | "vehicles">("drivers");

  const [drivers] = useState<Driver[]>([
    {
      id: "DRV-001",
      name: "Carlos Rodriguez",
      license: "DL-2024-1001",
      status: "on_trip",
      assignedVehicle: "AUV-2024-1440",
      phone: "+63-917-123-4567",
      rating: 4.8,
      trips: 47,
    },
    {
      id: "DRV-002",
      name: "Maria Santos",
      license: "DL-2024-1002",
      status: "on_trip",
      assignedVehicle: "AUV-2024-1441",
      phone: "+63-917-234-5678",
      rating: 4.6,
      trips: 35,
    },
    {
      id: "DRV-003",
      name: "Juan Dela Cruz",
      license: "DL-2024-1003",
      status: "available",
      assignedVehicle: "AUV-2024-1442",
      phone: "+63-917-345-6789",
      rating: 4.7,
      trips: 52,
    },
    {
      id: "DRV-004",
      name: "Rita Gonzales",
      license: "DL-2024-1004",
      status: "on_break",
      assignedVehicle: "AUV-2024-1443",
      phone: "+63-917-456-7890",
      rating: 4.5,
      trips: 28,
    },
    {
      id: "DRV-005",
      name: "Miguel Reyes",
      license: "DL-2024-1005",
      status: "available",
      assignedVehicle: "AUV-2024-1444",
      phone: "+63-917-567-8901",
      rating: 4.9,
      trips: 61,
    },
  ]);

  const [vehicles] = useState<Vehicle[]>([
    {
      id: "VEH-001",
      plate: "AUV-2024-1440",
      type: "Hino 500 Truck",
      status: "in_use",
      driver: "Carlos Rodriguez",
      fuelLevel: 75,
      mileage: 158400,
    },
    {
      id: "VEH-002",
      plate: "AUV-2024-1441",
      type: "Hino 300 Truck",
      status: "in_use",
      driver: "Maria Santos",
      fuelLevel: 60,
      mileage: 142200,
    },
    {
      id: "VEH-003",
      plate: "AUV-2024-1442",
      type: "Hino 500 Truck",
      status: "available",
      fuelLevel: 85,
      mileage: 165800,
    },
    {
      id: "VEH-004",
      plate: "AUV-2024-1443",
      type: "Hino 300 Truck",
      status: "maintenance",
      fuelLevel: 0,
      mileage: 156300,
    },
    {
      id: "VEH-005",
      plate: "AUV-2024-1444",
      type: "Hino 500 Truck",
      status: "available",
      driver: "Miguel Reyes",
      fuelLevel: 70,
      mileage: 172100,
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
      case "off_duty":
        return "#999";
      case "in_use":
        return "#FF6B6B";
      case "maintenance":
        return "#F44336";
      case "inspection":
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
      case "off_duty":
        return "⛔ Off Duty";
      case "in_use":
        return "🚚 In Use";
      case "maintenance":
        return "🔧 Maintenance";
      case "inspection":
        return "🔍 Inspection";
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
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Assets Management</h1>
        <p style={{ color: "#666666", margin: "0" }}>Manage drivers and vehicles</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #E8E8E8" }}>
        <button
          onClick={() => setActiveTab("drivers")}
          style={{
            padding: "0.75rem 1.5rem",
            background: activeTab === "drivers" ? "#FF9800" : "transparent",
            color: activeTab === "drivers" ? "white" : "#1A1A1A",
            border: "none",
            cursor: "pointer",
            fontWeight: "600",
            borderRadius: "6px 6px 0 0",
          }}
        >
          👥 Drivers ({drivers.length})
        </button>
        <button
          onClick={() => setActiveTab("vehicles")}
          style={{
            padding: "0.75rem 1.5rem",
            background: activeTab === "vehicles" ? "#FF9800" : "transparent",
            color: activeTab === "vehicles" ? "white" : "#1A1A1A",
            border: "none",
            cursor: "pointer",
            fontWeight: "600",
            borderRadius: "6px 6px 0 0",
          }}
        >
          🚗 Vehicles ({vehicles.length})
        </button>
      </div>

      {/* Drivers List */}
      {activeTab === "drivers" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          {drivers.map((driver) => (
            <div
              key={driver.id}
              style={{
                padding: "1.5rem",
                border: `2px solid ${getStatusColor(driver.status)}`,
                borderRadius: "8px",
                background: "#F9F9F9",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto",
                gap: "1.5rem",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0" }}>{driver.name}</h3>
                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  {driver.id} • {driver.license}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ASSIGNED VEHICLE</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {driver.assignedVehicle}
                </p>
                <p style={{ color: "#2196F3", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  📱 {driver.phone}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PERFORMANCE</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  ⭐ {driver.rating} • {driver.trips} trips
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column", alignItems: "flex-end" }}>
                <span
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: getStatusColor(driver.status) + "20",
                    color: getStatusColor(driver.status),
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getStatusLabel(driver.status)}
                </span>
                <button
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                  }}
                  onClick={() => alert("Assign trip to " + driver.name)}
                >
                  Assign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vehicles List */}
      {activeTab === "vehicles" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              style={{
                padding: "1.5rem",
                border: `2px solid ${getStatusColor(vehicle.status)}`,
                borderRadius: "8px",
                background: "#F9F9F9",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr auto",
                  gap: "1.5rem",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <h3 style={{ color: "#1A1A1A", margin: "0" }}>{vehicle.plate}</h3>
                  <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                    {vehicle.type}
                  </p>
                </div>

                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DRIVER</p>
                  <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {vehicle.driver || "Not assigned"}
                  </p>
                </div>

                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>FUEL & MILEAGE</p>
                  <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                    {vehicle.fuelLevel}% Fuel • {vehicle.mileage} km
                  </p>
                </div>

                <span
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: getStatusColor(vehicle.status) + "20",
                    color: getStatusColor(vehicle.status),
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getStatusLabel(vehicle.status)}
                </span>
              </div>

              {/* Fuel Level Bar */}
              <div
                style={{
                  height: "6px",
                  background: "#E8E8E8",
                  borderRadius: "3px",
                  overflow: "hidden",
                  marginBottom: "0.75rem",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: vehicle.fuelLevel > 30 ? "#4CAF50" : "#F44336",
                    width: vehicle.fuelLevel + "%",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                  }}
                  onClick={() => alert("View details for " + vehicle.plate)}
                >
                  View Details
                </button>
                {vehicle.status === "maintenance" && (
                  <button
                    style={{
                      padding: "0.4rem 0.75rem",
                      background: "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => alert("Marking as available...")}
                  >
                    Mark Available
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
