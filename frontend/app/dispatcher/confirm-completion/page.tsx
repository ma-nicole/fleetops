"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type PendingTrip = {
  tripId: string;
  driverName: string;
  vehiclePlate: string;
  pickupLocation: string;
  deliveryLocation: string;
  startTime: string;
  endTime: string;
  distance: string;
  status: "arrived" | "delivered" | "pending_confirmation";
};

export default function ConfirmCompletionPage() {
  useRoleGuard(["dispatcher"]);

  const [trips] = useState<PendingTrip[]>([
    {
      tripId: "TRIP-001",
      driverName: "Carlos Rodriguez",
      vehiclePlate: "AUV-2024-1440",
      pickupLocation: "Manila Warehouse",
      deliveryLocation: "Makati Branch",
      startTime: "09:30 AM",
      endTime: "11:45 AM",
      distance: "35 km",
      status: "arrived",
    },
    {
      tripId: "TRIP-004",
      driverName: "Miguel Reyes",
      vehiclePlate: "AUV-2024-1444",
      pickupLocation: "Las Piñas Warehouse",
      deliveryLocation: "Santa Rosa Distribution",
      startTime: "06:00 AM",
      endTime: "08:30 AM",
      distance: "42 km",
      status: "delivered",
    },
  ]);

  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState({
    receiptSignature: "",
    damageReport: "",
    notes: "",
    photosUploaded: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string | boolean) => {
    setConfirmData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConfirm = () => {
    if (!selectedTrip) {
      alert("Please select a trip to confirm");
      return;
    }

    if (!confirmData.receiptSignature) {
      alert("Please confirm receipt signature");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setConfirmed(selectedTrip);
      setSelectedTrip(null);
      setConfirmData({
        receiptSignature: "",
        damageReport: "",
        notes: "",
        photosUploaded: false,
      });
    }, 1500);
  };

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Confirm Trip Completion</h1>
        <p style={{ color: "#666666", margin: "0" }}>Verify and confirm completed deliveries</p>
      </div>

      {confirmed && (
        <div style={{ padding: "1.5rem", background: "rgba(76, 175, 80, 0.15)", border: "2px solid #4CAF50", borderRadius: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ fontSize: "2rem" }}>✅</div>
            <div>
              <p style={{ color: "#4CAF50", fontWeight: "600", margin: "0" }}>Trip Confirmed!</p>
              <p style={{ color: "#666666", margin: "0.5rem 0 0 0", fontSize: "0.9rem" }}>
                {confirmed} has been marked as completed and archived
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Trips List */}
        <div>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Pending Confirmations</h2>
          <div style={{ display: "grid", gap: "1rem" }}>
            {trips.map((trip) => (
              <div
                key={trip.tripId}
                onClick={() => setSelectedTrip(trip.tripId)}
                style={{
                  padding: "1rem",
                  border: selectedTrip === trip.tripId ? "2px solid #FF9800" : "1px solid #E8E8E8",
                  borderRadius: "8px",
                  background: selectedTrip === trip.tripId ? "#FFF5E6" : "#F9F9F9",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                  <h3 style={{ color: "#1A1A1A", margin: "0" }}>{trip.tripId}</h3>
                  <span
                    style={{
                      padding: "0.3rem 0.6rem",
                      background: trip.status === "arrived" ? "#FF9800" : "#4CAF50",
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      fontWeight: "600",
                    }}
                  >
                    {trip.status === "arrived" ? "📍 ARRIVED" : "✓ DELIVERED"}
                  </span>
                </div>

                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0" }}>
                  {trip.driverName} • {trip.vehiclePlate}
                </p>
                <p style={{ color: "#666", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  {trip.pickupLocation} → {trip.deliveryLocation}
                </p>
                <p style={{ color: "#999", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                  {trip.startTime} • {trip.distance}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Confirmation Form */}
        {selectedTrip && (
          <div
            style={{
              padding: "1.5rem",
              border: "2px solid #FF9800",
              borderRadius: "8px",
              background: "#FFF5E6",
              display: "grid",
              gap: "1.5rem",
            }}
          >
            <h2 style={{ color: "#1A1A1A", margin: "0", marginBottom: "0.5rem" }}>Completion Confirmation</h2>

            {trips
              .filter((t) => t.tripId === selectedTrip)
              .map((trip) => (
                <div key={trip.tripId}>
                  <div
                    style={{
                      padding: "1rem",
                      background: "white",
                      borderRadius: "6px",
                      marginBottom: "1rem",
                    }}
                  >
                    <h3 style={{ color: "#1A1A1A", margin: "0 0 0.5rem 0" }}>{trip.tripId}</h3>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      <p style={{ color: "#666", fontSize: "0.9rem", margin: "0" }}>
                        <span style={{ fontWeight: "600" }}>Driver:</span> {trip.driverName}
                      </p>
                      <p style={{ color: "#666", fontSize: "0.9rem", margin: "0" }}>
                        <span style={{ fontWeight: "600" }}>Vehicle:</span> {trip.vehiclePlate}
                      </p>
                      <p style={{ color: "#666", fontSize: "0.9rem", margin: "0" }}>
                        <span style={{ fontWeight: "600" }}>Route:</span> {trip.pickupLocation} → {trip.deliveryLocation}
                      </p>
                      <p style={{ color: "#666", fontSize: "0.9rem", margin: "0" }}>
                        <span style={{ fontWeight: "600" }}>Time:</span> {trip.startTime} - {trip.endTime}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "600", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={confirmData.receiptSignature === "confirmed"}
                          onChange={(e) =>
                            handleInputChange("receiptSignature", e.target.checked ? "confirmed" : "")
                          }
                          style={{ cursor: "pointer" }}
                        />
                        ✓ Receipt Signed & Verified
                      </label>
                    </div>

                    <div>
                      <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                        Damage Report
                      </label>
                      <select
                        value={confirmData.damageReport}
                        onChange={(e) => handleInputChange("damageReport", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.6rem",
                          border: "1px solid #E8E8E8",
                          borderRadius: "6px",
                          backgroundColor: "white",
                        }}
                      >
                        <option value="">Select damage status...</option>
                        <option value="none">No Damage</option>
                        <option value="minor">Minor Damage</option>
                        <option value="major">Major Damage</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
                        Additional Notes
                      </label>
                      <textarea
                        value={confirmData.notes}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                        placeholder="Any additional observations..."
                        style={{
                          width: "100%",
                          padding: "0.6rem",
                          border: "1px solid #E8E8E8",
                          borderRadius: "6px",
                          minHeight: "80px",
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "600", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={confirmData.photosUploaded}
                        onChange={(e) => handleInputChange("photosUploaded", e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                      📷 Photos Uploaded
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <button
                        onClick={handleConfirm}
                        disabled={isSubmitting || !confirmData.receiptSignature}
                        style={{
                          padding: "0.75rem",
                          background:
                            isSubmitting || !confirmData.receiptSignature ? "#CCC" : "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor:
                            isSubmitting || !confirmData.receiptSignature
                              ? "not-allowed"
                              : "pointer",
                          fontWeight: "600",
                        }}
                      >
                        {isSubmitting ? "Confirming..." : "✓ Confirm"}
                      </button>
                      <button
                        onClick={() => setSelectedTrip(null)}
                        style={{
                          padding: "0.75rem",
                          background: "#F5F5F5",
                          color: "#1A1A1A",
                          border: "1px solid #E8E8E8",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: "600",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
