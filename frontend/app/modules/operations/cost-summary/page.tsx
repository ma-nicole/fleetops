"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type TripCost = {
  trip_id: number;
  status: string;
  pickup: string;
  dropoff: string;
  base_fare: number;
  fuel_cost: number;
  labor_cost: number;
  toll_cost: number;
  surcharges: number;
  total: number;
  date: string;
};

export default function CostSummaryPage() {
  useRoleGuard(["customer", "manager", "admin"]);

  const [tripCosts] = useState<TripCost[]>([
    {
      trip_id: 101,
      status: "completed",
      pickup: "New York, NY",
      dropoff: "Philadelphia, PA",
      base_fare: 150,
      fuel_cost: 144,
      labor_cost: 200,
      toll_cost: 15.5,
      surcharges: 20,
      total: 529.5,
      date: "2026-04-28",
    },
    {
      trip_id: 102,
      status: "completed",
      pickup: "Boston, MA",
      dropoff: "New York, NY",
      base_fare: 180,
      fuel_cost: 204.75,
      labor_cost: 250,
      toll_cost: 22,
      surcharges: 30,
      total: 686.75,
      date: "2026-04-27",
    },
    {
      trip_id: 103,
      status: "in-transit",
      pickup: "Philadelphia, PA",
      dropoff: "Washington, DC",
      base_fare: 120,
      fuel_cost: 96,
      labor_cost: 175,
      toll_cost: 18.75,
      surcharges: 15,
      total: 424.75,
      date: "2026-04-28",
    },
    {
      trip_id: 104,
      status: "pending",
      pickup: "Washington, DC",
      dropoff: "Atlanta, GA",
      base_fare: 200,
      fuel_cost: 0,
      labor_cost: 0,
      toll_cost: 0,
      surcharges: 0,
      total: 200,
      date: "2026-04-29",
    },
  ]);

  const [expandedTrip, setExpandedTrip] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredTrips =
    filterStatus === "all"
      ? tripCosts
      : tripCosts.filter((trip) => trip.status === filterStatus);

  const completedTrips = tripCosts.filter((t) => t.status === "completed");
  const totalRevenue = completedTrips.reduce((sum, t) => sum + t.total, 0);
  const avgCost = completedTrips.length > 0 ? totalRevenue / completedTrips.length : 0;
  const totalFuel = completedTrips.reduce((sum, t) => sum + t.fuel_cost, 0);
  const totalLabor = completedTrips.reduce((sum, t) => sum + t.labor_cost, 0);
  const totalTolls = completedTrips.reduce((sum, t) => sum + t.toll_cost, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#4CAF50";
      case "in-transit":
        return "#2196F3";
      case "pending":
        return "#FF9800";
      default:
        return "#999";
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/manager" },
          { label: "Trip Processing" },
          { label: "Cost Summary" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Cost Summary</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View all trip costs with itemized breakdowns. Track revenue and cost analysis across completed trips.
        </p>

        {/* Summary Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              ${totalRevenue.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Revenue</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              ${avgCost.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Avg Cost/Trip</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              ${totalFuel.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Fuel</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              ${totalLabor.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Labor</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#9C27B0" }}>
              ${totalTolls.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Tolls</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {completedTrips.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Completed Trips</div>
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
            <option value="all">All Trips</option>
            <option value="completed">Completed</option>
            <option value="in-transit">In Transit</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Trip List */}
        {filteredTrips.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem", color: "#666666" }}>
            No trips found
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {filteredTrips.map((trip) => (
              <div
                key={trip.trip_id}
                className="card"
                onClick={() =>
                  setExpandedTrip(expandedTrip === trip.trip_id ? null : trip.trip_id)
                }
                style={{
                  cursor: "pointer",
                  padding: "1rem",
                  background:
                    expandedTrip === trip.trip_id
                      ? "rgba(255, 152, 0, 0.15)"
                      : "#FFFFFF",
                  border:
                    expandedTrip === trip.trip_id
                      ? "2px solid #FF9800"
                      : "1px solid #E8E8E8",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: expandedTrip === trip.trip_id ? "1rem" : 0,
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
                      <strong style={{ color: "#1A1A1A", fontSize: "1.1rem" }}>
                        Trip #{trip.trip_id}
                      </strong>
                      <span
                        style={{
                          padding: "0.25rem 0.75rem",
                          background: getStatusColor(trip.status),
                          color: "white",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}
                      >
                        {trip.status}
                      </span>
                    </div>
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                      {trip.pickup} → {trip.dropoff}
                    </p>
                    <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                      {trip.date}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        color: "#FF9800",
                        fontWeight: 700,
                        fontSize: "1.3rem",
                      }}
                    >
                      ${trip.total.toFixed(2)}
                    </div>
                    <p
                      style={{
                        color: "#666666",
                        fontSize: "0.85rem",
                        margin: "0.25rem 0 0 0",
                      }}
                    >
                      Total Cost
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedTrip === trip.trip_id && (
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
                      Cost Breakdown
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: "1rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <div>
                        <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                          Base Fare
                        </p>
                        <p
                          style={{
                            color: "#1A1A1A",
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            margin: 0,
                          }}
                        >
                          ${trip.base_fare.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                          Fuel Cost
                        </p>
                        <p
                          style={{
                            color: "#1A1A1A",
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            margin: 0,
                          }}
                        >
                          ${trip.fuel_cost.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                          Labor Cost
                        </p>
                        <p
                          style={{
                            color: "#1A1A1A",
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            margin: 0,
                          }}
                        >
                          ${trip.labor_cost.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                          Toll Cost
                        </p>
                        <p
                          style={{
                            color: "#1A1A1A",
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            margin: 0,
                          }}
                        >
                          ${trip.toll_cost.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                          Surcharges
                        </p>
                        <p
                          style={{
                            color: "#1A1A1A",
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            margin: 0,
                          }}
                        >
                          ${trip.surcharges.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        borderTop: "2px solid #FFE0B2",
                        paddingTop: "1rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#1A1A1A", fontWeight: 600 }}>
                        TOTAL:
                      </span>
                      <span
                        style={{
                          color: "#FF9800",
                          fontWeight: 700,
                          fontSize: "1.4rem",
                        }}
                      >
                        ${trip.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
