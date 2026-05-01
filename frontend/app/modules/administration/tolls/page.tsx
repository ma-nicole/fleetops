"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { formatPhp } from "@/lib/appLocale";
import { useState } from "react";

type TollRecord = {
  id: number;
  trip_id: number;
  toll_booth_name: string;
  toll_zone: string;
  amount: number;
  vehicle_class: string;
  date_recorded: string;
  status: "paid" | "pending" | "reimbursed";
};

export default function TollManagementPage() {
  useRoleGuard(["admin"]);

  const [tolls] = useState<TollRecord[]>([
    {
      id: 1,
      trip_id: 101,
      toll_booth_name: "NLEX Bocaue Toll Plaza",
      toll_zone: "NCR–Central Luzon",
      amount: 155,
      vehicle_class: "Class 3",
      date_recorded: "2026-04-28",
      status: "paid",
    },
    {
      id: 2,
      trip_id: 102,
      toll_booth_name: "SLEX Mamplasan Toll Plaza",
      toll_zone: "Laguna",
      amount: 220,
      vehicle_class: "Class 3",
      date_recorded: "2026-04-27",
      status: "paid",
    },
    {
      id: 3,
      trip_id: 103,
      toll_booth_name: "STAR Toll Lipa",
      toll_zone: "Batangas",
      amount: 188,
      vehicle_class: "Class 3",
      date_recorded: "2026-04-28",
      status: "pending",
    },
    {
      id: 4,
      trip_id: 104,
      toll_booth_name: "TPLEX Tarlac Exit",
      toll_zone: "Central Luzon",
      amount: 350,
      vehicle_class: "Class 3",
      date_recorded: "2026-04-28",
      status: "reimbursed",
    },
  ]);

  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredTolls =
    filterStatus === "all"
      ? tolls
      : tolls.filter((t) => t.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "#4CAF50";
      case "pending":
        return "#FF9800";
      case "reimbursed":
        return "#2196F3";
      default:
        return "#999";
    }
  };

  const stats = {
    total: tolls.length,
    paid: tolls.filter((t) => t.status === "paid").length,
    pending: tolls.filter((t) => t.status === "pending").length,
    reimbursed: tolls.filter((t) => t.status === "reimbursed").length,
    totalAmount: tolls.reduce((sum, t) => sum + t.amount, 0),
    paidAmount: tolls
      .filter((t) => t.status === "paid")
      .reduce((sum, t) => sum + t.amount, 0),
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System Administration" },
          { label: "Toll Management" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Toll Fees Management
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Track toll booth charges, payment status, and reimbursements across all trips.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {stats.total}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Total Toll Records
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {stats.paid}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Paid</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {stats.pending}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Pending</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {formatPhp(stats.totalAmount)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Amount</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {formatPhp(stats.paidAmount)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Paid Amount</div>
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
            <option value="all">All Tolls</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="reimbursed">Reimbursed</option>
          </select>
        </div>

        {/* Toll Records List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredTolls.map((toll) => (
            <div key={toll.id} className="card" style={{ padding: "1rem" }}>
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
                      {toll.toll_booth_name}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(toll.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {toll.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    Trip #{toll.trip_id} | Zone: {toll.toll_zone} | Class:{" "}
                    {toll.vehicle_class}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    {toll.date_recorded}
                  </p>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    marginLeft: "1rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.2rem" }}>
                    {formatPhp(toll.amount)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
