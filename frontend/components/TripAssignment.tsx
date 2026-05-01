"use client";

import { useState, useEffect } from "react";

export type Trip = {
  id: number;
  pickup_location: string;
  dropoff_location: string;
  cargo_weight_tons: number;
  scheduled_date: string;
  scheduled_time: string;
  status: "pending" | "assigned" | "in_transit" | "completed" | "cancelled";
  customer_name?: string;
  estimated_cost?: number;
  assigned_driver?: string;
  assigned_vehicle?: string;
};

export type Driver = {
  id: number;
  name: string;
  status: "available" | "on_trip" | "break" | "off_duty";
  phone?: string;
};

export type Vehicle = {
  id: number;
  plate_number: string;
  model: string;
  capacity_tons: number;
  status: "available" | "in_use" | "maintenance";
};

interface TripAssignmentProps {
  trips: Trip[];
  drivers: Driver[];
  vehicles: Vehicle[];
  onAssign: (tripId: number, driverId: number, vehicleId: number) => void;
  loading?: boolean;
}

export default function TripAssignment({
  trips,
  drivers,
  vehicles,
  onAssign,
  loading = false,
}: TripAssignmentProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [message, setMessage] = useState("");

  const pendingTrips = trips.filter((t) => t.status === "pending");
  const availableDrivers = drivers.filter((d) => d.status === "available");
  const availableVehicles = vehicles.filter((v) => v.status === "available");

  const handleAssign = () => {
    if (!selectedTrip || !selectedDriver || !selectedVehicle) {
      setMessage("Please select a trip, driver, and vehicle");
      return;
    }

    // Check vehicle capacity
    if (selectedVehicle.capacity_tons < selectedTrip.cargo_weight_tons) {
      setMessage(
        `Vehicle capacity (${selectedVehicle.capacity_tons}t) is less than cargo weight (${selectedTrip.cargo_weight_tons}t)`
      );
      return;
    }

    onAssign(selectedTrip.id, selectedDriver.id, selectedVehicle.id);
    setMessage("Assignment completed!");
    setSelectedTrip(null);
    setSelectedDriver(null);
    setSelectedVehicle(null);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "2rem",
        paddingBottom: "2rem",
      }}
    >
      {/* Left Column: Trip & Selection */}
      <div>
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>
          Pending Trips ({pendingTrips.length})
        </h3>

        <div style={{ maxHeight: "400px", overflowY: "auto", marginBottom: "2rem" }}>
          {pendingTrips.length === 0 ? (
            <div className="card" style={{ color: "#666666", textAlign: "center", padding: "2rem" }}>
              No pending trips
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {pendingTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="card"
                  onClick={() => setSelectedTrip(trip)}
                  style={{
                    cursor: "pointer",
                    background:
                      selectedTrip?.id === trip.id ? "rgba(255, 152, 0, 0.15)" : "#FFFFFF",
                    border:
                      selectedTrip?.id === trip.id ? "2px solid #FF9800" : "1px solid #E8E8E8",
                    padding: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <strong style={{ color: "#1A1A1A" }}>Trip #{trip.id}</strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        backgroundColor: "rgba(255, 152, 0, 0.1)",
                        color: "#FF9800",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      {trip.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    {trip.pickup_location} → {trip.dropoff_location}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                     {trip.cargo_weight_tons}t |  {trip.scheduled_date} {trip.scheduled_time}
                  </p>
                  {trip.customer_name && (
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.85rem" }}>
                      Customer: {trip.customer_name}
                    </p>
                  )}
                  {trip.estimated_cost && (
                    <p style={{ margin: "0.25rem 0", color: "#FF9800", fontWeight: 600 }}>
                      Est. Cost: ${trip.estimated_cost}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Assignment Options */}
      <div>
        {selectedTrip ? (
          <>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Assign Trip #{selectedTrip.id}</h3>

            {/* Available Drivers */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>
                Select Driver
              </label>
              {availableDrivers.length === 0 ? (
                <div className="card" style={{ color: "#F44336", padding: "1rem", textAlign: "center" }}>
                  No available drivers
                </div>
              ) : (
                <div style={{ display: "grid", gap: "0.5rem", maxHeight: "150px", overflowY: "auto" }}>
                  {availableDrivers.map((driver) => (
                    <button
                      key={driver.id}
                      onClick={() => setSelectedDriver(driver)}
                      style={{
                        padding: "0.75rem",
                        border: selectedDriver?.id === driver.id ? "2px solid #FF9800" : "1px solid #E8E8E8",
                        borderRadius: "6px",
                        background: selectedDriver?.id === driver.id ? "rgba(255, 152, 0, 0.1)" : "#FFFFFF",
                        color: "#1A1A1A",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{driver.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "#666666" }}>{driver.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Available Vehicles */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>
                Select Vehicle
              </label>
              {availableVehicles.length === 0 ? (
                <div className="card" style={{ color: "#F44336", padding: "1rem", textAlign: "center" }}>
                  No available vehicles
                </div>
              ) : (
                <div style={{ display: "grid", gap: "0.5rem", maxHeight: "150px", overflowY: "auto" }}>
                  {availableVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      onClick={() => setSelectedVehicle(vehicle)}
                      disabled={vehicle.capacity_tons < selectedTrip.cargo_weight_tons}
                      style={{
                        padding: "0.75rem",
                        border:
                          vehicle.capacity_tons < selectedTrip.cargo_weight_tons
                            ? "1px solid #CCC"
                            : selectedVehicle?.id === vehicle.id
                              ? "2px solid #FF9800"
                              : "1px solid #E8E8E8",
                        borderRadius: "6px",
                        background:
                          vehicle.capacity_tons < selectedTrip.cargo_weight_tons
                            ? "#FAFAFA"
                            : selectedVehicle?.id === vehicle.id
                              ? "rgba(255, 152, 0, 0.1)"
                              : "#FFFFFF",
                        color: vehicle.capacity_tons < selectedTrip.cargo_weight_tons ? "#999" : "#1A1A1A",
                        cursor: vehicle.capacity_tons < selectedTrip.cargo_weight_tons ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {vehicle.model} ({vehicle.plate_number})
                      </div>
                      <div style={{ fontSize: "0.85rem", color: vehicle.capacity_tons < selectedTrip.cargo_weight_tons ? "#F44336" : "#666666" }}>
                        {vehicle.capacity_tons}t capacity
                        {vehicle.capacity_tons < selectedTrip.cargo_weight_tons && " - INSUFFICIENT CAPACITY"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assignment Summary */}
            {selectedDriver && selectedVehicle && (
              <div className="card" style={{ background: "rgba(76, 175, 80, 0.1)", border: "1px solid #4CAF50", marginBottom: "1rem" }}>
                <h4 style={{ color: "#1A1A1A", margin: "0 0 0.5rem 0" }}>Assignment Summary</h4>
                <p style={{ color: "#666666", margin: "0.25rem 0", fontSize: "0.9rem" }}>
                  <strong>Trip:</strong> #{selectedTrip.id} - {selectedTrip.pickup_location}
                </p>
                <p style={{ color: "#666666", margin: "0.25rem 0", fontSize: "0.9rem" }}>
                  <strong>Driver:</strong> {selectedDriver.name}
                </p>
                <p style={{ color: "#666666", margin: "0.25rem 0", fontSize: "0.9rem" }}>
                  <strong>Vehicle:</strong> {selectedVehicle.model} ({selectedVehicle.plate_number})
                </p>
              </div>
            )}

            {/* Message */}
            {message && (
              <div
                className="card"
                style={{
                  background: message.includes("Assignment") ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)",
                  border: message.includes("Assignment") ? "1px solid #4CAF50" : "1px solid #F44336",
                  color: message.includes("Assignment") ? "#4CAF50" : "#F44336",
                  marginBottom: "1rem",
                  padding: "0.75rem",
                }}
              >
                {message}
              </div>
            )}

            {/* Assign Button */}
            <button
              onClick={handleAssign}
              disabled={loading || !selectedDriver || !selectedVehicle}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: selectedDriver && selectedVehicle ? "#FF9800" : "#CCC",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                cursor: selectedDriver && selectedVehicle && !loading ? "pointer" : "not-allowed",
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              {loading ? "Assigning..." : "Confirm Assignment"}
            </button>
          </>
        ) : (
          <div className="card" style={{ color: "#666666", textAlign: "center", padding: "2rem" }}>
            Select a pending trip to assign a driver and vehicle
          </div>
        )}
      </div>
    </div>
  );
}
