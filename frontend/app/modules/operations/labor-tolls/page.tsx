"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useState } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";

type LaborTollRecord = {
  id: number;
  trip_id: number;
  type: "labor" | "toll";
  description: string;
  amount: number;
  date_recorded: string;
  details?: string;
};

export default function LaborTollsPage() {
  useRoleGuard(["driver", "dispatcher", "manager", "admin"]);

  const [records, setRecords] = useState<LaborTollRecord[]>([
    {
      id: 1,
      trip_id: 101,
      type: "labor",
      description: "Driver: Carlos Rodriguez - 8 hours @ $25/hr",
      amount: 200,
      date_recorded: "2026-04-28",
      details: "8 hours standard rate",
    },
    {
      id: 2,
      trip_id: 101,
      type: "toll",
      description: "NJ Turnpike - Newark to Philadelphia",
      amount: 15.5,
      date_recorded: "2026-04-28",
      details: "Class 3 Vehicle",
    },
    {
      id: 3,
      trip_id: 102,
      type: "labor",
      description: "Driver: Sarah Williams - 10 hours @ $25/hr (2 OT)",
      amount: 250,
      date_recorded: "2026-04-28",
      details: "8 hrs @ $25/hr + 2 hrs OT @ $37.5/hr",
    },
  ]);

  const [showLaborForm, setShowLaborForm] = useState(false);
  const [showTollForm, setShowTollForm] = useState(false);
  const [tripId, setTripId] = useState("");
  const [hours, setHours] = useState("");
  const [hourlyRate, setHourlyRate] = useState("25");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [tollAmount, setTollAmount] = useState("");
  const [tollDescription, setTollDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const overtimeRate = (parseFloat(hourlyRate) * 1.5).toFixed(2);
  const laborTotal = hours && hourlyRate && overtimeHours ? (parseFloat(hours) * parseFloat(hourlyRate) + parseFloat(overtimeHours) * parseFloat(overtimeRate)).toFixed(2) : "0.00";

  const validateLaborForm = () => {
    const newErrors: Record<string, string> = {};
    if (!tripId || isNaN(parseInt(tripId))) newErrors.trip_id = "Valid trip ID required";
    if (!hours || parseFloat(hours) < 0) newErrors.hours = "Hours must be 0 or greater";
    if (!hourlyRate || parseFloat(hourlyRate) <= 0) newErrors.rate = "Hourly rate must be greater than 0";
    if (parseFloat(overtimeHours) < 0) newErrors.ot = "Overtime hours cannot be negative";
    return newErrors;
  };

  const validateTollForm = () => {
    const newErrors: Record<string, string> = {};
    if (!tripId || isNaN(parseInt(tripId))) newErrors.trip_id = "Valid trip ID required";
    if (!tollAmount || parseFloat(tollAmount) <= 0) newErrors.amount = "Amount must be greater than 0";
    if (!tollDescription || tollDescription.trim().length < 3) newErrors.desc = "Toll description required";
    return newErrors;
  };

  const handleAddLabor = () => {
    const newErrors = validateLaborForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: LaborTollRecord = {
      id: records.length + 1,
      trip_id: parseInt(tripId),
      type: "labor",
      description: `${hours}h @ $${hourlyRate}/h${overtimeHours !== "0" ? ` + ${overtimeHours}h OT` : ""}`,
      amount: parseFloat(laborTotal),
      date_recorded: new Date().toISOString().split("T")[0],
      details: `${hours}h @ $${hourlyRate}/h${overtimeHours !== "0" ? ` + ${overtimeHours}h @ $${overtimeRate}/h` : ""}`,
    };

    setRecords([...records, newRecord]);
    setMessage("✓ Labor record added");
    setShowLaborForm(false);
    setTripId("");
    setHours("");
    setHourlyRate("25");
    setOvertimeHours("0");
    setErrors({});

    setTimeout(() => setMessage(""), 3000);
  };

  const handleAddToll = () => {
    const newErrors = validateTollForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: LaborTollRecord = {
      id: records.length + 1,
      trip_id: parseInt(tripId),
      type: "toll",
      description: tollDescription,
      amount: parseFloat(tollAmount),
      date_recorded: new Date().toISOString().split("T")[0],
    };

    setRecords([...records, newRecord]);
    setMessage("✓ Toll record added");
    setShowTollForm(false);
    setTripId("");
    setTollAmount("");
    setTollDescription("");
    setErrors({});

    setTimeout(() => setMessage(""), 3000);
  };

  const laborRecords = records.filter((r) => r.type === "labor");
  const tollRecords = records.filter((r) => r.type === "toll");
  const totalLabor = laborRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalToll = tollRecords.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/driver" },
        { label: "Trip Processing" },
        { label: "Labor & Toll Records" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Labor & Toll Records</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Track driver wages and toll expenses. Combined with fuel costs to compute total trip cost.
        </p>

        {message && (
          <div className="card" style={{ background: "rgba(76, 175, 80, 0.1)", border: "1px solid #4CAF50", color: "#4CAF50", marginBottom: "1rem", padding: "0.75rem" }}>
            {message}
          </div>
        )}

        {/* Labor Records */}
        <div style={{ marginBottom: "3rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ color: "#1A1A1A", margin: 0 }}> Labor Records</h2>
            <button
              onClick={() => setShowLaborForm(!showLaborForm)}
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
              {showLaborForm ? "Cancel" : "+ Add Labor"}
            </button>
          </div>

          {showLaborForm && (
            <div className="card" style={{ marginBottom: "1rem", padding: "1.5rem", background: "rgba(255, 152, 0, 0.05)", border: "1px solid #FFE0B2" }}>
              <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Record Labor Expense</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>Trip ID *</label>
                  <input
                    type="number"
                    value={tripId}
                    onChange={(e) => setTripId(e.target.value)}
                    placeholder="e.g., 101"
                    style={{ width: "100%", padding: "0.75rem", border: errors.trip_id ? "2px solid #F44336" : "1px solid #E8E8E8", borderRadius: "6px", boxSizing: "border-box" }}
                  />
                  {errors.trip_id && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.trip_id}</p>}
                </div>

                <div>
                  <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>Hours Worked *</label>
                  <input
                    type="number"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="e.g., 8"
                    step="0.5"
                    style={{ width: "100%", padding: "0.75rem", border: errors.hours ? "2px solid #F44336" : "1px solid #E8E8E8", borderRadius: "6px", boxSizing: "border-box" }}
                  />
                  {errors.hours && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.hours}</p>}
                </div>

                <div>
                  <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>Hourly Rate ($) *</label>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="e.g., 25"
                    step="0.5"
                    style={{ width: "100%", padding: "0.75rem", border: errors.rate ? "2px solid #F44336" : "1px solid #E8E8E8", borderRadius: "6px", boxSizing: "border-box" }}
                  />
                  {errors.rate && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.rate}</p>}
                </div>

                <div>
                  <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>Overtime Hours</label>
                  <input
                    type="number"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(e.target.value)}
                    placeholder="e.g., 2"
                    step="0.5"
                    style={{ width: "100%", padding: "0.75rem", border: errors.ot ? "2px solid #F44336" : "1px solid #E8E8E8", borderRadius: "6px", boxSizing: "border-box" }}
                  />
                  {errors.ot && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.ot}</p>}
                </div>
              </div>

              <div className="card" style={{ background: "rgba(255, 152, 0, 0.08)", border: "1px solid #FFE0B2", marginBottom: "1rem", padding: "1rem" }}>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                  {hours && hourlyRate && `${hours}h @ $${hourlyRate}/h = $${(parseFloat(hours) * parseFloat(hourlyRate)).toFixed(2)}`}
                </p>
                {overtimeHours !== "0" && parseFloat(overtimeHours) > 0 && (
                  <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                    {overtimeHours}h OT @ ${overtimeRate}/h = ${(parseFloat(overtimeHours) * parseFloat(overtimeRate)).toFixed(2)}
                  </p>
                )}
                <p style={{ color: "#FF9800", fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                  Total: ${laborTotal}
                </p>
              </div>

              <button
                onClick={handleAddLabor}
                style={{ width: "100%", padding: "0.75rem", background: "#FF9800", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
              >
                Save Labor Record
              </button>
            </div>
          )}

          {laborRecords.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem", color: "#666666" }}>
              No labor records yet
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {laborRecords.map((record) => (
                <div key={record.id} className="card" style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <p style={{ margin: "0 0 0.5rem 0", color: "#1A1A1A", fontWeight: 600 }}>Trip #{record.trip_id}</p>
                      <p style={{ margin: "0 0 0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>{record.description}</p>
                      <p style={{ margin: 0, color: "#999", fontSize: "0.85rem" }}>{record.details}</p>
                    </div>
                    <span style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.1rem" }}>${record.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toll Records */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ color: "#1A1A1A", margin: 0 }}> Toll Records</h2>
            <button
              onClick={() => setShowTollForm(!showTollForm)}
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
              {showTollForm ? "Cancel" : "+ Add Toll"}
            </button>
          </div>

          {showTollForm && (
            <div className="card" style={{ marginBottom: "1rem", padding: "1.5rem", background: "rgba(255, 152, 0, 0.05)", border: "1px solid #FFE0B2" }}>
              <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Record Toll Expense</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>Trip ID *</label>
                  <input
                    type="number"
                    value={tripId}
                    onChange={(e) => setTripId(e.target.value)}
                    placeholder="e.g., 101"
                    style={{ width: "100%", padding: "0.75rem", border: errors.trip_id ? "2px solid #F44336" : "1px solid #E8E8E8", borderRadius: "6px", boxSizing: "border-box" }}
                  />
                  {errors.trip_id && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.trip_id}</p>}
                </div>

                <div>
                  <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>Amount ($) *</label>
                  <input
                    type="number"
                    value={tollAmount}
                    onChange={(e) => setTollAmount(e.target.value)}
                    placeholder="e.g., 15.50"
                    step="0.01"
                    style={{ width: "100%", padding: "0.75rem", border: errors.amount ? "2px solid #F44336" : "1px solid #E8E8E8", borderRadius: "6px", boxSizing: "border-box" }}
                  />
                  {errors.amount && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.amount}</p>}
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>Toll Description *</label>
                <input
                  type="text"
                  value={tollDescription}
                  onChange={(e) => setTollDescription(e.target.value)}
                  placeholder="e.g., NJ Turnpike - Newark to Philadelphia"
                  style={{ width: "100%", padding: "0.75rem", border: errors.desc ? "2px solid #F44336" : "1px solid #E8E8E8", borderRadius: "6px", boxSizing: "border-box" }}
                />
                {errors.desc && <p style={{ color: "#F44336", fontSize: "0.85rem", marginTop: "0.25rem" }}>{errors.desc}</p>}
              </div>

              <button
                onClick={handleAddToll}
                style={{ width: "100%", padding: "0.75rem", background: "#FF9800", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
              >
                Save Toll Record
              </button>
            </div>
          )}

          {tollRecords.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem", color: "#666666" }}>
              No toll records yet
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "2rem" }}>
              {tollRecords.map((record) => (
                <div key={record.id} className="card" style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <p style={{ margin: "0 0 0.5rem 0", color: "#1A1A1A", fontWeight: 600 }}>Trip #{record.trip_id}</p>
                      <p style={{ margin: 0, color: "#666666", fontSize: "0.9rem" }}>{record.description}</p>
                    </div>
                    <span style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.1rem" }}>${record.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {(laborRecords.length > 0 || tollRecords.length > 0) && (
          <div className="card" style={{ background: "rgba(255, 152, 0, 0.08)", border: "1px solid #FFE0B2", padding: "1.5rem" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: 0 }}>Total Labor Cost</p>
                <p style={{ color: "#FF9800", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                  ${totalLabor.toFixed(2)}
                </p>
              </div>
              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: 0 }}>Total Toll Cost</p>
                <p style={{ color: "#FF9800", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                  ${totalToll.toFixed(2)}
                </p>
              </div>
              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: 0 }}>Combined Total</p>
                <p style={{ color: "#FF9800", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                  ${(totalLabor + totalToll).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
