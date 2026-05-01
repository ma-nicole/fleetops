"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type Vehicle = {
  id: number;
  plate_number: string;
  model: string;
  capacity_tons: number;
  status: "available" | "in_use" | "maintenance";
  year: number;
  driver_assigned?: string;
  maintenance_due?: string;
};

export default function VehiclesPage() {
  useRoleGuard(["admin"]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: 1,
      plate_number: "VOL-2024-001",
      model: "Volvo FH16",
      capacity_tons: 25,
      status: "available",
      year: 2024,
      maintenance_due: "2026-06-15",
    },
    {
      id: 2,
      plate_number: "SCA-2023-002",
      model: "Scania R450",
      capacity_tons: 24,
      status: "in_use",
      year: 2023,
      driver_assigned: "Carlos Rodriguez",
      maintenance_due: "2026-05-20",
    },
    {
      id: 3,
      plate_number: "DAF-2022-003",
      model: "DAF XF",
      capacity_tons: 20,
      status: "maintenance",
      year: 2022,
      maintenance_due: "2026-04-30",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [plateNumber, setPlateNumber] = useState("");
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [year, setYear] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!plateNumber || plateNumber.trim().length < 5)
      newErrors.plate = "Valid plate number required";
    if (!model || model.trim().length < 3) newErrors.model = "Model required";
    if (!capacity || parseFloat(capacity) <= 0)
      newErrors.capacity = "Capacity must be > 0";
    if (!year || parseInt(year) < 1900 || parseInt(year) > 2030)
      newErrors.year = "Valid year required";
    return newErrors;
  };

  const handleAdd = () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newVehicle: Vehicle = {
      id: vehicles.length + 1,
      plate_number: plateNumber,
      model: model,
      capacity_tons: parseFloat(capacity),
      status: "available",
      year: parseInt(year),
      maintenance_due: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    };

    setVehicles([...vehicles, newVehicle]);
    setShowForm(false);
    setPlateNumber("");
    setModel("");
    setCapacity("");
    setYear("");
    setErrors({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "#4CAF50";
      case "in_use":
        return "#2196F3";
      case "maintenance":
        return "#FF9800";
      default:
        return "#999";
    }
  };

  const availableCount = vehicles.filter((v) => v.status === "available").length;
  const inUseCount = vehicles.filter((v) => v.status === "in_use").length;
  const maintenanceCount = vehicles.filter((v) => v.status === "maintenance").length;

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System Administration" },
          { label: "Manage Trucks" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Manage Trucks
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Add, remove, and monitor all vehicles in your fleet. Track maintenance
          schedules and vehicle status.
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
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {availableCount}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Available</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {inUseCount}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>In Use</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}
            >
              {maintenanceCount}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Maintenance</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {vehicles.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Trucks</div>
          </div>
        </div>

        {/* Add Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            marginBottom: "1rem",
          }}
        >
          {showForm ? "Cancel" : "+ Add Truck"}
        </button>

        {/* Add Form */}
        {showForm && (
          <div
            className="card"
            style={{
              marginBottom: "1rem",
              padding: "1.5rem",
              background: "rgba(255, 152, 0, 0.05)",
              border: "1px solid #FFE0B2",
            }}
          >
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>
              Add New Truck
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Plate Number *
                </label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="e.g., VOL-2024-001"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.plate
                      ? "2px solid #F44336"
                      : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.plate && (
                  <p style={{ color: "#F44336", fontSize: "0.85rem" }}>
                    {errors.plate}
                  </p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Model *
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g., Volvo FH16"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.model
                      ? "2px solid #F44336"
                      : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.model && (
                  <p style={{ color: "#F44336", fontSize: "0.85rem" }}>
                    {errors.model}
                  </p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Capacity (Tons) *
                </label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g., 25"
                  step="0.5"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.capacity
                      ? "2px solid #F44336"
                      : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.capacity && (
                  <p style={{ color: "#F44336", fontSize: "0.85rem" }}>
                    {errors.capacity}
                  </p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Year *
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g., 2024"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.year
                      ? "2px solid #F44336"
                      : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.year && (
                  <p style={{ color: "#F44336", fontSize: "0.85rem" }}>
                    {errors.year}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleAdd}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem",
                background: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Add Truck
            </button>
          </div>
        )}

        {/* Vehicle List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="card" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "#1A1A1A" }}>
                    {vehicle.plate_number} • {vehicle.model}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    Capacity: <strong>{vehicle.capacity_tons}T</strong> • Year:{" "}
                    <strong>{vehicle.year}</strong>
                  </p>
                  {vehicle.driver_assigned && (
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                      Driver: <strong>{vehicle.driver_assigned}</strong>
                    </p>
                  )}
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Maintenance Due: {vehicle.maintenance_due}
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.5rem 1rem",
                    background: getStatusColor(vehicle.status),
                    color: "white",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    whiteSpace: "nowrap",
                    marginLeft: "1rem",
                    textTransform: "capitalize",
                  }}
                >
                  {vehicle.status.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
