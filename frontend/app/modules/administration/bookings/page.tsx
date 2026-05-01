"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { formatPhp } from "@/lib/appLocale";
import { useState } from "react";

type Booking = {
  id: number;
  customer_name: string;
  customer_email: string;
  pickup_location: string;
  dropoff_location: string;
  booking_date: string;
  trip_date: string;
  status: "confirmed" | "pending" | "completed" | "cancelled";
  truck_type: string;
  cargo_weight: number;
  estimated_cost: number;
};

export default function BookingsPage() {
  useRoleGuard(["admin"]);

  const [bookings] = useState<Booking[]>([
    {
      id: 1,
      customer_name: "John Smith",
      customer_email: "john@example.com",
      pickup_location: "Makati City",
      dropoff_location: "Batangas City",
      booking_date: "2026-04-28",
      trip_date: "2026-04-28",
      status: "completed",
      truck_type: "Volvo FH16",
      cargo_weight: 18.5,
      estimated_cost: 529.5,
    },
    {
      id: 2,
      customer_name: "Sarah Johnson",
      customer_email: "sarah@example.com",
      pickup_location: "Angeles City",
      dropoff_location: "Makati City",
      booking_date: "2026-04-27",
      trip_date: "2026-04-27",
      status: "completed",
      truck_type: "Scania R450",
      cargo_weight: 20,
      estimated_cost: 686.75,
    },
    {
      id: 3,
      customer_name: "Michael Chen",
      customer_email: "michael@example.com",
      pickup_location: "Santa Rosa, Laguna",
      dropoff_location: "Quezon City",
      booking_date: "2026-04-28",
      trip_date: "2026-04-28",
      status: "confirmed",
      truck_type: "DAF XF",
      cargo_weight: 15,
      estimated_cost: 424.75,
    },
    {
      id: 4,
      customer_name: "Emma Wilson",
      customer_email: "emma@example.com",
      pickup_location: "Manila",
      dropoff_location: "Laoag City",
      booking_date: "2026-04-28",
      trip_date: "2026-04-29",
      status: "pending",
      truck_type: "Volvo FH16",
      cargo_weight: 22,
      estimated_cost: 750,
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
      case "confirmed":
        return "#2196F3";
      case "pending":
        return "#FF9800";
      case "cancelled":
        return "#F44336";
      default:
        return "#999";
    }
  };

  const stats = {
    total: bookings.length,
    completed: bookings.filter((b) => b.status === "completed").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    pending: bookings.filter((b) => b.status === "pending").length,
    totalRevenue: bookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + b.estimated_cost, 0),
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System Administration" },
          { label: "Customer Bookings" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Customer Bookings
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View and manage all customer bookings. Monitor booking status and trip
          details.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {stats.confirmed}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Confirmed</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {stats.pending}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Pending</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {formatPhp(stats.totalRevenue)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Revenue</div>
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
            <option value="confirmed">Confirmed</option>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                    <strong style={{ color: "#1A1A1A" }}>Booking #{booking.id}</strong>
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
                    <strong>Customer:</strong> {booking.customer_name} ({booking.customer_email})
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    {booking.pickup_location} → {booking.dropoff_location}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Booked: {booking.booking_date} | Trip: {booking.trip_date}
                  </p>
                </div>
                <div style={{ textAlign: "right", marginLeft: "1rem" }}>
                  <div style={{ color: "#FF9800", fontWeight: 700 }}>
                    {formatPhp(booking.estimated_cost)}
                  </div>
                  <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                    {booking.truck_type}
                  </p>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedBooking === booking.id && (
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
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                        Cargo Weight
                      </p>
                      <p
                        style={{
                          color: "#1A1A1A",
                          fontWeight: 700,
                          margin: 0,
                        }}
                      >
                        {booking.cargo_weight}T
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                        Estimated Cost
                      </p>
                      <p
                        style={{
                          color: "#FF9800",
                          fontWeight: 700,
                          margin: 0,
                        }}
                      >
                        {formatPhp(booking.estimated_cost)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
