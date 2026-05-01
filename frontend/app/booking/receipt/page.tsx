"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

type CompletedBooking = {
  bookingId: number;
  truck: any;
  service: any;
  pickupLocation: string;
  dropoffLocation: string;
  shipmentDate: string;
  cargoWeight: string;
  cargoDescription: string;
  totalCost: number;
  createdAt: string;
  paymentId: number;
  paymentDate: string;
  status: string;
};

export default function ReceiptPage() {
  useRoleGuard(["customer"]);
  const router = useRouter();

  const [booking, setBooking] = useState<CompletedBooking | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const data = window.localStorage.getItem("completedBooking");
      if (data) {
        setBooking(JSON.parse(data));
      }
    }
  }, []);

  const handleDownloadReceipt = () => {
    // Simulate receipt download
    if (booking) {
      const receiptText = `
FLEETOPS - BOOKING RECEIPT
==========================
Booking ID: #${booking.bookingId}
Payment ID: #${booking.paymentId}

SHIPMENT DETAILS
================
From: ${booking.pickupLocation}
To: ${booking.dropoffLocation}
Date: ${booking.shipmentDate}
Cargo: ${booking.cargoDescription}
Weight: ${booking.cargoWeight} tons

TRUCK INFORMATION
================
Type: ${booking.truck.name}
Capacity: ${booking.truck.capacity_tons} tons

SERVICE
======
${booking.service.name}

AMOUNT
======
Total Cost: $${booking.totalCost.toFixed(2)}
Payment Status: PAID
Payment Date: ${new Date(booking.paymentDate).toLocaleString()}

Thank you for using FLEETOPS!
      `;

      const blob = new Blob([receiptText], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${booking.bookingId}.txt`;
      a.click();
    }
  };

  if (!booking) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading receipt...</div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>
      {/* Success Banner */}
      <div style={{ padding: "2rem", background: "rgba(76, 175, 80, 0.15)", border: "2px solid #4CAF50", borderRadius: "8px", marginBottom: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}></div>
        <h1 style={{ color: "#4CAF50", margin: "0 0 0.5rem 0" }}>Payment Successful!</h1>
        <p style={{ color: "#666666", margin: "0" }}>
          Your booking is confirmed and payment has been processed
        </p>
      </div>

      {/* Receipt */}
      <div style={{ padding: "2rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#FAFAFA", marginBottom: "2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem", borderBottom: "2px solid #E8E8E8", paddingBottom: "1rem" }}>
          <h2 style={{ color: "#1A1A1A", margin: "0" }}>FLEETOPS</h2>
          <p style={{ color: "#999", margin: "0.25rem 0 0 0" }}>Booking Confirmation</p>
        </div>

        {/* Booking Info */}
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem", fontSize: "0.95rem" }}>BOOKING INFORMATION</h3>
          <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666666" }}>Booking ID:</span>
              <span style={{ fontWeight: 600, color: "#1A1A1A" }}>#{booking.bookingId}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666666" }}>Payment ID:</span>
              <span style={{ fontWeight: 600, color: "#1A1A1A" }}>#{booking.paymentId}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666666" }}>Status:</span>
              <span style={{ fontWeight: 600, color: "#4CAF50" }}>PAID</span>
            </div>
          </div>
        </div>

        {/* Shipment Details */}
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem", fontSize: "0.95rem" }}>SHIPMENT DETAILS</h3>
          <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.9rem" }}>
            <div>
              <span style={{ color: "#999", fontSize: "0.85rem" }}>PICKUP</span>
              <div style={{ color: "#1A1A1A", fontWeight: 600 }}>{booking.pickupLocation}</div>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "0.85rem" }}>DROPOFF</span>
              <div style={{ color: "#1A1A1A", fontWeight: 600 }}>{booking.dropoffLocation}</div>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "0.85rem" }}>SHIPMENT DATE</span>
              <div style={{ color: "#1A1A1A", fontWeight: 600 }}>{booking.shipmentDate}</div>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "0.85rem" }}>CARGO</span>
              <div style={{ color: "#1A1A1A", fontWeight: 600 }}>{booking.cargoDescription}</div>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "0.85rem" }}>WEIGHT</span>
              <div style={{ color: "#1A1A1A", fontWeight: 600 }}>{booking.cargoWeight} tons</div>
            </div>
          </div>
        </div>

        {/* Truck Info */}
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem", fontSize: "0.95rem" }}>ASSIGNED TRUCK</h3>
          <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666666" }}>Truck Type:</span>
              <span style={{ fontWeight: 600, color: "#1A1A1A" }}>{booking.truck.name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666666" }}>Capacity:</span>
              <span style={{ fontWeight: 600, color: "#1A1A1A" }}>{booking.truck.capacity_tons} tons</span>
            </div>
          </div>
        </div>

        {/* Service */}
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem", fontSize: "0.95rem" }}>SERVICE</h3>
          <div style={{ color: "#1A1A1A", fontWeight: 600, fontSize: "0.9rem" }}>
            {booking.service.name}
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: "1.5rem", borderTop: "2px solid #E8E8E8", borderBottom: "2px solid #E8E8E8", padding: "1rem 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#1A1A1A", fontWeight: 600 }}>TOTAL AMOUNT</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#FF9800" }}>
              ${booking.totalCost.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment Info */}
        <div style={{ fontSize: "0.85rem", color: "#999", textAlign: "center" }}>
          <p style={{ margin: "0 0 0.5rem 0" }}>Payment Date: {new Date(booking.paymentDate).toLocaleString()}</p>
          <p style={{ margin: "0" }}>Invoice #{booking.paymentId}</p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
        <button
          onClick={handleDownloadReceipt}
          style={{
            padding: "0.75rem",
            background: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
           Download Receipt
        </button>
        <Link
          href="/booking/status"
          style={{
            padding: "0.75rem",
            background: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            textDecoration: "none",
            textAlign: "center",
            display: "block",
          }}
        >
          Track Booking →
        </Link>
      </div>

      <div style={{ padding: "1rem", background: "#E3F2FD", borderRadius: "6px", marginBottom: "1rem" }}>
        <p style={{ color: "#1565C0", margin: "0", fontSize: "0.9rem" }}>
           A confirmation email has been sent to your email address with all booking details.
        </p>
      </div>

      <Link
        href="/dashboard"
        style={{
          display: "block",
          textAlign: "center",
          color: "#FF9800",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
