"use client";

import Link from "next/link";
import { useState } from "react";

type OrderDetail = {
  id: string;
  bookingId: string;
  customer: string;
  status: string;
  items: Array<{ name: string; quantity: number; weight: string }>;
  pickupDetails: { address: string; contactPerson: string; phone: string };
  deliveryDetails: { address: string; contactPerson: string; phone: string };
  specialInstructions: string;
};

export default function OrderDetailsPage() {
  const [order] = useState<OrderDetail>({
    id: "ORD-2024-0001",
    bookingId: "BK-2024-0001",
    customer: "ABC Retail Corp",
    status: "scheduled",
    items: [
      { name: "Electronic Items", quantity: 25, weight: "450 kg" },
      { name: "Appliance Units", quantity: 8, weight: "400 kg" },
    ],
    pickupDetails: {
      address: "123 Manila Warehouse Lane, Navotas, Metro Manila",
      contactPerson: "Mr. John Smith",
      phone: "+63-2-1234-5678",
    },
    deliveryDetails: {
      address: "456 Makati Business Center, Makati, Metro Manila",
      contactPerson: "Ms. Jane Doe",
      phone: "+63-2-8765-4321",
    },
    specialInstructions: "Handle with care - Fragile electronics. Require unloading assistance at delivery site.",
  });

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem", maxWidth: "1000px" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Order Details</h1>
        <p style={{ color: "#666666", margin: "0" }}>Complete order information and delivery instructions</p>
      </div>

      {/* Order Header */}
      <div
        style={{
          padding: "1.5rem",
          border: "2px solid #2196F3",
          borderRadius: "8px",
          background: "rgba(33, 150, 243, 0.05)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2rem", marginBottom: "1rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ORDER ID</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.3rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {order.id}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>BOOKING ID</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.3rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {order.bookingId}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>CUSTOMER</p>
            <p style={{ color: "#1A1A1A", fontSize: "1rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {order.customer}
            </p>
          </div>
        </div>

        <div>
          <span
            style={{
              padding: "0.5rem 1rem",
              background: "#2196F3",
              color: "white",
              borderRadius: "4px",
              fontWeight: "600",
              fontSize: "0.85rem",
            }}
          >
             {order.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Items List */}
      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Order Items</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {order.items.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: "1rem",
                border: "1px solid #E8E8E8",
                borderRadius: "6px",
                background: "#F9F9F9",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ITEM NAME</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {item.name}
                </p>
              </div>
              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>QUANTITY</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {item.quantity} units
                </p>
              </div>
              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>WEIGHT</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {item.weight}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pickup Details */}
      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}> Pickup Details</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ADDRESS</p>
            <p style={{ color: "#1A1A1A", margin: "0.5rem 0 0 0" }}>
              {order.pickupDetails.address}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>CONTACT PERSON</p>
              <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
                {order.pickupDetails.contactPerson}
              </p>
            </div>
            <div>
              <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PHONE</p>
              <p style={{ color: "#2196F3", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
                {order.pickupDetails.phone}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Details */}
      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}> Delivery Details</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ADDRESS</p>
            <p style={{ color: "#1A1A1A", margin: "0.5rem 0 0 0" }}>
              {order.deliveryDetails.address}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>CONTACT PERSON</p>
              <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
                {order.deliveryDetails.contactPerson}
              </p>
            </div>
            <div>
              <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PHONE</p>
              <p style={{ color: "#2196F3", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
                {order.deliveryDetails.phone}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Special Instructions */}
      {order.specialInstructions && (
        <div
          style={{
            padding: "1.5rem",
            border: "2px solid #FF9800",
            borderRadius: "8px",
            background: "rgba(255, 152, 0, 0.05)",
          }}
        >
          <h2 style={{ color: "#FF9800", marginBottom: "0.5rem" }}> Special Instructions</h2>
          <p style={{ color: "#1A1A1A", margin: "0", lineHeight: "1.6" }}>
            {order.specialInstructions}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <button
          style={{
            padding: "0.75rem",
            background: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
          onClick={() => alert("Assigning driver...")}
        >
           Assign Driver
        </button>
        <button
          style={{
            padding: "0.75rem",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
          onClick={() => alert("Printing documents...")}
        >
           Print Documents
        </button>
        <Link
          href="/dispatcher/dashboard"
          style={{
            padding: "0.75rem",
            background: "#F5F5F5",
            color: "#1A1A1A",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            textDecoration: "none",
            textAlign: "center",
            fontWeight: "600",
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
