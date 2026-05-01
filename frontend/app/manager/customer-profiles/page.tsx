"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";
import { formatPhp, formatPhpWhole } from "@/lib/appLocale";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  totalBookings: number;
  totalSpent: number;
  status: "active" | "inactive";
  joinDate: string;
  lastBooking: string;
};

export default function CustomerProfilesPage() {
  useRoleGuard(["manager", "admin"]);

  const [customers] = useState<Customer[]>([
    {
      id: "CUST-001",
      name: "ABC Retail Corporation",
      email: "contact@abcretail.com",
      phone: "+63 2 8123 4567",
      company: "ABC Retail Corp",
      totalBookings: 24,
      totalSpent: 12450,
      status: "active",
      joinDate: "January 10, 2023",
      lastBooking: "Today",
    },
    {
      id: "CUST-002",
      name: "DEF Logistics Inc",
      email: "operations@deflogistics.com",
      phone: "+63 2 8234 5678",
      company: "DEF Logistics",
      totalBookings: 18,
      totalSpent: 9820.5,
      status: "active",
      joinDate: "February 15, 2023",
      lastBooking: "Yesterday",
    },
    {
      id: "CUST-003",
      name: "GHI Trading Co",
      email: "sales@ghitrading.com",
      phone: "+63 2 8345 6789",
      company: "GHI Trading",
      totalBookings: 31,
      totalSpent: 15680.75,
      status: "active",
      joinDate: "March 05, 2023",
      lastBooking: "3 days ago",
    },
    {
      id: "CUST-004",
      name: "JKL Manufacturing",
      email: "logistics@jklmfg.com",
      phone: "+63 2 8456 7890",
      company: "JKL Manufacturing",
      totalBookings: 12,
      totalSpent: 6240,
      status: "inactive",
      joinDate: "April 20, 2023",
      lastBooking: "2 months ago",
    },
    {
      id: "CUST-005",
      name: "MNO Suppliers Ltd",
      email: "procurement@mnosuppliers.com",
      phone: "+63 2 8567 8901",
      company: "MNO Suppliers",
      totalBookings: 27,
      totalSpent: 14320.25,
      status: "active",
      joinDate: "May 12, 2023",
      lastBooking: "Today",
    },
  ]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      active: { bg: "#D1FAE5", text: "#065F46" },
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
            Customer Profiles
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Manage and monitor customer accounts</p>
        </div>

        {/* Customer Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Customers</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>287</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Active</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#10B981" }}>265</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Revenue</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#FF9800" }}>{formatPhpWhole(245600)}</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Avg Spend</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#0EA5E9" }}>{formatPhpWhole(854)}</div>
          </div>
        </div>

        {/* Customers List */}
        <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8", background: "#F9FAFB" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Company</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Contact</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Phone</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Bookings</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Total Spent</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Last Booking</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, i) => {
                  const statusColor = getStatusColor(customer.status);
                  return (
                    <tr key={customer.id} style={{ borderBottom: i < customers.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                      <td style={{ padding: "1rem", fontWeight: 600, color: "#1A1A1A" }}>{customer.company}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{customer.email}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{customer.phone}</td>
                      <td style={{ padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>{customer.totalBookings}</td>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#FF9800" }}>{formatPhp(customer.totalSpent)}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{customer.lastBooking}</td>
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
                          {customer.status}
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
