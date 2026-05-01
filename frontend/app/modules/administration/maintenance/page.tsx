"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type MaintenanceReport = {
  id: number;
  vehicle_id: number;
  plate_number: string;
  maintenance_type: "scheduled" | "emergency" | "preventive";
  description: string;
  status: "pending" | "in-progress" | "completed";
  scheduled_date: string;
  completion_date?: string;
  cost: number;
  technician: string;
};

export default function MaintenancePage() {
  useRoleGuard(["admin"]);

  const [reports] = useState<MaintenanceReport[]>([
    {
      id: 1,
      vehicle_id: 1,
      plate_number: "VOL-2024-001",
      maintenance_type: "scheduled",
      description: "Regular 6-month service: Oil change, filter replacement",
      status: "completed",
      scheduled_date: "2026-04-20",
      completion_date: "2026-04-22",
      cost: 350,
      technician: "John Smith",
    },
    {
      id: 2,
      vehicle_id: 3,
      plate_number: "DAF-2022-003",
      maintenance_type: "emergency",
      description: "Brake system repair - safety inspection failed",
      status: "in-progress",
      scheduled_date: "2026-04-25",
      cost: 1200,
      technician: "Mike Johnson",
    },
    {
      id: 3,
      vehicle_id: 2,
      plate_number: "SCA-2023-002",
      maintenance_type: "preventive",
      description: "Tire inspection and replacement (2 tires)",
      status: "pending",
      scheduled_date: "2026-05-10",
      cost: 450,
      technician: "David Brown",
    },
  ]);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<number | null>(null);

  const filteredReports =
    filterStatus === "all"
      ? reports
      : reports.filter((r) => r.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#4CAF50";
      case "in-progress":
        return "#2196F3";
      case "pending":
        return "#FF9800";
      default:
        return "#999";
    }
  };

  const stats = {
    total: reports.length,
    completed: reports.filter((r) => r.status === "completed").length,
    inProgress: reports.filter((r) => r.status === "in-progress").length,
    pending: reports.filter((r) => r.status === "pending").length,
    totalCost: reports.reduce((sum, r) => sum + r.cost, 0),
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System Administration" },
          { label: "Maintenance Reports" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Maintenance Reports
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Track scheduled, preventive, and emergency maintenance for all vehicles.
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
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {stats.total}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Total Reports
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {stats.completed}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Completed</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {stats.inProgress}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              In Progress
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {stats.pending}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Pending</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              ${stats.totalCost.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Cost</div>
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
            <option value="all">All Reports</option>
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Reports List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="card"
              onClick={() =>
                setSelectedReport(
                  selectedReport === report.id ? null : report.id
                )
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  selectedReport === report.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  selectedReport === report.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
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
                      {report.plate_number}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(report.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {report.status.replace("-", " ")}
                    </span>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: "#E0E0E0",
                        color: "#333",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {report.maintenance_type}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    {report.description}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Scheduled: {report.scheduled_date}
                    {report.completion_date && ` | Completed: ${report.completion_date}`}
                  </p>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    marginLeft: "1rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div style={{ color: "#FF9800", fontWeight: 700 }}>
                    ${report.cost.toFixed(2)}
                  </div>
                  <p
                    style={{
                      color: "#666666",
                      fontSize: "0.85rem",
                      margin: "0.25rem 0 0 0",
                    }}
                  >
                    {report.technician}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
