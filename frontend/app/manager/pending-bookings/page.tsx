"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type PendingBooking = {
  id: string;
  customer: string;
  route: string;
  scheduledDate: string;
  amount: string;
  priority: "low" | "medium" | "high";
  daysPending: number;
};

export default function PendingBookingsPage() {
  useRoleGuard(["manager", "admin"]);

  const [bookings] = useState<PendingBooking[]>([
    {
      id: "BK-2024-0004",
      customer: "JKL Manufacturing",
      route: "Las Piñas → Cavite",
      scheduledDate: "May 11, 2024 06:00 AM",
      amount: "$550.00",
      priority: "high",
      daysPending: 1,
    },
    {
      id: "BK-2024-0005",
      customer: "MNO Suppliers",
      route: "Makati → Antipolo",
      scheduledDate: "May 11, 2024 02:00 PM",
      amount: "$380.00",
      priority: "medium",
      daysPending: 1,
    },
    {
      id: "BK-2024-0006",
      customer: "PQR Trading",
      route: "Pasig → Manila",
      scheduledDate: "May 12, 2024 08:30 AM",
      amount: "$420.00",
      priority: "low",
      daysPending: 2,
    },
  ]);

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      high: { bg: "#FEE2E2", text: "#991B1B" },
      medium: { bg: "#FEF3C7", text: "#92400E" },
      low: { bg: "#D1FAE5", text: "#065F46" },
    };
    return colors[priority] || { bg: "#F3F4F6", text: "#374151" };
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
            Pending Bookings
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Bookings awaiting confirmation or assignment</p>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Pending</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>{bookings.length}</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Value</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#FF9800" }}>$1,350.00</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>High Priority</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#EF4444" }}>1</div>
          </div>
        </div>

        {/* Bookings List */}
        <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8", background: "#F9FAFB" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>ID</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Customer</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Route</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Scheduled</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Amount</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Priority</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Days Pending</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking, i) => {
                  const priorityColor = getPriorityColor(booking.priority);
                  return (
                    <tr key={booking.id} style={{ borderBottom: i < bookings.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#0EA5E9" }}>{booking.id}</td>
                      <td style={{ padding: "1rem", color: "#1A1A1A", fontWeight: 500 }}>{booking.customer}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{booking.route}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{booking.scheduledDate}</td>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#1A1A1A" }}>{booking.amount}</td>
                      <td style={{ padding: "1rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.4rem 0.75rem",
                            borderRadius: "6px",
                            background: priorityColor.bg,
                            color: priorityColor.text,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            textTransform: "capitalize",
                          }}
                        >
                          {booking.priority}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", fontWeight: 600, color: "#1A1A1A" }}>{booking.daysPending}</td>
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
