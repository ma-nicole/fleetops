"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type HistoryRecord = {
  id: string;
  date: string;
  type: string;
  description: string;
  amount?: string;
  status: string;
};

export default function HistoryPage() {
  useRoleGuard(["manager", "admin"]);

  const [history] = useState<HistoryRecord[]>([
    {
      id: "HIST-001",
      date: "May 10, 2024 02:30 PM",
      type: "Booking Completed",
      description: "BK-2024-0001 from ABC Retail Corp completed successfully",
      amount: "$450.00",
      status: "completed",
    },
    {
      id: "HIST-002",
      date: "May 10, 2024 01:15 PM",
      type: "Trip Completed",
      description: "TR-2024-156 completed by Carlos Rodriguez",
      amount: "$245.00",
      status: "completed",
    },
    {
      id: "HIST-003",
      date: "May 10, 2024 12:00 PM",
      type: "Driver Registered",
      description: "New driver added: Maria Santos",
      status: "completed",
    },
    {
      id: "HIST-004",
      date: "May 09, 2024 10:45 AM",
      type: "Payment Received",
      description: "Payment from GHI Trading Co",
      amount: "$920.00",
      status: "completed",
    },
    {
      id: "HIST-005",
      date: "May 08, 2024 03:20 PM",
      type: "Maintenance Scheduled",
      description: "Truck AUV-2024-1449 scheduled for maintenance",
      status: "completed",
    },
  ]);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <Link href="/manager/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
              ← Dashboard
            </Link>
          </div>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>
            Activity History
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Complete record of all fleet operations</p>
        </div>

        {/* History Timeline */}
        <div style={{ display: "grid", gap: "1rem" }}>
          {history.map((record, i) => (
            <div key={record.id} style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderLeft: "4px solid #FF9800" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1A1A1A", marginBottom: "0.25rem" }}>{record.type}</div>
                  <div style={{ color: "#666", fontSize: "0.9rem" }}>{record.date}</div>
                </div>
                {record.amount && <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FF9800" }}>{record.amount}</div>}
              </div>
              <p style={{ margin: "0.75rem 0 0", color: "#666", fontSize: "0.95rem" }}>{record.description}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
