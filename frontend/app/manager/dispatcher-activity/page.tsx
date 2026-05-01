"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type DispatcherActivity = {
  id: string;
  dispatcherName: string;
  tripsAssigned: number;
  tripsCompleted: number;
  activeTrips: number;
  rating: number;
  status: "online" | "offline" | "busy";
  lastActive: string;
};

export default function DispatcherActivityPage() {
  useRoleGuard(["manager", "admin"]);

  const [dispatchers] = useState<DispatcherActivity[]>([
    {
      id: "DISP-001",
      dispatcherName: "John Smith",
      tripsAssigned: 145,
      tripsCompleted: 142,
      activeTrips: 8,
      rating: 4.8,
      status: "online",
      lastActive: "Now",
    },
    {
      id: "DISP-002",
      dispatcherName: "Sarah Johnson",
      tripsAssigned: 168,
      tripsCompleted: 165,
      activeTrips: 5,
      rating: 4.7,
      status: "online",
      lastActive: "Now",
    },
    {
      id: "DISP-003",
      dispatcherName: "Michael Brown",
      tripsAssigned: 132,
      tripsCompleted: 128,
      activeTrips: 6,
      rating: 4.6,
      status: "busy",
      lastActive: "2 mins ago",
    },
    {
      id: "DISP-004",
      dispatcherName: "Emily Davis",
      tripsAssigned: 89,
      tripsCompleted: 87,
      activeTrips: 2,
      rating: 4.5,
      status: "offline",
      lastActive: "30 mins ago",
    },
    {
      id: "DISP-005",
      dispatcherName: "Robert Wilson",
      tripsAssigned: 156,
      tripsCompleted: 154,
      activeTrips: 7,
      rating: 4.9,
      status: "online",
      lastActive: "Now",
    },
  ]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; dot: string }> = {
      online: { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
      busy: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
      offline: { bg: "#F3F4F6", text: "#4B5563", dot: "#9CA3AF" },
    };
    return colors[status] || { bg: "#F3F4F6", text: "#374151", dot: "#9CA3AF" };
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
            Dispatcher Activity
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Monitor dispatcher performance and workload</p>
        </div>

        {/* Dispatcher Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Dispatchers</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>8</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Online Now</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#10B981" }}>5</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Active Trips</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#F59E0B" }}>28</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Avg Rating</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#8B5CF6" }}>★ 4.7</div>
          </div>
        </div>

        {/* Dispatchers List */}
        <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8", background: "#F9FAFB" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Name</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Trips Assigned</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Completed</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Active</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Rating</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Status</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {dispatchers.map((dispatcher, i) => {
                  const statusColor = getStatusColor(dispatcher.status);
                  return (
                    <tr key={dispatcher.id} style={{ borderBottom: i < dispatchers.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                      <td style={{ padding: "1rem", fontWeight: 600, color: "#1A1A1A" }}>{dispatcher.dispatcherName}</td>
                      <td style={{ padding: "1rem", color: "#666" }}>{dispatcher.tripsAssigned}</td>
                      <td style={{ padding: "1rem", color: "#10B981", fontWeight: 600 }}>{dispatcher.tripsCompleted}</td>
                      <td style={{ padding: "1rem", color: "#F59E0B", fontWeight: 600 }}>{dispatcher.activeTrips}</td>
                      <td style={{ padding: "1rem", fontWeight: 600 }}>★ {dispatcher.rating}</td>
                      <td style={{ padding: "1rem" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.4rem 0.75rem",
                            borderRadius: "6px",
                            background: statusColor.bg,
                            color: statusColor.text,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            textTransform: "capitalize",
                          }}
                        >
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: statusColor.dot,
                            }}
                          />
                          {dispatcher.status}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{dispatcher.lastActive}</td>
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
