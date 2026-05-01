"use client";

import Link from "next/link";
import { useState } from "react";

export default function LogReportPage() {
  const [formData, setFormData] = useState({
    reportType: "",
    date: "",
    vehiclePlate: "",
    driverName: "",
    description: "",
    category: "",
    priority: "medium",
    attachments: "",
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
    if (!formData.reportType || !formData.date || !formData.vehiclePlate || !formData.description) {
      alert("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setFormData({
        reportType: "",
        date: "",
        vehiclePlate: "",
        driverName: "",
        description: "",
        category: "",
        priority: "medium",
        attachments: "",
      });
    }, 1500);
  };

  if (submitted) {
    return (
      <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
        <div style={{ padding: "2rem", background: "rgba(76, 175, 80, 0.15)", border: "2px solid #4CAF50", borderRadius: "8px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}></div>
          <h2 style={{ color: "#4CAF50", margin: "0 0 0.5rem 0" }}>Report Submitted!</h2>
          <p style={{ color: "#666666", margin: "0" }}>Your log report has been successfully recorded</p>
        </div>
        <Link
          href="/dispatcher/dashboard"
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
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Log Report</h1>
        <p style={{ color: "#666666", margin: "0" }}>Record maintenance, cost, and route changes</p>
      </div>

      <div style={{ padding: "2rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1.5rem" }}>Report Details</h2>

        <div style={{ display: "grid", gap: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Report Type *
              </label>
              <select
                value={formData.reportType}
                onChange={(e) => handleInputChange("reportType", e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  color: "#1A1A1A",
                }}
              >
                <option value="">Select report type...</option>
                <option value="maintenance">Vehicle Maintenance</option>
                <option value="cost">Cost Report</option>
                <option value="route">Route Change</option>
                <option value="incident">Incident Report</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Report Date *
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
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Vehicle Plate *
              </label>
              <select
                value={formData.vehiclePlate}
                onChange={(e) => handleInputChange("vehiclePlate", e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  color: "#1A1A1A",
                }}
              >
                <option value="">Select vehicle...</option>
                <option value="AUV-2024-1440">AUV-2024-1440</option>
                <option value="AUV-2024-1441">AUV-2024-1441</option>
                <option value="AUV-2024-1442">AUV-2024-1442</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Assigned Driver
              </label>
              <input
                type="text"
                value={formData.driverName}
                onChange={(e) => handleInputChange("driverName", e.target.value)}
                placeholder="Auto-populated based on vehicle"
                disabled
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  backgroundColor: "#EEE",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  color: "#1A1A1A",
                }}
              >
                <option value="">Select category...</option>
                <option value="urgent">Urgent</option>
                <option value="preventive">Preventive Maintenance</option>
                <option value="repair">Repair</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Priority Level
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleInputChange("priority", e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  color: "#1A1A1A",
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Provide detailed description of the report..."
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #E8E8E8",
                borderRadius: "6px",
                fontFamily: "inherit",
                minHeight: "120px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
              Attachments (Optional)
            </label>
            <input
              type="text"
              value={formData.attachments}
              onChange={(e) => handleInputChange("attachments", e.target.value)}
              placeholder="File names or notes about attachments"
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #E8E8E8",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
            />
            <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.5rem 0 0 0" }}>
              You can upload photos or documents separately
            </p>
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
              href="/dispatcher/dashboard"
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
