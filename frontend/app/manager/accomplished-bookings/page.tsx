"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type AccomplishedBooking = {
  id: string;
  customer: string;
  route: string;
  completedDate: string;
  amount: string;
  daysToComplete: number;
  status: string;
};

export default function AccomplishedBookingsPage() {
  useRoleGuard(["manager", "admin"]);

  const [bookings] = useState<AccomplishedBooking[]>([
    {
      id: "BK-2024-0001",
      customer: "ABC Retail Corp",
      route: "Manila → Makati",
      completedDate: "May 10, 2024 11:45 AM",
      amount: "$450.00",
      daysToComplete: 1,
      status: "Completed",
    },
    {
      id: "BK-2024-0002",
      customer: "DEF Logistics",
      route: "Pasig → Batangas",
      completedDate: "May 10, 2024 03:30 PM",
      amount: "$680.00",
      daysToComplete: 1,
      status: "Completed",
    },
    {
      id: "BK-2024-0003",
      customer: "GHI Trading",
      route: "Quezon City → Cebu",
      completedDate: "May 09, 2024 07:00 PM",
      amount: "$920.00",
      daysToComplete: 2,
      status: "Completed",
    },
    {
      id: "BK-2024-0100",
      customer: "XYZ Distribution",
      route: "Manila → Antipolo",
      completedDate: "May 08, 2024 04:15 PM",
      amount: "$380.00",
      daysToComplete: 1,
      status: "Completed",
    },
    {
      id: "BK-2024-0101",
      customer: "ABC Retail Corp",
      route: "Cavite → Manila",
      completedDate: "May 07, 2024 02:30 PM",
      amount: "$520.00",
      daysToComplete: 2,
      status: "Completed",
    },
  ]);

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
            Accomplished Bookings
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Successfully completed deliveries</p>
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
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Completed</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#10B981" }}>1089</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>This Month</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#10B981" }}>{bookings.length}</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Revenue</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#FF9800" }}>$2,950.00</div>
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
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Completed Date</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Amount</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Days to Complete</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking, i) => (
                  <tr key={booking.id} style={{ borderBottom: i < bookings.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                    <td style={{ padding: "1rem", fontWeight: 700, color: "#0EA5E9" }}>{booking.id}</td>
                    <td style={{ padding: "1rem", color: "#1A1A1A", fontWeight: 500 }}>{booking.customer}</td>
                    <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{booking.route}</td>
                    <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{booking.completedDate}</td>
                    <td style={{ padding: "1rem", fontWeight: 700, color: "#FF9800" }}>{booking.amount}</td>
                    <td style={{ padding: "1rem", fontWeight: 600, color: "#1A1A1A" }}>{booking.daysToComplete}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
