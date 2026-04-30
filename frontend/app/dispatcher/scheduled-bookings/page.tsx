"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type Booking = {
  id: string;
  customer: string;
  pickupLocation: string;
  deliveryLocation: string;
  scheduledDate: string;
  scheduledTime: string;
  status: "pending" | "confirmed" | "scheduled" | "assigned" | "in_transit" | "completed";
  items: string;
  weight: string;
  assignedDriver?: string;
  priority: "low" | "medium" | "high";
};

export default function ScheduledBookingsPage() {
  useRoleGuard(["dispatcher"]);

  const [bookings] = useState<Booking[]>([
    {
      id: "BK-2024-0001",
      customer: "ABC Retail Corp",
      pickupLocation: "Manila Warehouse",
      deliveryLocation: "Makati Branch",
      scheduledDate: "2024-05-10",
      scheduledTime: "09:00 AM",
      status: "scheduled",
      items: "Electronics & Appliances",
      weight: "850 kg",
      assignedDriver: "Carlos Rodriguez",
      priority: "high",
    },
    {
      id: "BK-2024-0002",
      customer: "XYZ Food Supplies",
      pickupLocation: "Quezon City Depot",
      deliveryLocation: "Pasig Market",
      scheduledDate: "2024-05-10",
      scheduledTime: "11:30 AM",
      status: "confirmed",
      items: "Food & Beverages",
      weight: "1200 kg",
      priority: "high",
    },
    {
      id: "BK-2024-0003",
      customer: "Metro Furniture Ltd",
      pickupLocation: "Laguna Distribution",
      deliveryLocation: "Las Piñas Office",
      scheduledDate: "2024-05-11",
      scheduledTime: "01:00 PM",
      status: "pending",
      items: "Furniture",
      weight: "2500 kg",
      priority: "medium",
    },
    {
      id: "BK-2024-0004",
      customer: "Tech Solutions Inc",
      pickupLocation: "BGC Tech Hub",
      deliveryLocation: "Makati IT Park",
      scheduledDate: "2024-05-10",
      scheduledTime: "03:00 PM",
      status: "in_transit",
      items: "Computer Equipment",
      weight: "450 kg",
      assignedDriver: "Maria Santos",
      priority: "high",
    },
    {
      id: "BK-2024-0005",
      customer: "Document Solutions",
      pickupLocation: "Ortigas Warehouse",
      deliveryLocation: "Quezon City Branch",
      scheduledDate: "2024-05-12",
      scheduledTime: "08:00 AM",
      status: "pending",
      items: "Documents & Files",
      weight: "600 kg",
      priority: "low",
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#2196F3";
      case "confirmed":
        return "#FF9800";
      case "scheduled":
        return "#9C27B0";
      case "assigned":
        return "#4CAF50";
      case "in_transit":
        return "#FF6B6B";
      case "completed":
        return "#4CAF50";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "📋 Pending";
      case "confirmed":
        return "✓ Confirmed";
      case "scheduled":
        return "📅 Scheduled";
      case "assigned":
        return "👤 Assigned";
      case "in_transit":
        return "🚚 In Transit";
      case "completed":
        return "✅ Completed";
      default:
        return "Unknown";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low":
        return "#4CAF50";
      case "medium":
        return "#FF9800";
      case "high":
        return "#F44336";
      default:
        return "#999";
    }
  };

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Scheduled Bookings</h1>
        <p style={{ color: "#666666", margin: "0" }}>Manage upcoming delivery bookings and assignments</p>
      </div>

      {/* Filter Section */}
      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #E8E8E8",
          borderRadius: "8px",
          background: "#F9F9F9",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "1rem",
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
            Status
          </label>
          <select
            style={{
              width: "100%",
              padding: "0.6rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              backgroundColor: "white",
            }}
          >
            <option>All</option>
            <option>Pending</option>
            <option>Confirmed</option>
            <option>Scheduled</option>
            <option>In Transit</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
            Priority
          </label>
          <select
            style={{
              width: "100%",
              padding: "0.6rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              backgroundColor: "white",
            }}
          >
            <option>All</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
            Date Range
          </label>
          <input
            type="date"
            style={{
              width: "100%",
              padding: "0.6rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
            }}
          />
        </div>
      </div>

      {/* Bookings List */}
      <div style={{ display: "grid", gap: "1rem" }}>
        {bookings.map((booking) => (
          <div
            key={booking.id}
            style={{
              padding: "1.5rem",
              border: `1px solid #E8E8E8`,
              borderRadius: "8px",
              background: "#F9F9F9",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "1.5rem", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0", fontWeight: "700" }}>{booking.id}</h3>
                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  {booking.customer}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ROUTE</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.9rem", margin: "0.25rem 0 0 0" }}>
                  {booking.pickupLocation} → {booking.deliveryLocation}
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column", alignItems: "flex-end" }}>
                <span
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: getStatusColor(booking.status) + "20",
                    color: getStatusColor(booking.status),
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getStatusLabel(booking.status)}
                </span>
                <span
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: getPriorityColor(booking.priority) + "20",
                    color: getPriorityColor(booking.priority),
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                  }}
                >
                  {booking.priority.toUpperCase()} PRIORITY
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "1rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid #E8E8E8",
              }}
            >
              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>SCHEDULED DATE</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {booking.scheduledDate}
                </p>
              </div>
              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TIME</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {booking.scheduledTime}
                </p>
              </div>
              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>WEIGHT</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {booking.weight}
                </p>
              </div>
              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ITEMS</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.85rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {booking.items}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "1rem",
              }}
            >
              {booking.assignedDriver && (
                <p style={{ color: "#4CAF50", fontWeight: "600", margin: "0", fontSize: "0.9rem" }}>
                  ✓ Assigned to: {booking.assignedDriver}
                </p>
              )}
              {!booking.assignedDriver && (
                <p style={{ color: "#F44336", fontWeight: "600", margin: "0", fontSize: "0.9rem" }}>
                  ⚠️ Not assigned yet
                </p>
              )}

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Link
                  href="/dispatcher/order-details"
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#2196F3",
                    color: "white",
                    borderRadius: "4px",
                    textDecoration: "none",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                  }}
                >
                  View Details
                </Link>
                {booking.status === "pending" && (
                  <button
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#FF9800",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                    onClick={() => alert("Assign driver to " + booking.id)}
                  >
                    Assign
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
