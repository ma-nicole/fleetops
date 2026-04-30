"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import BookingService, { Booking } from "@/lib/bookingService";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function BookingStatusPage() {
  useRoleGuard(["customer"]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const userId = "customer-001";

  const loadBookings = () => {
    const userBookings = BookingService.getBookingsByUser(userId);
    setBookings(userBookings);
    if (!selectedBookingId && userBookings.length > 0) setSelectedBookingId(userBookings[0].id);
  };

  useEffect(() => {
    loadBookings();
    const interval = window.setInterval(loadBookings, 4000);
    return () => window.clearInterval(interval);
  }, []);

  const booking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const requestCancellation = () => {
    if (!booking || !cancelReason.trim()) return;
    BookingService.requestCancellation(booking.id, userId, cancelReason);
    setCancelReason("");
    loadBookings();
  };

  const timelineSteps = [
    { id: "pending", label: "Pending Approval", completed: booking ? booking.status !== "pending_approval" : false, current: booking?.status === "pending_approval" },
    { id: "approved", label: "Approved", completed: booking ? ["assigned", "accepted", "enroute", "loading", "out_for_delivery", "completed"].includes(booking.status) : false, current: booking?.status === "approved" },
    { id: "assigned", label: "Assigned", completed: booking ? ["accepted", "enroute", "loading", "out_for_delivery", "completed"].includes(booking.status) : false, current: booking?.status === "assigned" },
    { id: "accepted", label: "Accepted", completed: booking ? ["enroute", "loading", "out_for_delivery", "completed"].includes(booking.status) : false, current: booking?.status === "accepted" },
    { id: "enroute", label: "Enroute", completed: booking ? ["loading", "out_for_delivery", "completed"].includes(booking.status) : false, current: booking?.status === "enroute" },
    { id: "loading", label: "Loading", completed: booking ? ["out_for_delivery", "completed"].includes(booking.status) : false, current: booking?.status === "loading" },
    { id: "delivery", label: "Out for Delivery", completed: booking ? ["completed"].includes(booking.status) : false, current: booking?.status === "out_for_delivery" },
    { id: "completed", label: "Completed", completed: booking?.status === "completed", current: false },
  ];

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <div>
          <Link href="/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>← Dashboard</Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Booking Status</h1>
          <p style={{ margin: 0, color: "#666" }}>Track your booking, ETA updates, and notifications.</p>
        </div>

        <section className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1rem" }}>
            <div style={{ borderRight: "1px solid #E8E8E8", paddingRight: "1rem" }}>
              <h3 style={{ marginTop: 0 }}>My Bookings</h3>
              <div style={{ display: "grid", gap: "0.6rem" }}>
                {bookings.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedBookingId(item.id)}
                    style={{ textAlign: "left", border: selectedBookingId === item.id ? "2px solid #3B82F6" : "1px solid #E5E7EB", borderRadius: "8px", background: "white", cursor: "pointer", padding: "0.75rem" }}
                  >
                    <p style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>{item.id}</p>
                    <p style={{ margin: "0 0 0.25rem", color: "#666", fontSize: "0.85rem" }}>{item.pickupLocation}</p>
                    <WorkflowStatusBadge status={item.status} size="sm" />
                  </button>
                ))}
                {bookings.length === 0 && <p style={{ margin: 0, color: "#666" }}>No bookings yet.</p>}
              </div>
            </div>

            <div>
              {!booking ? (
                <p style={{ color: "#666" }}>Select a booking to view details.</p>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h3 style={{ margin: 0 }}>{booking.id}</h3>
                    <WorkflowStatusBadge status={booking.status} size="lg" />
                  </div>
                  <p style={{ margin: "0 0 0.25rem", color: "#666" }}>{booking.pickupLocation} → {booking.dropoffLocation}</p>
                  <p style={{ margin: "0 0 1rem", color: "#666", fontSize: "0.9rem" }}>
                    ETA: {booking.currentETA ? new Date(booking.currentETA).toLocaleString() : "Pending"} • Location: {booking.currentLocation || "No location update"}
                  </p>

                  <WorkflowTimeline steps={timelineSteps} />

                  {booking.status !== "cancelled" && booking.status !== "completed" && !booking.cancellationRequested && !["enroute", "loading", "out_for_delivery"].includes(booking.status) && (
                    <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem" }}>
                      <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." style={{ padding: "0.65rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                      <button onClick={requestCancellation} style={{ border: "none", borderRadius: "6px", padding: "0.65rem 1rem", background: "#EF4444", color: "white", fontWeight: 600, cursor: "pointer" }}>
                        Request Cancellation
                      </button>
                    </div>
                  )}

                  {booking.cancellationRequested && (
                    <p style={{ marginTop: "1rem", color: "#7F1D1D", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "0.75rem" }}>
                      Cancellation requested. Waiting for manager approval.
                    </p>
                  )}

                  <div style={{ marginTop: "1rem", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0.75rem", background: "#F9FAFB" }}>
                    <p style={{ margin: "0 0 0.4rem", fontWeight: 700 }}>Notifications</p>
                    <div style={{ display: "grid", gap: "0.35rem" }}>
                      {(booking.notificationLog || []).slice(-6).reverse().map((msg) => {
                        const [ts, text] = msg.split("|");
                        return (
                          <p key={msg} style={{ margin: 0, color: "#666", fontSize: "0.85rem" }}>
                            {new Date(ts).toLocaleString()} - {text}
                          </p>
                        );
                      })}
                      {(booking.notificationLog || []).length === 0 && <p style={{ margin: 0, color: "#666", fontSize: "0.85rem" }}>No updates yet.</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
