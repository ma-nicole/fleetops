"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

export default function AccomplishmentReportPage() {
  useRoleGuard(["driver"]);

  const [formData, setFormData] = useState({
    tripId: "",
    date: "",
    startOdometer: "",
    endOdometer: "",
    fuelConsumed: "",
    issues: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    if (!formData.tripId || !formData.date || !formData.startOdometer || !formData.endOdometer) {
      alert("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setFormData({
        tripId: "",
        date: "",
        startOdometer: "",
        endOdometer: "",
        fuelConsumed: "",
        issues: "",
        notes: "",
      });
    }, 1500);
  };

  if (submitted) {
    return (
      <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
        <div style={{ padding: "2rem", background: "rgba(76, 175, 80, 0.15)", border: "2px solid #4CAF50", borderRadius: "8px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}></div>
          <h2 style={{ color: "#4CAF50", margin: "0 0 0.5rem 0" }}>Report Submitted!</h2>
          <p style={{ color: "#666666", margin: "0" }}>Your accomplishment report has been recorded</p>
        </div>
        <Link
          href="/driver/dashboard"
          style={{
            padding: "0.75rem",
            background: "#FF9800",
            color: "white",
            textDecoration: "none",
            borderRadius: "6px",
            textAlign: "center",
            fontWeight: "600",
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem", maxWidth: "900px" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Submit Accomplishment Report</h1>
        <p style={{ color: "#666666", margin: "0" }}>Document your trip details and daily accomplishments</p>
      </div>

      <div style={{ padding: "2rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1.5rem" }}>Trip Details</h2>

        <div style={{ display: "grid", gap: "1.5rem" }}>
          <div>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
              Trip ID *
            </label>
            <select
              value={formData.tripId}
              onChange={(e) => handleInputChange("tripId", e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #E8E8E8",
                borderRadius: "6px",
                backgroundColor: "white",
                color: "#1A1A1A",
              }}
            >
              <option value="">Select a trip...</option>
              <option value="TRIP-001">TRIP-001</option>
              <option value="TRIP-002">TRIP-002</option>
              <option value="TRIP-003">TRIP-003</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Trip Status *
              </label>
              <select
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  color: "#1A1A1A",
                }}
              >
                <option value="">Select status...</option>
                <option value="completed">Completed</option>
                <option value="partial">Partial</option>
                <option value="delayed">Delayed</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Starting Odometer (km) *
              </label>
              <input
                type="number"
                value={formData.startOdometer}
                onChange={(e) => handleInputChange("startOdometer", e.target.value)}
                placeholder="e.g., 158420"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Ending Odometer (km) *
              </label>
              <input
                type="number"
                value={formData.endOdometer}
                onChange={(e) => handleInputChange("endOdometer", e.target.value)}
                placeholder="e.g., 158448"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
              Fuel Consumed (liters)
            </label>
            <input
              type="number"
              value={formData.fuelConsumed}
              onChange={(e) => handleInputChange("fuelConsumed", e.target.value)}
              placeholder="e.g., 12.5"
              step="0.1"
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #E8E8E8",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
              Issues Encountered
            </label>
            <textarea
              value={formData.issues}
              onChange={(e) => handleInputChange("issues", e.target.value)}
              placeholder="e.g., Traffic delay, mechanical issues, etc."
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #E8E8E8",
                borderRadius: "6px",
                fontFamily: "inherit",
                minHeight: "80px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Any other observations or accomplishments..."
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #E8E8E8",
                borderRadius: "6px",
                fontFamily: "inherit",
                minHeight: "80px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                padding: "0.75rem",
                background: isSubmitting ? "#CCC" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontWeight: "600",
              }}
            >
              {isSubmitting ? "Submitting..." : "✓ Submit Report"}
            </button>
            <Link
              href="/driver/dashboard"
              style={{
                padding: "0.75rem",
                background: "#F5F5F5",
                color: "#1A1A1A",
                border: "1px solid #E8E8E8",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
