"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type PayBreakdown = {
  period: string;
  baseSalary: string;
  bonuses: string;
  deductions: string;
  total: string;
  status: string;
};

export default function PayPage() {
  useRoleGuard(["driver"]);

  const [payHistory] = useState<PayBreakdown[]>([
    {
      period: "April 1-15, 2024",
      baseSalary: "$1,200.00",
      bonuses: "$150.00",
      deductions: "$80.00",
      total: "$1,270.00",
      status: "paid",
    },
    {
      period: "April 16-30, 2024",
      baseSalary: "$1,250.00",
      bonuses: "$200.00",
      deductions: "$100.00",
      total: "$1,350.00",
      status: "pending",
    },
    {
      period: "March 16-31, 2024",
      baseSalary: "$1,180.00",
      bonuses: "$100.00",
      deductions: "$75.00",
      total: "$1,205.00",
      status: "paid",
    },
  ]);

  const [currentPeriod] = useState({
    tripsCompleted: 24,
    totalDistance: "402 km",
    baseRate: "$50/trip",
    distanceRate: "$2/km",
    currentEarnings: "$2,450.50",
    bonusEarned: "$150.00",
    safetyBonus: "0%",
  });

  const getStatusBadge = (status: string) => {
    return status === "paid"
      ? { color: "#4CAF50", label: " Paid" }
      : { color: "#FF9800", label: "⏳ Pending" };
  };

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Total Pay</h1>
        <p style={{ color: "#666666", margin: "0" }}>Track your earnings and payment history</p>
      </div>

      {/* Current Period Overview */}
      <div style={{ padding: "2rem", border: "2px solid #4CAF50", borderRadius: "8px", background: "rgba(76, 175, 80, 0.05)" }}>
        <h2 style={{ color: "#4CAF50", marginBottom: "1.5rem" }}>Current Period (April 1-30, 2024)</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.5rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TRIPS COMPLETED</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.8rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {currentPeriod.tripsCompleted}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TOTAL DISTANCE</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.5rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {currentPeriod.totalDistance}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>BASE RATE</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.2rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
              {currentPeriod.baseRate}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DISTANCE RATE</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.2rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
              {currentPeriod.distanceRate}
            </p>
          </div>
        </div>

        <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "2px solid #E8E8E8" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
            <div>
              <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>BASE EARNINGS</p>
              <p style={{ color: "#1A1A1A", fontSize: "1.5rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
                $1,650.00
              </p>
            </div>
            <div>
              <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>BONUS</p>
              <p style={{ color: "#4CAF50", fontSize: "1.5rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
                {currentPeriod.bonusEarned}
              </p>
            </div>
            <div style={{ paddingTop: "1.5rem", borderTop: "2px solid #4CAF50" }}>
              <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>CURRENT TOTAL (this month)</p>
              <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
                {currentPeriod.currentEarnings}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1.5rem" }}>Payment History</h2>
        <div style={{ border: "1px solid #E8E8E8", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr", padding: "1rem", background: "#F5F5F5", borderBottom: "1px solid #E8E8E8", gap: "1rem" }}>
            <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>PERIOD</p>
            <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>BASE</p>
            <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>BONUS</p>
            <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>DEDUCTIONS</p>
            <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>TOTAL</p>
            <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>STATUS</p>
          </div>

          {payHistory.map((payment, idx) => {
            const statusBadge = getStatusBadge(payment.status);
            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr", padding: "1rem", borderBottom: idx < payHistory.length - 1 ? "1px solid #E8E8E8" : "none", gap: "1rem", background: payment.status === "pending" ? "rgba(255, 152, 0, 0.03)" : "white" }}>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0", fontSize: "0.9rem" }}>
                  {payment.period}
                </p>
                <p style={{ color: "#1A1A1A", margin: "0", fontSize: "0.9rem" }}>{payment.baseSalary}</p>
                <p style={{ color: "#4CAF50", fontWeight: "600", margin: "0", fontSize: "0.9rem" }}>
                  {payment.bonuses}
                </p>
                <p style={{ color: "#F44336", margin: "0", fontSize: "0.9rem" }}>{payment.deductions}</p>
                <p style={{ color: "#1A1A1A", fontWeight: "700", margin: "0", fontSize: "0.95rem" }}>
                  {payment.total}
                </p>
                <span
                  style={{
                    padding: "0.4rem 0.8rem",
                    background: statusBadge.color + "20",
                    color: statusBadge.color,
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                    textAlign: "center",
                    width: "fit-content",
                  }}
                >
                  {statusBadge.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pay Info Card */}
      <div style={{ padding: "1.5rem", background: "#E3F2FD", borderRadius: "8px", border: "1px solid #2196F3" }}>
        <p style={{ color: "#1565C0", fontWeight: "600", margin: "0" }}> Pay Information:</p>
        <ul style={{ color: "#1565C0", margin: "0.5rem 0 0 0", paddingLeft: "1.5rem" }}>
          <li>Base salary calculated on completed trips</li>
          <li>Distance bonuses applied per kilometer</li>
          <li>Safety bonuses awarded for 0 incident weeks</li>
          <li>Payments processed bi-weekly on Fridays</li>
          <li>Deductions for fuel, tolls, and equipment</li>
        </ul>
      </div>
    </div>
  );
}
