"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type Report = {
  id: string;
  tripId: string;
  driver: string;
  date: string;
  route: string;
  status: string;
  startMileage: string;
  endMileage: string;
  totalDistance: string;
  totalEarnings: string;
};

export default function AccomplishmentReportPage() {
  useRoleGuard(["manager", "admin"]);

  const [reports] = useState<Report[]>([
    {
      id: "RPT-2024-001",
      tripId: "TR-2024-156",
      driver: "Carlos Rodriguez",
      date: "May 10, 2024",
      route: "Makati → Quezon City",
      status: "Completed",
      startMileage: "158,420 km",
      endMileage: "158,448 km",
      totalDistance: "28 km",
      totalEarnings: "$245.00",
    },
    {
      id: "RPT-2024-002",
      tripId: "TR-2024-157",
      driver: "Maria Santos",
      date: "May 10, 2024",
      route: "Pasig → Makati",
      status: "Completed",
      startMileage: "145,600 km",
      endMileage: "145,618 km",
      totalDistance: "18 km",
      totalEarnings: "$175.50",
    },
    {
      id: "RPT-2024-003",
      tripId: "TR-2024-158",
      driver: "Juan Dela Cruz",
      date: "May 10, 2024",
      route: "Quezon City → Cavite",
      status: "Submitted",
      startMileage: "178,950 km",
      endMileage: "179,032 km",
      totalDistance: "82 km",
      totalEarnings: "$420.00",
    },
  ]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      Completed: { bg: "#D1FAE5", text: "#065F46" },
      Submitted: { bg: "#D1E7F5", text: "#0C4A6E" },
      Pending: { bg: "#FEF3C7", text: "#92400E" },
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
            Accomplishment Reports
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Track all completed trips and driver accomplishments</p>
        </div>

        {/* Reports Table */}
        <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8", background: "#F9FAFB" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Report ID</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Trip ID</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Driver</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Route</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Distance</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Earnings</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report, i) => {
                  const statusColor = getStatusColor(report.status);
                  return (
                    <tr key={report.id} style={{ borderBottom: i < reports.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#0EA5E9" }}>{report.id}</td>
                      <td style={{ padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>{report.tripId}</td>
                      <td style={{ padding: "1rem", color: "#1A1A1A" }}>{report.driver}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{report.route}</td>
                      <td style={{ padding: "1rem", fontWeight: 600, color: "#1A1A1A" }}>{report.totalDistance}</td>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#FF9800" }}>{report.totalEarnings}</td>
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
                          }}
                        >
                          {report.status}
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
