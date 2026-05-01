"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useState, useEffect } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import TripAssignment, { Trip, Driver, Vehicle } from "@/components/TripAssignment";

export default function DispatcherAssignmentPage() {
  useRoleGuard(["dispatcher", "manager", "admin"]);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock data - in production, fetch from backend
  useEffect(() => {
    setTrips([
      {
        id: 1,
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
        pickup_location: "Brooklyn, NY",
        dropoff_location: "Philadelphia, PA",
        cargo_weight_tons: 8,
        scheduled_date: "2026-04-29",
        scheduled_time: "11:30",
        status: "pending",
        customer_name: "Jane Smith",
        estimated_cost: 620,
      },
      {
        id: 3,
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

    setDrivers([
      {
        id: 101,
        name: "Carlos Rodriguez",
        status: "available",
        phone: "(555) 123-4567",
      },
      {
        id: 102,
        name: "Sarah Williams",
        status: "available",
        phone: "(555) 234-5678",
      },
      {
        id: 103,
        name: "James Murphy",
        status: "available",
        phone: "(555) 345-6789",
      },
    ]);

    setVehicles([
      {
        id: 201,
        plate_number: "NY-5847",
        model: "Volvo FH16",
        capacity_tons: 15,
        status: "available",
      },
      {
        id: 202,
        plate_number: "NJ-3421",
        model: "Scania R440",
        capacity_tons: 12,
        status: "available",
      },
      {
        id: 203,
        plate_number: "PA-9012",
        model: "DAF XF105",
        capacity_tons: 10,
        status: "available",
      },
    ]);
  }, []);

  const handleAssign = (tripId: number, driverId: number, vehicleId: number) => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setTrips((prev) =>
        prev.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                status: "assigned",
                assigned_driver: drivers.find((d) => d.id === driverId)?.name,
                assigned_vehicle: vehicles.find((v) => v.id === vehicleId)?.plate_number,
              }
            : trip
        )
      );

      setDrivers((prev) =>
        prev.map((driver) =>
          driver.id === driverId ? { ...driver, status: "on_trip" } : driver
        )
      );

      setVehicles((prev) =>
        prev.map((vehicle) =>
          vehicle.id === vehicleId ? { ...vehicle, status: "in_use" } : vehicle
        )
      );

      setLoading(false);
    }, 500);
  };

  const assignedTrips = trips.filter((t) => t.status === "assigned");

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
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
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Recently Assigned Trips</h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {assignedTrips.map((trip) => (
                <div key={trip.id} className="card" style={{ padding: "1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1A1A1A" }}>Trip #{trip.id}</strong>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                        {trip.pickup_location} → {trip.dropoff_location}
                      </p>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                         {trip.assigned_vehicle} |  {trip.assigned_driver}
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
                      {trip.status}
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
