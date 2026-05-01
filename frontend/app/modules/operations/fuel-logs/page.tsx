"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useState, useEffect } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { formatPhp } from "@/lib/appLocale";

type FuelLog = {
  id: number;
  trip_id: number;
  gallons: number;
  price_per_gallon: number;
  total_cost: number;
  date_recorded: string;
  vendor: string;
};

export default function FuelLogsPage() {
  useRoleGuard(["driver", "dispatcher", "manager", "admin"]);

  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([
    {
      id: 1,
      trip_id: 101,
      gallons: 45,
      price_per_gallon: 72.5,
      total_cost: 3262.5,
      date_recorded: "2026-04-28",
      vendor: "Shell Station - Makati",
    },
    {
      id: 2,
      trip_id: 102,
      gallons: 65,
      price_per_gallon: 71.5,
      total_cost: 4647.5,
      date_recorded: "2026-04-28",
      vendor: "Petron - Quezon City",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [tripId, setTripId] = useState("");
  const [gallons, setGallons] = useState("");
  const [pricePerGallon, setPricePerGallon] = useState("72.5");
  const [vendor, setVendor] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const totalCost = gallons && pricePerGallon ? (parseFloat(gallons) * parseFloat(pricePerGallon)).toFixed(2) : "0.00";

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!tripId || isNaN(parseInt(tripId))) newErrors.trip_id = "Valid trip ID required";
    if (!gallons || parseFloat(gallons) <= 0) newErrors.gallons = "Volume must be greater than 0";
    if (!pricePerGallon || parseFloat(pricePerGallon) <= 0) newErrors.price = "Price must be greater than 0";
    if (!vendor || vendor.trim().length < 3) newErrors.vendor = "Vendor name required";
    return newErrors;
  };

  const handleAddLog = () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newLog: FuelLog = {
      id: fuelLogs.length + 1,
      trip_id: parseInt(tripId),
      gallons: parseFloat(gallons),
      price_per_gallon: parseFloat(pricePerGallon),
      total_cost: parseFloat(totalCost),
      date_recorded: new Date().toISOString().split("T")[0],
      vendor,
    };

    setFuelLogs([...fuelLogs, newLog]);
    setMessage("✓ Fuel log added successfully");
    setShowForm(false);
    setTripId("");
    setGallons("");
    setPricePerGallon("72.5");
    setVendor("");
    setErrors({});

    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/driver" },
        { label: "Trip Processing" },
        { label: "Fuel Logs" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Fuel Logs</h1>
            <p style={{ color: "#666666" }}>Track fuel expenses per trip. Essential for cost computation.</p>
          </div>
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
            }}
          >
            {showForm ? "Cancel" : "+ Add Fuel Log"}
          </button>
        </div>

        {message && (
          <div className="card" style={{ background: "rgba(76, 175, 80, 0.1)", border: "1px solid #4CAF50", color: "#4CAF50", marginBottom: "1rem", padding: "0.75rem" }}>
            {message}
          </div>
        )}

        {/* Add Fuel Log Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: "2rem", padding: "1.5rem", background: "rgba(255, 152, 0, 0.05)", border: "1px solid #FFE0B2" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Record Fuel Consumption</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Trip ID *
                </label>
                <input
                  type="number"
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  placeholder="e.g., 101"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.trip_id ? "2px solid #F44336" : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.trip_id && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.trip_id}</p>}
              </div>

              <div>
                <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Volume (L) *
                </label>
                <input
                  type="number"
                  value={gallons}
                  onChange={(e) => setGallons(e.target.value)}
                  placeholder="e.g., 50"
                  step="0.1"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.gallons ? "2px solid #F44336" : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.gallons && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.gallons}</p>}
              </div>

              <div>
                <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Price per liter (PHP/L) *
                </label>
                <input
                  type="number"
                  value={pricePerGallon}
                  onChange={(e) => setPricePerGallon(e.target.value)}
                  placeholder="e.g., 72.50"
                  step="0.01"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.price ? "2px solid #F44336" : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.price && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.price}</p>}
              </div>

              <div>
                <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Total Cost
                </label>
                <input
                  type="text"
                  value={gallons && pricePerGallon ? formatPhp(parseFloat(totalCost)) : formatPhp(0)}
                  disabled
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8E8E8",
                    borderRadius: "6px",
                    background: "#FAFAFA",
                    color: "#1A1A1A",
                    fontWeight: 600,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>
                Vendor/Station *
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g., Shell Station - Makati"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: errors.vendor ? "2px solid #F44336" : "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
              {errors.vendor && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.vendor}</p>}
            </div>

            <button
              onClick={handleAddLog}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              Save Fuel Log
            </button>
          </div>
        )}

        {/* Fuel Logs Table */}
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Recorded Fuel Logs ({fuelLogs.length})</h3>
        {fuelLogs.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2rem", color: "#666666" }}>
            No fuel logs recorded yet
          </div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8" }}>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>Trip ID</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>Volume (L)</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>PHP/L</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>Total Cost</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>Vendor</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {fuelLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                    <td style={{ padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>#{log.trip_id}</td>
                    <td style={{ padding: "1rem", color: "#666666" }}>{log.gallons} L</td>
                    <td style={{ padding: "1rem", color: "#666666" }}>{formatPhp(log.price_per_gallon)}</td>
                    <td style={{ padding: "1rem", color: "#FF9800", fontWeight: 600 }}>{formatPhp(log.total_cost)}</td>
                    <td style={{ padding: "1rem", color: "#666666" }}>{log.vendor}</td>
                    <td style={{ padding: "1rem", color: "#666666" }}>{log.date_recorded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {fuelLogs.length > 0 && (
          <div className="card" style={{ marginTop: "2rem", background: "rgba(255, 152, 0, 0.08)", border: "1px solid #FFE0B2" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: 0 }}>Total Volume (L)</p>
                <p style={{ color: "#FF9800", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                  {fuelLogs.reduce((sum, log) => sum + log.gallons, 0).toFixed(1)}
                </p>
              </div>
              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: 0 }}>Total Fuel Cost</p>
                <p style={{ color: "#FF9800", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                  {formatPhp(fuelLogs.reduce((sum, log) => sum + log.total_cost, 0))}
                </p>
              </div>
              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: 0 }}>Avg PHP/L</p>
                <p style={{ color: "#FF9800", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                  {formatPhp(
                    fuelLogs.reduce((sum, log) => sum + log.total_cost, 0) /
                      fuelLogs.reduce((sum, log) => sum + log.gallons, 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
