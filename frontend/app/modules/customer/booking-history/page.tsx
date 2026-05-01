"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type BookingHistory = {
  id: number;
  trip_id: number;
  pickup: string;
  dropoff: string;
  booking_date: string;
  trip_date: string;
  status: "completed" | "cancelled" | "pending";
  total_cost: number;
  cargo_weight: number;
};

export default function BookingHistoryPage() {
  useRoleGuard(["customer"]);

  const [bookings] = useState<BookingHistory[]>([
    {
      id: 1,
      trip_id: 101,
      pickup: "New York, NY",
      dropoff: "Philadelphia, PA",
      booking_date: "2026-04-28",
      trip_date: "2026-04-28",
      status: "completed",
      total_cost: 529.5,
      cargo_weight: 18.5,
    },
    {
      id: 2,
      trip_id: 102,
      pickup: "Boston, MA",
      dropoff: "New York, NY",
      booking_date: "2026-04-27",
      trip_date: "2026-04-27",
      status: "completed",
      total_cost: 686.75,
      cargo_weight: 20,
    },
    {
      id: 3,
      trip_id: 103,
      pickup: "Philadelphia, PA",
      dropoff: "Washington, DC",
      booking_date: "2026-04-28",
      trip_date: "2026-04-28",
      status: "completed",
      total_cost: 424.75,
      cargo_weight: 15,
    },
    {
      id: 4,
      trip_id: 104,
      pickup: "Washington, DC",
      dropoff: "Atlanta, GA",
      booking_date: "2026-04-26",
      trip_date: "2026-04-27",
      status: "cancelled",
      total_cost: 0,
      cargo_weight: 22,
    },
  ]);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedBooking, setSelectedBooking] = useState<number | null>(null);

  const filteredBookings =
    filterStatus === "all"
      ? bookings
      : bookings.filter((b) => b.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#4CAF50";
      case "cancelled":
        return "#F44336";
      case "pending":
        return "#FF9800";
      default:
        return "#999";
    }
  };

  const stats = {
    total: bookings.length,
    completed: bookings.filter((b) => b.status === "completed").length,
    totalSpent: bookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + b.total_cost, 0),
    avgCost: bookings.length > 0
      ? (bookings
          .filter((b) => b.status === "completed")
          .reduce((sum, b) => sum + b.total_cost, 0) /
          bookings.filter((b) => b.status === "completed").length).toFixed(2)
      : 0,
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/customer" },
          { label: "My Bookings" },
          { label: "Booking History" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Booking History
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View your past bookings and trip details. Track your spending and service history.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {stats.total}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Total Bookings
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {stats.completed}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Completed</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              ${stats.totalSpent.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Spent</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              ${stats.avgCost}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Avg Cost</div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ color: "#1A1A1A", fontWeight: 600, marginRight: "1rem" }}>
            Filter by Status:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              color: "#1A1A1A",
              cursor: "pointer",
            }}
          >
            <option value="all">All Bookings</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Booking List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="card"
              onClick={() =>
                setSelectedBooking(
                  selectedBooking === booking.id ? null : booking.id
                )
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  selectedBooking === booking.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  selectedBooking === booking.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <strong style={{ color: "#1A1A1A" }}>
                      Trip #{booking.trip_id}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(booking.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    {booking.pickup} → {booking.dropoff}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Booked: {booking.booking_date} | Trip: {booking.trip_date} | Cargo: {booking.cargo_weight}T
                  </p>
                </div>
                <div style={{ textAlign: "right", marginLeft: "1rem", whiteSpace: "nowrap" }}>
                  <div style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.2rem" }}>
                    ${booking.total_cost.toFixed(2)}
                  </div>
                </div>
              </div>

              {selectedBooking === booking.id && booking.status !== "cancelled" && (
                <div
                  style={{
                    background: "rgba(255, 152, 0, 0.08)",
                    border: "1px solid #FFE0B2",
                    borderRadius: "8px",
                    padding: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <h4 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                    Booking Details
                  </h4>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Cargo Weight:</strong> {booking.cargo_weight} tons
                  </p>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Total Cost:</strong> ${booking.total_cost.toFixed(2)}
                  </p>
                  {booking.status === "completed" && (
                    <button
                      style={{
                        marginTop: "1rem",
                        padding: "0.5rem 1rem",
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
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
