"use client";

import { useCallback, useEffect, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { adminApi, type AdminTruck } from "@/lib/adminApi";

const TRUCK_STATUSES = ["available", "maintenance"] as const;

export default function VehiclesPage() {
  useRoleGuard(["admin"]);

  const [trucks, setTrucks] = useState<AdminTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [plateNumber, setPlateNumber] = useState("");
  const [modelName, setModelName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState<string>("available");
  const [ageYears, setAgeYears] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listTrucks();
      setTrucks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!plateNumber || plateNumber.trim().length < 2) newErrors.plate = "Plate number is required";
    if (!modelName || modelName.trim().length < 1) newErrors.model = "Model name is required";
    const cap = parseFloat(capacity);
    if (!capacity || Number.isNaN(cap) || cap <= 0) newErrors.capacity = "Capacity must be greater than 0";
    const age = parseFloat(ageYears);
    if (ageYears === "" || Number.isNaN(age) || age < 0) newErrors.age = "Enter a valid age (years)";
    return newErrors;
  };

  const handleAdd = async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await adminApi.createTruck({
        model_name: modelName.trim(),
        plate_number: plateNumber.trim(),
        capacity_tons: parseFloat(capacity),
        status: status.trim().toLowerCase(),
        age_years: parseFloat(ageYears),
      });
      setShowForm(false);
      setPlateNumber("");
      setModelName("");
      setCapacity("");
      setAgeYears("");
      setStatus("available");
      setErrors({});
      await refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save vehicle");
    } finally {
      setSaving(false);
    }
  };

  const displayStatus = (t: AdminTruck) => (t.status || "available").replace(/_/g, " ");

  const availableCount = trucks.filter((v) => (v.status || "").toLowerCase() === "available").length;
  const maintenanceCount = trucks.filter((v) => (v.status || "").toLowerCase() === "maintenance").length;
  const otherCount = trucks.length - availableCount - maintenanceCount;

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)", paddingBottom: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System" },
          { label: "Vehicle Management" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Vehicle Management</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Register fleet trucks (plate, model, capacity, status, age). New entries are stored in the{" "}
          <code style={{ fontSize: "0.9em" }}>trucks</code> table.
        </p>

        {error && (
          <p role="alert" style={{ color: "#c62828", marginBottom: "1rem" }}>
            {error}{" "}
            <button type="button" onClick={() => refresh()} style={{ fontWeight: 600, cursor: "pointer" }}>
              Retry
            </button>
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {loading ? "…" : availableCount}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Available</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {loading ? "…" : maintenanceCount}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Maintenance</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#607D8B" }}>
              {loading ? "…" : otherCount}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Other status</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {loading ? "…" : trucks.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm);
            setSaveError(null);
          }}
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
          {showForm ? "Cancel" : "+ Add vehicle"}
        </button>

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
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Add vehicle</h3>
            {saveError && (
              <p role="alert" style={{ color: "#c62828", marginTop: 0 }}>
                {saveError}
              </p>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "1rem",
              }}
            >
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Plate number *</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="e.g. ABC-1234"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.plate ? "2px solid #F44336" : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.plate && (
                  <p style={{ color: "#F44336", fontSize: "0.85rem" }}>{errors.plate}</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Model name *</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. Hino 500"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.model ? "2px solid #F44336" : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.model && (
                  <p style={{ color: "#F44336", fontSize: "0.85rem" }}>{errors.model}</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Max capacity (tons) *
                </label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g. 42"
                  min={0.1}
                  step={0.5}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.capacity ? "2px solid #F44336" : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.capacity && (
                  <p style={{ color: "#F44336", fontSize: "0.85rem" }}>{errors.capacity}</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Status *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                >
                  {TRUCK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Age (years) *</label>
                <input
                  type="number"
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                  placeholder="e.g. 3"
                  min={0}
                  step={0.5}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.age ? "2px solid #F44336" : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.age && <p style={{ color: "#F44336", fontSize: "0.85rem" }}>{errors.age}</p>}
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleAdd()}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem",
                background: saving ? "#ccc" : "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {saving ? "Saving…" : "Save vehicle"}
            </button>
          </div>
        )}

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {loading && <p style={{ color: "#666" }}>Loading vehicles…</p>}
          {!loading && trucks.length === 0 && <p style={{ color: "#666" }}>No vehicles yet. Use Add vehicle above.</p>}
          {!loading &&
            trucks.map((vehicle) => (
              <div key={vehicle.id} className="card" style={{ padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "1rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "#1A1A1A" }}>
                      {vehicle.code}
                      {vehicle.model_name ? ` • ${vehicle.model_name}` : ""}
                    </p>
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                      Capacity <strong>{vehicle.capacity_tons} t</strong> • Age{" "}
                      <strong>
                        {vehicle.age_years} yr{vehicle.age_years === 1 ? "" : "s"}
                      </strong>{" "}
                      • Odometer <strong>{Math.round(vehicle.odometer_km).toLocaleString()} km</strong>
                    </p>
                    {vehicle.last_maintenance_date && (
                      <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                        Last maintenance: {vehicle.last_maintenance_date}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      padding: "0.5rem 1rem",
                      background:
                        (vehicle.status || "").toLowerCase() === "maintenance"
                          ? "#FF9800"
                          : (vehicle.status || "").toLowerCase() === "available"
                            ? "#4CAF50"
                            : "#607D8B",
                      color: "white",
                      borderRadius: "6px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      whiteSpace: "nowrap",
                      textTransform: "capitalize",
                    }}
                  >
                    {displayStatus(vehicle)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
