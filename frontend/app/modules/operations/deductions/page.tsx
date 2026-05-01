"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { formatPhp } from "@/lib/appLocale";
import { useState } from "react";

type Deduction = {
  id: number;
  type: "fuel_surcharge" | "maintenance" | "violation" | "accident" | "uniform";
  description: string;
  amount: number;
  date: string;
  status: "pending" | "approved" | "disputed";
  remarks?: string;
};

export default function DeductionsPage() {
  useRoleGuard(["driver"]);

  const [deductions] = useState<Deduction[]>([
    {
      id: 1,
      type: "fuel_surcharge",
      description: "Fuel surcharge deduction - April billing",
      amount: 45.5,
      date: "2026-04-28",
      status: "approved",
    },
    {
      id: 2,
      type: "maintenance",
      description: "Scheduled tire replacement",
      amount: 85.0,
      date: "2026-04-27",
      status: "approved",
    },
    {
      id: 3,
      type: "violation",
      description: "Speeding violation - NLEX",
      amount: 50.0,
      date: "2026-04-26",
      status: "pending",
      remarks: "Awaiting approval from safety department",
    },
    {
      id: 4,
      type: "uniform",
      description: "Uniform replacement set",
      amount: 75.0,
      date: "2026-04-25",
      status: "disputed",
      remarks: "Driver disputes uniform quality standards",
    },
  ]);

  const [selectedDeduction, setSelectedDeduction] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredDeductions =
    filterStatus === "all"
      ? deductions
      : deductions.filter((d) => d.status === filterStatus);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "fuel_surcharge":
        return "#FF9800";
      case "maintenance":
        return "#2196F3";
      case "violation":
        return "#F44336";
      case "accident":
        return "#D32F2F";
      case "uniform":
        return "#9C27B0";
      default:
        return "#999";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "#4CAF50";
      case "pending":
        return "#FF9800";
      case "disputed":
        return "#F44336";
      default:
        return "#999";
    }
  };

  const stats = {
    total: deductions.reduce((sum, d) => sum + d.amount, 0),
    approved: deductions
      .filter((d) => d.status === "approved")
      .reduce((sum, d) => sum + d.amount, 0),
    pending: deductions
      .filter((d) => d.status === "pending")
      .reduce((sum, d) => sum + d.amount, 0),
    disputed: deductions
      .filter((d) => d.status === "disputed")
      .reduce((sum, d) => sum + d.amount, 0),
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/driver" },
          { label: "Truck & Costs" },
          { label: "Deductions & Adjustments" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Deductions & Adjustments
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View all deductions applied to your pay. Dispute items if needed.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#F44336" }}>
              {formatPhp(stats.total)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Total Deductions
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {formatPhp(stats.approved)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Approved</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {formatPhp(stats.pending)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Pending</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#F44336" }}>
              {formatPhp(stats.disputed)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Disputed</div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ color: "#1A1A1A", fontWeight: 600, marginRight: "1rem" }}>
            Filter by Status:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              color: "#1A1A1A",
              cursor: "pointer",
            }}
          >
            <option value="all">All Deductions</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>

        {/* Deductions List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredDeductions.map((deduction) => (
            <div
              key={deduction.id}
              className="card"
              onClick={() =>
                setSelectedDeduction(
                  selectedDeduction === deduction.id ? null : deduction.id
                )
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  selectedDeduction === deduction.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  selectedDeduction === deduction.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
                borderLeft: `4px solid ${getTypeColor(deduction.type)}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <strong style={{ color: "#1A1A1A" }}>
                      {deduction.description}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(deduction.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {deduction.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    {deduction.date} | Type: {deduction.type.replace("_", " ")}
                  </p>
                </div>
                <div style={{ textAlign: "right", marginLeft: "1rem", whiteSpace: "nowrap" }}>
                  <div style={{ color: "#F44336", fontWeight: 700, fontSize: "1.1rem" }}>
                    {formatPhp(-deduction.amount)}
                  </div>
                </div>
              </div>

              {selectedDeduction === deduction.id && (
                <div
                  style={{
                    background: "rgba(255, 152, 0, 0.08)",
                    border: "1px solid #FFE0B2",
                    borderRadius: "8px",
                    padding: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <h4 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                    Deduction Details
                  </h4>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Type:</strong>{" "}
                    {deduction.type.charAt(0).toUpperCase() +
                      deduction.type.slice(1).replace(/_/g, " ")}
                  </p>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Amount:</strong> {formatPhp(-deduction.amount)}
                  </p>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Date:</strong> {deduction.date}
                  </p>
                  {deduction.remarks && (
                    <p style={{ color: "#FF9800", margin: "1rem 0 0 0", fontStyle: "italic" }}>
                      <strong>Remarks:</strong> {deduction.remarks}
                    </p>
                  )}
                  {deduction.status === "pending" && (
                    <button
                      style={{
                        marginTop: "1rem",
                        padding: "0.5rem 1rem",
                        background: "#F44336",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Dispute This Deduction
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
