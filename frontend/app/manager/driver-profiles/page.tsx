"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type Driver = {
  id: string;
  name: string;
  licenseNumber: string;
  email: string;
  phone: string;
  tripsCompleted: number;
  rating: number;
  status: "active" | "inactive" | "on_leave";
  joinDate: string;
  totalEarnings: string;
};

export default function DriverProfilesPage() {
  useRoleGuard(["manager", "admin"]);

  const [drivers] = useState<Driver[]>([
    {
      id: "DRIVER-001",
      name: "Carlos Rodriguez",
      licenseNumber: "DL-2024-001",
      email: "carlos.rodriguez@fleetopt.com",
      phone: "+63 912 345 6789",
      tripsCompleted: 156,
      rating: 4.8,
      status: "active",
      joinDate: "January 15, 2023",
      totalEarnings: "$18,450.50",
    },
    {
      id: "DRIVER-002",
      name: "Maria Santos",
      licenseNumber: "DL-2024-002",
      email: "maria.santos@fleetopt.com",
      phone: "+63 912 345 6790",
      tripsCompleted: 142,
      rating: 4.7,
      status: "active",
      joinDate: "February 20, 2023",
      totalEarnings: "$16,820.25",
    },
    {
      id: "DRIVER-003",
      name: "Juan Dela Cruz",
      licenseNumber: "DL-2024-003",
      email: "juan.delacruz@fleetopt.com",
      phone: "+63 912 345 6791",
      tripsCompleted: 128,
      rating: 4.6,
      status: "active",
      joinDate: "March 10, 2023",
      totalEarnings: "$15,240.75",
    },
    {
      id: "DRIVER-004",
      name: "Ana Garcia",
      licenseNumber: "DL-2024-004",
      email: "ana.garcia@fleetopt.com",
      phone: "+63 912 345 6792",
      tripsCompleted: 98,
      rating: 4.5,
      status: "on_leave",
      joinDate: "April 05, 2023",
      totalEarnings: "$11,560.00",
    },
    {
      id: "DRIVER-005",
      name: "Pedro Reyes",
      licenseNumber: "DL-2024-005",
      email: "pedro.reyes@fleetopt.com",
      phone: "+63 912 345 6793",
      tripsCompleted: 165,
      rating: 4.9,
      status: "active",
      joinDate: "May 12, 2023",
      totalEarnings: "$19,680.50",
    },
  ]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      active: { bg: "#D1FAE5", text: "#065F46" },
      inactive: { bg: "#F3F4F6", text: "#4B5563" },
      on_leave: { bg: "#FED7AA", text: "#92400E" },
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
            Driver Profiles
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Manage and monitor driver information</p>
        </div>

        {/* Driver Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Drivers</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>45</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Active</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#10B981" }}>42</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>On Leave</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#F59E0B" }}>2</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Avg Rating</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#8B5CF6" }}>★ 4.7</div>
          </div>
        </div>

        {/* Drivers List */}
        <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8", background: "#F9FAFB" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Name</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>License</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Contact</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Trips</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Rating</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Earnings</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, i) => {
                  const statusColor = getStatusColor(driver.status);
                  return (
                    <tr key={driver.id} style={{ borderBottom: i < drivers.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                      <td style={{ padding: "1rem", fontWeight: 600, color: "#1A1A1A" }}>{driver.name}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{driver.licenseNumber}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{driver.phone}</td>
                      <td style={{ padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>{driver.tripsCompleted}</td>
                      <td style={{ padding: "1rem", fontWeight: 600 }}>★ {driver.rating}</td>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#10B981" }}>{driver.totalEarnings}</td>
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
                          {driver.status.replace("_", " ")}
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
