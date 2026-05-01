"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { formatPhp } from "@/lib/appLocale";
import { useState } from "react";

type MaintenanceItem = {
  id: number;
  service_type: "scheduled" | "emergency" | "inspection";
  description: string;
  due_date: string;
  status: "pending" | "in-progress" | "completed";
  cost_estimated: number;
};

export default function MaintenanceStatusPage() {
  useRoleGuard(["driver"]);

  const [maintenanceItems] = useState<MaintenanceItem[]>([
    {
      id: 1,
      service_type: "scheduled",
      description: "Oil change and filter replacement",
      due_date: "2026-05-15",
      status: "pending",
      cost_estimated: 150,
    },
    {
      id: 2,
      service_type: "inspection",
      description: "Brake system inspection",
      due_date: "2026-05-05",
      status: "pending",
      cost_estimated: 100,
    },
    {
      id: 3,
      service_type: "scheduled",
      description: "Tire rotation and balancing",
      due_date: "2026-06-01",
      status: "pending",
      cost_estimated: 200,
    },
    {
      id: 4,
      service_type: "inspection",
      description: "Engine diagnostics",
      due_date: "2026-04-20",
      status: "completed",
      cost_estimated: 120,
    },
  ]);

  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "scheduled":
        return "#FF9800";
      case "emergency":
        return "#F44336";
      case "inspection":
        return "#2196F3";
      default:
        return "#999";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#FF9800";
      case "in-progress":
        return "#2196F3";
      case "completed":
        return "#4CAF50";
      default:
        return "#999";
    }
  };

  const stats = {
    total: maintenanceItems.length,
    pending: maintenanceItems.filter((m) => m.status === "pending").length,
    inProgress: maintenanceItems.filter((m) => m.status === "in-progress").length,
    completed: maintenanceItems.filter((m) => m.status === "completed").length,
    estimatedCost: maintenanceItems
      .filter((m) => m.status === "pending")
      .reduce((sum, m) => sum + m.cost_estimated, 0),
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/driver" },
          { label: "Truck & Costs" },
          { label: "Truck Maintenance Status" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Truck Maintenance Status
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View scheduled maintenance for your assigned truck and upcoming service requirements.
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
              {stats.pending}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Pending</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {stats.inProgress}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>In Progress</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {stats.completed}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Completed</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {formatPhp(stats.estimatedCost)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Est. Cost (Pending)
            </div>
          </div>
        </div>

        {/* Maintenance List */}
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Maintenance Schedule</h3>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {maintenanceItems.map((item) => (
            <div
              key={item.id}
              className="card"
              onClick={() =>
                setExpandedItem(expandedItem === item.id ? null : item.id)
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  expandedItem === item.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  expandedItem === item.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
                borderLeft: `4px solid ${getTypeColor(item.service_type)}`,
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
                      {item.description}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(item.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Due: {item.due_date} | Est. Cost: {formatPhp(item.cost_estimated)}
                  </p>
                </div>
              </div>

              {expandedItem === item.id && (
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
                    Service Details
                  </h4>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Type:</strong>{" "}
                    {item.service_type.charAt(0).toUpperCase() +
                      item.service_type.slice(1)}
                  </p>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Due Date:</strong> {item.due_date}
                  </p>
                  <p style={{ color: "#FF9800", margin: "0.5rem 0", fontWeight: 600 }}>
                    <strong>Estimated Cost:</strong> {formatPhp(item.cost_estimated)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
