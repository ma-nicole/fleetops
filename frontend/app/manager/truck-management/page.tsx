"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type Truck = {
  id: string;
  plateNumber: string;
  model: string;
  status: "active" | "maintenance" | "inactive";
  driver?: string;
  mileage: string;
  lastService: string;
  nextService: string;
  fuelLevel: number;
};

export default function TruckManagementPage() {
  useRoleGuard(["manager", "admin"]);

  const [trucks] = useState<Truck[]>([
    {
      id: "TR-001",
      plateNumber: "AUV-2024-1447",
      model: "Hino 500 - 6 Wheels",
      status: "active",
      driver: "Carlos Rodriguez",
      mileage: "158,420 km",
      lastService: "April 15, 2024",
      nextService: "May 15, 2024",
      fuelLevel: 85,
    },
    {
      id: "TR-002",
      plateNumber: "AUV-2024-1448",
      model: "Isuzu Giga - 10 Wheels",
      status: "active",
      driver: "Maria Santos",
      mileage: "145,600 km",
      lastService: "April 10, 2024",
      nextService: "May 10, 2024",
      fuelLevel: 60,
    },
    {
      id: "TR-003",
      plateNumber: "AUV-2024-1449",
      model: "Fuso Fighter - 4 Wheels",
      status: "maintenance",
      driver: undefined,
      mileage: "205,300 km",
      lastService: "March 20, 2024",
      nextService: "May 20, 2024",
      fuelLevel: 20,
    },
    {
      id: "TR-004",
      plateNumber: "AUV-2024-1450",
      model: "Hino 500 - 6 Wheels",
      status: "active",
      driver: "Juan Dela Cruz",
      mileage: "178,950 km",
      lastService: "April 12, 2024",
      nextService: "May 12, 2024",
      fuelLevel: 75,
    },
    {
      id: "TR-005",
      plateNumber: "AUV-2024-1451",
      model: "Isuzu Giga - 10 Wheels",
      status: "inactive",
      driver: undefined,
      mileage: "320,100 km",
      lastService: "January 15, 2024",
      nextService: "July 15, 2024",
      fuelLevel: 0,
    },
  ]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      active: { bg: "#D1FAE5", text: "#065F46" },
      maintenance: { bg: "#FEF3C7", text: "#92400E" },
      inactive: { bg: "#F3F4F6", text: "#4B5563" },
    };
    return colors[status] || { bg: "#F3F4F6", text: "#374151" };
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <Link href="/manager/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
              ← Dashboard
            </Link>
          </div>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>
            Truck Management
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Monitor fleet health and maintenance schedules</p>
        </div>

        {/* Fleet Overview */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Trucks</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>52</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Active</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#10B981" }}>46</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Maintenance</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#F59E0B" }}>4</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Idle</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#6B7280" }}>2</div>
          </div>
        </div>

        {/* Trucks List */}
        <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8", background: "#F9FAFB" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Plate Number</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Model</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Driver</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Mileage</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Fuel Level</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Next Service</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {trucks.map((truck, i) => {
                  const statusColor = getStatusColor(truck.status);
                  return (
                    <tr key={truck.id} style={{ borderBottom: i < trucks.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#0EA5E9" }}>{truck.plateNumber}</td>
                      <td style={{ padding: "1rem", color: "#1A1A1A" }}>{truck.model}</td>
                      <td style={{ padding: "1rem", color: "#666" }}>{truck.driver || "-"}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{truck.mileage}</td>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{ width: "80px", height: "8px", background: "#E8E8E8", borderRadius: "4px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${truck.fuelLevel}%`,
                                background: truck.fuelLevel > 50 ? "#10B981" : truck.fuelLevel > 20 ? "#F59E0B" : "#EF4444",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{truck.fuelLevel}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{truck.nextService}</td>
                      <td style={{ padding: "1rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.4rem 0.75rem",
                            borderRadius: "6px",
                            background: statusColor.bg,
                            color: statusColor.text,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            textTransform: "capitalize",
                          }}
                        >
                          {truck.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
