"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type OrderDetail = {
  id: string;
  bookingId: string;
  customer: string;
  items: string[];
  weight: string;
  dimensions: string;
  pickupDate: string;
  deliveryDate: string;
  deliveryAddress: string;
  totalAmount: string;
  status: string;
};

export default function OrderDetailsPage() {
  useRoleGuard(["manager", "admin"]);

  const [order] = useState<OrderDetail>({
    id: "ORD-2024-001",
    bookingId: "BK-2024-0001",
    customer: "ABC Retail Corp",
    items: ["Electronics & Parts (450 kg)", "Packaging Materials (80 kg)"],
    weight: "530 kg",
    dimensions: "4.5m × 2.3m × 2.0m",
    pickupDate: "May 10, 2024 09:00 AM",
    deliveryDate: "May 10, 2024 11:45 AM",
    deliveryAddress: "Makati Branch, EDSA Cor. Makati Ave, Makati City 1200",
    totalAmount: "$450.00",
    status: "in_transit",
  });

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <Link href="/manager/scheduled-bookings" style={{ color: "#0EA5E9", textDecoration: "none" }}>
              ← Back to Bookings
            </Link>
          </div>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>
            Order Details
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Reference: {order.id}</p>
        </div>

        {/* Order Info */}
        <div style={{ background: "white", padding: "2rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          {/* Order Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid #E8E8E8" }}>
            <div>
              <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.25rem" }}>Booking ID</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1A1A1A" }}>{order.bookingId}</div>
            </div>
            <div>
              <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.25rem" }}>Status</div>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  background: "#FED7AA",
                  color: "#92400E",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                In Transit
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid #E8E8E8" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700 }}>Customer Information</h2>
            <div style={{ color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>{order.customer}</div>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>Email: contact@abcretail.com</div>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>Phone: +63 2 8123 4567</div>
          </div>

          {/* Items */}
          <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid #E8E8E8" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700 }}>Items</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {order.items.map((item, i) => (
                <div key={i} style={{ padding: "0.75rem", background: "#F9FAFB", borderRadius: "6px", borderLeft: "3px solid #FF9800" }}>
                  {item}
                </div>
              ))}
            </div>
            <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Total Weight</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1A1A1A" }}>{order.weight}</div>
              </div>
              <div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Dimensions</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1A1A1A" }}>{order.dimensions}</div>
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid #E8E8E8" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700 }}>Delivery Information</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Pickup Date & Time</div>
                <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1A1A1A" }}>{order.pickupDate}</div>
              </div>
              <div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Delivery Date & Time</div>
                <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1A1A1A" }}>{order.deliveryDate}</div>
              </div>
            </div>
            <div>
              <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Delivery Address</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1A1A1A" }}>{order.deliveryAddress}</div>
            </div>
          </div>

          {/* Amount */}
          <div>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700 }}>Amount</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Total Amount</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#FF9800" }}>{order.totalAmount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
          <Link
            href="/manager/scheduled-bookings"
            style={{
              padding: "0.75rem 1.5rem",
              background: "#0EA5E9",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            Back to Bookings
          </Link>
        </div>
      </div>
    </main>
  );
}
