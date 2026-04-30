"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type CostBreakdown = {
  trip_id: number;
  base_fare: number;
  fuel_cost: number;
  labor_cost: number;
  toll_cost: number;
  surcharges: number;
  total: number;
  status: "pending" | "computed" | "invoiced";
};

export default function CostComputationPage() {
  useRoleGuard(["manager", "admin"]);

  const [trips, setTrips] = useState<CostBreakdown[]>([
    {
      trip_id: 101,
      base_fare: 150,
      fuel_cost: 144,
      labor_cost: 200,
      toll_cost: 15.5,
      surcharges: 20,
      total: 529.5,
      status: "computed",
    },
    {
      trip_id: 102,
      base_fare: 180,
      fuel_cost: 204.75,
      labor_cost: 250,
      toll_cost: 22,
      surcharges: 30,
      total: 686.75,
      status: "computed",
    },
    {
      trip_id: 103,
      base_fare: 120,
      fuel_cost: 0,
      labor_cost: 0,
      toll_cost: 0,
      surcharges: 0,
      total: 0,
      status: "pending",
    },
  ]);

  const [selectedTrip, setSelectedTrip] = useState<CostBreakdown | null>(null);

  const pendingTrips = trips.filter((t) => t.status === "pending");
  const computedTrips = trips.filter((t) => t.status === "computed");

  const handleCompute = (tripId: number) => {
    // In production, this would call the backend computation API
    setTrips((prev) =>
      prev.map((trip) =>
        trip.trip_id === tripId
          ? {
              ...trip,
              status: "computed",
              total: trip.base_fare + trip.fuel_cost + trip.labor_cost + trip.toll_cost + trip.surcharges,
            }
          : trip
      )
    );

    setSelectedTrip(null);
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/manager" },
          { label: "Trip Processing" },
          { label: "Cost Computation Engine" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Cost Computation Engine</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Calculate total trip costs by combining fuel, labor, toll, and surcharge data. Triggered when all cost components are recorded.
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
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#F44336" }}>
              {pendingTrips.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Pending Computation</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {computedTrips.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Computed</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              ${computedTrips.reduce((sum, t) => sum + t.total, 0).toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Revenue</div>
          </div>
        </div>

        {/* Pending Computation */}
        {pendingTrips.length > 0 && (
          <div style={{ marginBottom: "3rem" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>📋 Awaiting Computation</h3>
            <p style={{ color: "#F44336", marginBottom: "1rem", fontWeight: 600 }}>
              These trips need cost components (fuel, labor, tolls) recorded before computation can proceed.
            </p>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {pendingTrips.map((trip) => (
                <div
                  key={trip.trip_id}
                  className="card"
                  style={{
                    padding: "1rem",
                    borderLeft: "3px solid #F44336",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1A1A1A" }}>Trip #{trip.trip_id}</strong>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                        Status: Awaiting cost components (fuel, labor, tolls)
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#F44336",
                        color: "white",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      Pending
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Computed Trips */}
        {computedTrips.length > 0 && (
          <div>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>✓ Computed Costs</h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              {computedTrips.map((trip) => (
                <div
                  key={trip.trip_id}
                  className="card"
                  onClick={() => setSelectedTrip(trip)}
                  style={{
                    cursor: "pointer",
                    background: selectedTrip?.trip_id === trip.trip_id ? "rgba(255, 152, 0, 0.15)" : "#FFFFFF",
                    border: selectedTrip?.trip_id === trip.trip_id ? "2px solid #FF9800" : "1px solid #E8E8E8",
                    padding: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1A1A1A", fontSize: "1.1rem" }}>
                        Trip #{trip.trip_id}
                      </strong>
                      <p style={{ margin: "0.5rem 0 0 0", color: "#666666", fontSize: "0.9rem" }}>
                        All cost components recorded and computed
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#4CAF50",
                        color: "white",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      Computed
                    </span>
                  </div>

                  {selectedTrip?.trip_id === trip.trip_id && (
                    <div
                      style={{
                        background: "rgba(255, 152, 0, 0.08)",
                        border: "1px solid #FFE0B2",
                        borderRadius: "8px",
                        padding: "1rem",
                      }}
                    >
                      <h4 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>Cost Breakdown</h4>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "1rem",
                          marginBottom: "1rem",
                        }}
                      >
                        <div>
                          <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0.5rem 0" }}>
                            Base Fare
                          </p>
                          <p style={{ color: "#1A1A1A", fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>
                            ${trip.base_fare.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0.5rem 0" }}>
                            Fuel Cost
                          </p>
                          <p style={{ color: "#1A1A1A", fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>
                            ${trip.fuel_cost.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0.5rem 0" }}>
                            Labor Cost
                          </p>
                          <p style={{ color: "#1A1A1A", fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>
                            ${trip.labor_cost.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0.5rem 0" }}>
                            Toll Cost
                          </p>
                          <p style={{ color: "#1A1A1A", fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>
                            ${trip.toll_cost.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0.5rem 0" }}>
                            Surcharges
                          </p>
                          <p style={{ color: "#1A1A1A", fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>
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
                        <span style={{ color: "#1A1A1A", fontWeight: 600 }}>TOTAL:</span>
                        <span style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.5rem" }}>
                          ${trip.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {trips.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "3rem", color: "#666666" }}>
            No trips to compute
          </div>
        )}
      </div>
    </div>
  );
}
