"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type Payment = {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: "completed" | "pending" | "failed";
  paymentMethod: string;
  relatedBooking: string;
};

export default function PaymentsPage() {
  useRoleGuard(["manager", "admin"]);

  const [payments] = useState<Payment[]>([
    {
      id: "PAY-2024-001",
      date: "May 10, 2024",
      description: "Payment from ABC Retail Corp",
      amount: "$450.00",
      status: "completed",
      paymentMethod: "Bank Transfer",
      relatedBooking: "BK-2024-0001",
    },
    {
      id: "PAY-2024-002",
      date: "May 10, 2024",
      description: "Payment from DEF Logistics",
      amount: "$680.00",
      status: "completed",
      paymentMethod: "Credit Card",
      relatedBooking: "BK-2024-0002",
    },
    {
      id: "PAY-2024-003",
      date: "May 09, 2024",
      description: "Driver Earnings - Carlos Rodriguez",
      amount: "$245.50",
      status: "completed",
      paymentMethod: "Internal Transfer",
      relatedBooking: "TR-2024-0156",
    },
    {
      id: "PAY-2024-004",
      date: "May 09, 2024",
      description: "Payment from GHI Trading",
      amount: "$920.00",
      status: "pending",
      paymentMethod: "Bank Transfer",
      relatedBooking: "BK-2024-0003",
    },
    {
      id: "PAY-2024-005",
      date: "May 08, 2024",
      description: "Payment from JKL Manufacturing",
      amount: "$550.00",
      status: "failed",
      paymentMethod: "Credit Card",
      relatedBooking: "BK-2024-0004",
    },
  ]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      completed: { bg: "#D1FAE5", text: "#065F46" },
      pending: { bg: "#FEF3C7", text: "#92400E" },
      failed: { bg: "#FEE2E2", text: "#991B1B" },
    };
    return colors[status] || { bg: "#F3F4F6", text: "#374151" };
  };

  const totalRevenue = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.amount.replace(/[$,]/g, "")), 0);

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
            Payments & Transactions
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Track all financial transactions</p>
        </div>

        {/* Payment Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Received</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#10B981" }}>${totalRevenue.toFixed(2)}</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Pending</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#F59E0B" }}>$920.00</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Failed</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#EF4444" }}>$550.00</div>
          </div>
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Transactions</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>{payments.length}</div>
          </div>
        </div>

        {/* Payments Table */}
        <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8", background: "#F9FAFB" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>ID</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Date</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Description</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Amount</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Method</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, i) => {
                  const statusColor = getStatusColor(payment.status);
                  return (
                    <tr key={payment.id} style={{ borderBottom: i < payments.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#0EA5E9" }}>{payment.id}</td>
                      <td style={{ padding: "1rem", color: "#666" }}>{payment.date}</td>
                      <td style={{ padding: "1rem", color: "#1A1A1A", fontWeight: 500 }}>{payment.description}</td>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#1A1A1A" }}>{payment.amount}</td>
                      <td style={{ padding: "1rem", color: "#666", fontSize: "0.9rem" }}>{payment.paymentMethod}</td>
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
                          {payment.status}
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
