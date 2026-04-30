"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type LoadingOperation = {
  id: number;
  trip_id: number;
  warehouse_name: string;
  operation_type: "loading" | "unloading";
  scheduled_time: string;
  cargo_weight: number;
  cargo_description: string;
  status: "scheduled" | "in-progress" | "completed";
  driver: string;
  vehicle: string;
};

export default function LoadingPage() {
  useRoleGuard(["dispatcher"]);

  const [operations] = useState<LoadingOperation[]>([
    {
      id: 1,
      trip_id: 101,
      warehouse_name: "New York Distribution Center",
      operation_type: "loading",
      scheduled_time: "2026-04-28 09:00",
      cargo_weight: 18.5,
      cargo_description: "Electronic components - 45 pallets",
      status: "scheduled",
      driver: "Carlos Rodriguez",
      vehicle: "Volvo FH16 (Plate: NY-2048)",
    },
    {
      id: 2,
      trip_id: 102,
      warehouse_name: "Boston Freight Terminal",
      operation_type: "loading",
      scheduled_time: "2026-04-28 08:30",
      cargo_weight: 20,
      cargo_description: "Automotive parts - 38 pallets",
      status: "in-progress",
      driver: "James Cooper",
      vehicle: "Scania R440 (Plate: MA-3015)",
    },
    {
      id: 3,
      trip_id: 103,
      warehouse_name: "Philadelphia Warehouse",
      operation_type: "unloading",
      scheduled_time: "2026-04-28 11:30",
      cargo_weight: 15,
      cargo_description: "Office supplies - 22 pallets",
      status: "completed",
      driver: "Sarah Williams",
      vehicle: "DAF XF (Plate: PA-5022)",
    },
  ]);

  const [expandedOperation, setExpandedOperation] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const filteredOperations =
    filterType === "all"
      ? operations
      : operations.filter((o) => o.operation_type === filterType);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
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
    scheduled: operations.filter((o) => o.status === "scheduled").length,
    inProgress: operations.filter((o) => o.status === "in-progress").length,
    completed: operations.filter((o) => o.status === "completed").length,
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/dispatcher" },
          { label: "Dispatcher Coordination" },
          { label: "Confirm Loading / Unloading" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          📦 Confirm Loading / Unloading
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Manage and confirm cargo loading and unloading operations at warehouses and distribution centers.
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
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {stats.scheduled}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Scheduled</div>
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
        </div>

        {/* Filter */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ color: "#1A1A1A", fontWeight: 600, marginRight: "1rem" }}>
            Filter by Type:
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              color: "#1A1A1A",
              cursor: "pointer",
            }}
          >
            <option value="all">All Operations</option>
            <option value="loading">Loading Only</option>
            <option value="unloading">Unloading Only</option>
          </select>
        </div>

        {/* Operations List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredOperations.map((operation) => (
            <div
              key={operation.id}
              className="card"
              onClick={() =>
                setExpandedOperation(
                  expandedOperation === operation.id ? null : operation.id
                )
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  expandedOperation === operation.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  expandedOperation === operation.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
                borderLeft: `4px solid ${getStatusColor(operation.status)}`,
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
                      {operation.warehouse_name}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: operation.operation_type === "loading" ? "#4CAF50" : "#2196F3",
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {operation.operation_type}
                    </span>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(operation.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {operation.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    Driver: {operation.driver} | Vehicle: {operation.vehicle}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    Cargo: {operation.cargo_weight}T - {operation.cargo_description}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Scheduled: {operation.scheduled_time} | Trip #{operation.trip_id}
                  </p>
                </div>
              </div>

              {expandedOperation === operation.id && (
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
                    Operation Details
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Warehouse
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 600 }}>
                        {operation.warehouse_name}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Cargo Weight
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 600 }}>
                        {operation.cargo_weight} tons
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Scheduled Time
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 600 }}>
                        {operation.scheduled_time}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Status
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 600, textTransform: "capitalize" }}>
                        {operation.status}
                      </p>
                    </div>
                  </div>

                  {operation.status === "scheduled" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "1rem",
                      }}
                    >
                      <button
                        style={{
                          padding: "0.75rem",
                          background: "#2196F3",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        ▶ Start Operation
                      </button>
                      <button
                        style={{
                          padding: "0.75rem",
                          background: "#FF9800",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        ⏱ Reschedule
                      </button>
                    </div>
                  )}
                  {operation.status === "in-progress" && (
                    <button
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      ✓ Complete Operation
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
