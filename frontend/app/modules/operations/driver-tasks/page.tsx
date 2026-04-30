"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useState, useEffect } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";

type DriverTask = {
  id: number;
  trip_id: number;
  pickup_location: string;
  dropoff_location: string;
  cargo_weight_tons: number;
  scheduled_date: string;
  scheduled_time: string;
  status: "pending" | "in_transit" | "completed" | "cancelled";
  customer_name?: string;
  estimated_cost?: number;
  start_time?: string;
  end_time?: string;
  distance_km?: number;
};

export default function DriverTaskListPage() {
  useRoleGuard(["driver"]);

  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<DriverTask | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  // Mock data - in production, fetch from backend
  useEffect(() => {
    setTasks([
      {
        id: 1,
        trip_id: 101,
        pickup_location: "Manhattan, NY",
        dropoff_location: "Newark, NJ",
        cargo_weight_tons: 5,
        scheduled_date: "2026-04-29",
        scheduled_time: "09:00",
        status: "pending",
        customer_name: "John Doe",
        estimated_cost: 450,
      },
      {
        id: 2,
        trip_id: 102,
        pickup_location: "Brooklyn, NY",
        dropoff_location: "Philadelphia, PA",
        cargo_weight_tons: 8,
        scheduled_date: "2026-04-29",
        scheduled_time: "11:30",
        status: "in_transit",
        customer_name: "Jane Smith",
        estimated_cost: 620,
        start_time: "11:15",
        distance_km: 95,
      },
      {
        id: 3,
        trip_id: 103,
        pickup_location: "Bronx, NY",
        dropoff_location: "Boston, MA",
        cargo_weight_tons: 3,
        scheduled_date: "2026-04-30",
        scheduled_time: "08:00",
        status: "pending",
        customer_name: "Mike Johnson",
        estimated_cost: 380,
      },
    ]);
  }, []);

  const handleStatusUpdate = (taskId: number, newStatus: "in_transit" | "completed") => {
    setUpdatingTaskId(taskId);

    // Simulate API call
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: newStatus,
                start_time:
                  newStatus === "in_transit" && !task.start_time
                    ? new Date().toLocaleTimeString()
                    : task.start_time,
                end_time: newStatus === "completed" ? new Date().toLocaleTimeString() : task.end_time,
              }
            : task
        )
      );

      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                start_time:
                  newStatus === "in_transit" && !prev.start_time
                    ? new Date().toLocaleTimeString()
                    : prev.start_time,
                end_time: newStatus === "completed" ? new Date().toLocaleTimeString() : prev.end_time,
              }
            : null
        );
      }

      setStatusMessage(`Task #${taskId} marked as ${newStatus.replace("_", " ")}`);
      setUpdatingTaskId(null);

      // Clear message after 3 seconds
      setTimeout(() => setStatusMessage(""), 3000);
    }, 500);
  };

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const inTransitTasks = tasks.filter((t) => t.status === "in_transit");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#FF9800";
      case "in_transit":
        return "#2196F3";
      case "completed":
        return "#4CAF50";
      default:
        return "#666666";
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/driver" },
          { label: "My Tasks" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>My Assigned Tasks</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View and manage your assigned delivery trips. Update status as you progress through each delivery.
        </p>

        {/* Status Message */}
        {statusMessage && (
          <div
            className="card"
            style={{
              background: "rgba(76, 175, 80, 0.1)",
              border: "1px solid #4CAF50",
              color: "#4CAF50",
              marginBottom: "1rem",
              padding: "0.75rem",
            }}
          >
            ✓ {statusMessage}
          </div>
        )}

        {/* Task Stats */}
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
              {pendingTasks.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Pending</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {inTransitTasks.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>In Transit</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {completedTasks.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Completed</div>
          </div>
        </div>

        {/* Pending Tasks */}
        {pendingTasks.length > 0 && (
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>📌 Pending Pickups</h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="card"
                  onClick={() => setSelectedTask(task)}
                  style={{
                    cursor: "pointer",
                    background: selectedTask?.id === task.id ? "rgba(255, 152, 0, 0.15)" : "#FFFFFF",
                    border: selectedTask?.id === task.id ? "2px solid #FF9800" : "1px solid #E8E8E8",
                    padding: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1A1A1A", fontSize: "1.1rem" }}>
                        Trip #{task.trip_id}
                      </strong>
                      <p style={{ margin: "0.25rem 0 0 0", color: "#666666", fontSize: "0.9rem" }}>
                        Scheduled: {task.scheduled_date} at {task.scheduled_time}
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "0.5rem 1rem",
                        background: "rgba(255, 152, 0, 0.1)",
                        color: "#FF9800",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      Pending
                    </span>
                  </div>

                  <div style={{ marginBottom: "0.75rem" }}>
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                      📍 {task.pickup_location} → {task.dropoff_location}
                    </p>
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                      📦 {task.cargo_weight_tons}t | Customer: {task.customer_name}
                    </p>
                    <p style={{ margin: "0.25rem 0", color: "#FF9800", fontWeight: 600 }}>
                      Estimated Cost: ${task.estimated_cost}
                    </p>
                  </div>

                  {selectedTask?.id === task.id && (
                    <button
                      onClick={() => handleStatusUpdate(task.id, "in_transit")}
                      disabled={updatingTaskId === task.id}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        background: "#FF9800",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: updatingTaskId === task.id ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        marginTop: "0.75rem",
                      }}
                    >
                      {updatingTaskId === task.id ? "Updating..." : "Start Trip"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In Transit Tasks */}
        {inTransitTasks.length > 0 && (
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>🚗 In Transit</h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {inTransitTasks.map((task) => (
                <div
                  key={task.id}
                  className="card"
                  onClick={() => setSelectedTask(task)}
                  style={{
                    cursor: "pointer",
                    background: selectedTask?.id === task.id ? "rgba(33, 150, 243, 0.15)" : "#FFFFFF",
                    border: selectedTask?.id === task.id ? "2px solid #2196F3" : "1px solid #E8E8E8",
                    padding: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1A1A1A", fontSize: "1.1rem" }}>
                        Trip #{task.trip_id}
                      </strong>
                      <p style={{ margin: "0.25rem 0 0 0", color: "#666666", fontSize: "0.9rem" }}>
                        Started: {task.start_time} | Distance: {task.distance_km}km
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "0.5rem 1rem",
                        background: "rgba(33, 150, 243, 0.1)",
                        color: "#2196F3",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      In Transit
                    </span>
                  </div>

                  <div style={{ marginBottom: "0.75rem" }}>
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                      📍 {task.pickup_location} → {task.dropoff_location}
                    </p>
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                      📦 {task.cargo_weight_tons}t | Customer: {task.customer_name}
                    </p>
                  </div>

                  {selectedTask?.id === task.id && (
                    <button
                      onClick={() => handleStatusUpdate(task.id, "completed")}
                      disabled={updatingTaskId === task.id}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: updatingTaskId === task.id ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        marginTop: "0.75rem",
                      }}
                    >
                      {updatingTaskId === task.id ? "Updating..." : "Mark as Completed"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>✓ Completed</h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="card"
                  style={{
                    opacity: 0.8,
                    padding: "1rem",
                    borderLeft: "3px solid #4CAF50",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1A1A1A" }}>Trip #{task.trip_id}</strong>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                        {task.pickup_location} → {task.dropoff_location}
                      </p>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.85rem" }}>
                        Completed: {task.end_time}
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "0.5rem 1rem",
                        background: "rgba(76, 175, 80, 0.1)",
                        color: "#4CAF50",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      Completed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "3rem", color: "#666666" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No tasks assigned yet</p>
            <p style={{ fontSize: "0.9rem" }}>Check back soon for new delivery assignments</p>
          </div>
        )}
      </div>
    </div>
  );
}
