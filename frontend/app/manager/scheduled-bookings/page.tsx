"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";
import { formatPhp } from "@/lib/appLocale";

type Booking = {
  id: string;
  customer: string;
  pickupLocation: string;
  deliveryLocation: string;
  scheduledDate: string;
  status: "pending" | "confirmed" | "scheduled" | "in_transit" | "completed";
  totalValue: number;
  assignedDriver?: string;
};

export default function ScheduledBookingsPage() {
  useRoleGuard(["manager", "admin"]);

  const [bookings] = useState<Booking[]>([
    {
      id: "BK-2024-0001",
      customer: "ABC Retail Corp",
      pickupLocation: "Manila Warehouse",
      deliveryLocation: "Makati Branch",
      scheduledDate: "2024-05-10 09:00 AM",
      status: "scheduled",
      totalValue: 450,
      assignedDriver: "Carlos Rodriguez",
    },
    {
      id: "BK-2024-0002",
      customer: "DEF Logistics",
      pickupLocation: "Pasig Port",
      deliveryLocation: "Batangas Distribution",
      scheduledDate: "2024-05-10 10:30 AM",
      status: "confirmed",
      totalValue: 680,
      assignedDriver: "Maria Santos",
    },
    {
      id: "BK-2024-0003",
      customer: "GHI Trading",
      pickupLocation: "Quezon City Hub",
      deliveryLocation: "Cebu Warehouse",
      scheduledDate: "2024-05-10 08:00 AM",
      status: "in_transit",
      totalValue: 920,
      assignedDriver: "Juan Dela Cruz",
    },
    {
      id: "BK-2024-0004",
      customer: "JKL Manufacturing",
      pickupLocation: "Las Piñas Factory",
      deliveryLocation: "Cavite Distribution",
      scheduledDate: "2024-05-11 06:00 AM",
      status: "pending",
      totalValue: 550,
    },
    {
      id: "BK-2024-0005",
      customer: "MNO Suppliers",
      pickupLocation: "Makati Central",
      deliveryLocation: "Antipolo Depot",
      scheduledDate: "2024-05-11 02:00 PM",
      status: "pending",
      totalValue: 380,
    },
  ]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: "#FEF3C7", text: "#92400E" },
      confirmed: { bg: "#D1FAE5", text: "#065F46" },
      scheduled: { bg: "#D1E7F5", text: "#0C4A6E" },
      in_transit: { bg: "#FED7AA", text: "#92400E" },
      completed: { bg: "#D1FAE5", text: "#065F46" },
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
            Scheduled Bookings
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Manage and track all scheduled shipments</p>
        </div>

        {/* Bookings Table */}
        <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8", background: "#F9FAFB" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>ID</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Customer</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Route</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Scheduled</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Driver</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Value</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking, i) => {
                  const statusColor = getStatusColor(booking.status);
                  return (
                    <tr key={booking.id} style={{ borderBottom: i < bookings.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                      <td style={{ padding: "1rem", color: "#0EA5E9", fontWeight: 600 }}>
                        <Link href={`/manager/order-details?id=${booking.id}`} style={{ textDecoration: "none", color: "#0EA5E9" }}>
                          {booking.id}
                        </Link>
                      </td>
                      <td style={{ padding: "1rem", color: "#1A1A1A", fontWeight: 500 }}>{booking.customer}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>
                        {booking.pickupLocation} → {booking.deliveryLocation}
                      </td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{booking.scheduledDate}</td>
                      <td style={{ padding: "1rem", color: "#1A1A1A" }}>{booking.assignedDriver || "-"}</td>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#1A1A1A" }}>{formatPhp(booking.totalValue)}</td>
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
                          {booking.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
          <Link
            href="/manager/pending-bookings"
            style={{
              padding: "0.75rem 1.5rem",
              background: "#0EA5E9",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            View Pending
          </Link>
          <Link
            href="/manager/accomplished-bookings"
            style={{
              padding: "0.75rem 1.5rem",
              background: "#10B981",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            View Completed
          </Link>
        </div>
      </div>
    </main>
  );
}
