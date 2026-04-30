"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type RouteProposal = {
  id: number;
  trip_id: number;
  driver: string;
  pickup: string;
  dropoff: string;
  proposed_by: string;
  status: "pending" | "approved" | "rejected";
  submitted_date: string;
  route_details: {
    distance: string;
    duration: string;
    toll_cost: string;
    fuel_estimate: string;
  };
};

export default function RouteApprovalPage() {
  useRoleGuard(["dispatcher"]);

  const [routes] = useState<RouteProposal[]>([
    {
      id: 1,
      trip_id: 101,
      driver: "Carlos Rodriguez",
      pickup: "New York, NY",
      dropoff: "Philadelphia, PA",
      proposed_by: "Carlos Rodriguez",
      status: "pending",
      submitted_date: "2026-04-28 08:30",
      route_details: {
        distance: "95 miles",
        duration: "2.5 hours",
        toll_cost: "$18.50",
        fuel_estimate: "$42.00",
      },
    },
    {
      id: 2,
      trip_id: 102,
      driver: "James Cooper",
      pickup: "Boston, MA",
      dropoff: "New York, NY",
      proposed_by: "James Cooper",
      status: "pending",
      submitted_date: "2026-04-28 07:15",
      route_details: {
        distance: "215 miles",
        duration: "3.75 hours",
        toll_cost: "$32.00",
        fuel_estimate: "$95.00",
      },
    },
    {
      id: 3,
      trip_id: 103,
      driver: "Sarah Williams",
      pickup: "Philadelphia, PA",
      dropoff: "Washington, DC",
      proposed_by: "Sarah Williams",
      status: "approved",
      submitted_date: "2026-04-27 14:20",
      route_details: {
        distance: "140 miles",
        duration: "2.75 hours",
        toll_cost: "$22.00",
        fuel_estimate: "$62.00",
      },
    },
  ]);

  const [expandedRoute, setExpandedRoute] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("pending");

  const filteredRoutes =
    filterStatus === "all"
      ? routes
      : routes.filter((r) => r.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#FF9800";
      case "approved":
        return "#4CAF50";
      case "rejected":
        return "#F44336";
      default:
        return "#999";
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/dispatcher" },
          { label: "Dispatcher Coordination" },
          { label: "Approve Route Plans" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          ✅ Approve Route Plans
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Review and approve route proposals from drivers. Verify distance, duration, and estimated costs.
        </p>

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
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All Routes</option>
          </select>
        </div>

        {/* Routes List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredRoutes.map((route) => (
            <div
              key={route.id}
              className="card"
              onClick={() =>
                setExpandedRoute(expandedRoute === route.id ? null : route.id)
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  expandedRoute === route.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  expandedRoute === route.id
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
                      Trip #{route.trip_id} - Route #{route.id}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(route.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {route.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    Driver: {route.driver}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    {route.pickup} → {route.dropoff}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Submitted: {route.submitted_date}
                  </p>
                </div>
              </div>

              {expandedRoute === route.id && (
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
                    Route Details
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
                        Distance
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 700 }}>
                        {route.route_details.distance}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Duration
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 700 }}>
                        {route.route_details.duration}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Toll Cost
                      </p>
                      <p style={{ color: "#FF9800", fontWeight: 700 }}>
                        {route.route_details.toll_cost}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Fuel Estimate
                      </p>
                      <p style={{ color: "#FF9800", fontWeight: 700 }}>
                        {route.route_details.fuel_estimate}
                      </p>
                    </div>
                  </div>

                  {route.status === "pending" && (
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
                          background: "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        ✓ Approve Route
                      </button>
                      <button
                        style={{
                          padding: "0.75rem",
                          background: "#F44336",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        ✗ Reject & Request Revision
                      </button>
                    </div>
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
