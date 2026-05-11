"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useState, useEffect, useCallback } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import TripAssignment, { Trip, Driver, Vehicle } from "@/components/TripAssignment";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";

type BoardAssignment = {
  trip_id: number;
  trip_status: string;
  booking_id: number;
  pickup_location: string;
  dropoff_location: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  cargo_weight_tons: number;
  truck_code: string;
  driver_name: string | null;
};

function bookingToTrip(b: Booking): Trip {
  const date =
    typeof b.scheduled_date === "string"
      ? b.scheduled_date
      : (b.scheduled_date as unknown as Date)?.toISOString?.().slice(0, 10) ?? "";
  return {
    id: b.id,
    pickup_location: b.pickup_location,
    dropoff_location: b.dropoff_location,
    cargo_weight_tons: b.cargo_weight_tons,
    scheduled_date: date,
    scheduled_time: b.scheduled_time_slot,
    status: "pending",
    customer_name: `Customer #${b.customer_id}`,
    estimated_cost: b.estimated_cost,
  };
}

export default function DispatcherAssignmentPage() {
  useRoleGuard(["dispatcher", "manager", "admin"]);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<BoardAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setListError(null);
    try {
      const [list, roster, board] = await Promise.all([
        WorkflowApi.assignableBookings(),
        WorkflowApi.dispatchRoster().catch(() => null),
        WorkflowApi.dispatchAssignmentsBoard().catch(() => null),
      ]);
      setTrips(list.map(bookingToTrip));
      setDrivers(
        (roster?.drivers ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          status: "available",
        }))
      );
      setVehicles(
        (roster?.trucks ?? []).map((t) => ({
          id: t.id,
          plate_number: t.code,
          model: "Truck",
          capacity_tons: t.capacity_tons,
          status: "available",
        }))
      );
      setAssignments((board?.assignments as BoardAssignment[] | undefined) ?? []);
    } catch (e) {
      setTrips([]);
      setDrivers([]);
      setVehicles([]);
      setAssignments([]);
      setListError(e instanceof Error ? e.message : "Could not load dispatch data.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAssign = async (bookingId: number, driverId: number, vehicleId: number) => {
    setActionError(null);
    setLoading(true);
    try {
      await WorkflowApi.manualAssign(bookingId, { truck_id: vehicleId, driver_id: driverId });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setLoading(false);
    }
  };

  const assignedTrips = assignments.filter(
    (a) => a.trip_status !== "completed" && a.trip_status !== "cancelled"
  );

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/dispatcher" },
          { label: "Trip Processing" },
          { label: "Dispatcher Assignment" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Trip Dispatcher</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Assign drivers and vehicles to pending trips. Match capacity to cargo weight and optimize dispatch schedule.
        </p>

        {listError ? (
          <div
            className="card"
            style={{ marginBottom: "1rem", background: "#FEE2E2", color: "#991B1B", padding: "0.75rem 1rem" }}
          >
            {listError}
          </div>
        ) : null}
        {actionError ? (
          <div
            className="card"
            style={{ marginBottom: "1rem", background: "#FEE2E2", color: "#991B1B", padding: "0.75rem 1rem" }}
          >
            {actionError}
          </div>
        ) : null}

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
              {trips.filter((t) => t.status === "pending").length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Pending Trips</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {assignedTrips.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Assigned</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {drivers.filter((d) => d.status === "available").length}/{drivers.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Available Drivers</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {vehicles.filter((v) => v.status === "available").length}/{vehicles.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Available Vehicles</div>
          </div>
        </div>

        {/* Assignment Interface */}
        <TripAssignment trips={trips} drivers={drivers} vehicles={vehicles} onAssign={handleAssign} loading={loading} />

        {/* Recently Assigned */}
        {assignedTrips.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Active assignments</h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {assignedTrips.map((row) => (
                <div key={row.trip_id} className="card" style={{ padding: "1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1A1A1A" }}>
                        Trip #{row.trip_id} · Booking #{row.booking_id}
                      </strong>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                        {row.pickup_location} → {row.dropoff_location}
                      </p>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                        {row.truck_code} | {row.driver_name ?? "—"} · {row.scheduled_date} {row.scheduled_time_slot}
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      {row.trip_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
