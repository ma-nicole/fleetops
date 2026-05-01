"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRoleGuard } from "@/lib/useRoleGuard";
import BookingService, { Booking } from "@/lib/bookingService";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { formatPhp } from "@/lib/appLocale";

export default function BookingApprovalsPage() {
  useRoleGuard(["manager", "admin"]);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [notes, setNotes] = useState("");

  const managerId = "manager-001";

  const refreshBookings = () => {
    setBookings(BookingService.getAllBookings());
  };

  useEffect(() => {
    refreshBookings();
    const interval = window.setInterval(refreshBookings, 4000);
    return () => window.clearInterval(interval);
  }, []);

  const pendingApproval = useMemo(
    () => bookings.filter((b) => b.status === "pending_approval"),
    [bookings]
  );
  const cancellationRequests = useMemo(
    () => bookings.filter((b) => b.cancellationRequested && b.status !== "cancelled"),
    [bookings]
  );
  const completedForClosing = useMemo(
    () => bookings.filter((b) => b.status === "completed" && !b.closedByManager),
    [bookings]
  );

  const handleApprove = () => {
    if (!selectedBooking) return;
    BookingService.managerReviewBooking(selectedBooking.id, managerId, true, notes);
    setSelectedBooking(null);
    setNotes("");
    refreshBookings();
  };

  const handleReject = () => {
    if (!selectedBooking) return;
    BookingService.managerReviewBooking(selectedBooking.id, managerId, false, notes || "Rejected by manager");
    setSelectedBooking(null);
    setNotes("");
    refreshBookings();
  };

  const handleCancellationApproval = (booking: Booking) => {
    BookingService.managerCancelBooking(booking.id, managerId, booking.cancellationReason || "Cancellation approved");
    refreshBookings();
  };

  const handleCloseJob = (booking: Booking) => {
    BookingService.managerCloseJob(booking.id, managerId);
    refreshBookings();
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <div>
          <Link href="/manager/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
            ← Dashboard
          </Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Booking Approvals</h1>
          <p style={{ margin: 0, color: "#666" }}>Approve/reject bookings, process cancellations, and close completed jobs.</p>
        </div>

        <section className="card" style={{ padding: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>Pending Approval ({pendingApproval.length})</h3>
          {pendingApproval.length === 0 ? (
            <p style={{ color: "#666", marginBottom: 0 }}>No pending bookings.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {pendingApproval.map((booking) => (
                <div key={booking.id} style={{ border: "1px solid #E8E8E8", borderRadius: "8px", padding: "1rem", background: "white", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>{booking.id}</p>
                    <p style={{ margin: "0 0 0.25rem", color: "#666" }}>{booking.pickupLocation} → {booking.dropoffLocation}</p>
                    <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                      {booking.cargoWeight} tons • {new Date(booking.shipmentDate).toLocaleDateString()} • {formatPhp(booking.totalCost)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedBooking(booking)}
                    style={{ padding: "0.6rem 1rem", borderRadius: "6px", border: "none", background: "#3B82F6", color: "white", fontWeight: 600, cursor: "pointer" }}
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" style={{ padding: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>Cancellation Requests ({cancellationRequests.length})</h3>
          {cancellationRequests.length === 0 ? (
            <p style={{ color: "#666", marginBottom: 0 }}>No cancellation requests.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {cancellationRequests.map((booking) => (
                <div key={booking.id} style={{ border: "1px solid #E8E8E8", borderRadius: "8px", padding: "1rem", background: "white", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>{booking.id}</p>
                    <p style={{ margin: "0 0 0.25rem", color: "#666" }}>{booking.cancellationReason || "No reason provided."}</p>
                    <WorkflowStatusBadge status={booking.status} />
                  </div>
                  <button
                    onClick={() => handleCancellationApproval(booking)}
                    style={{ padding: "0.6rem 1rem", borderRadius: "6px", border: "none", background: "#EF4444", color: "white", fontWeight: 600, cursor: "pointer" }}
                  >
                    Approve Cancellation
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" style={{ padding: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>Completed Jobs to Close ({completedForClosing.length})</h3>
          {completedForClosing.length === 0 ? (
            <p style={{ color: "#666", marginBottom: 0 }}>No jobs waiting for closure.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {completedForClosing.map((booking) => (
                <div key={booking.id} style={{ border: "1px solid #E8E8E8", borderRadius: "8px", padding: "1rem", background: "white", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>{booking.id}</p>
                    <p style={{ margin: 0, color: "#666" }}>{booking.pickupLocation} → {booking.dropoffLocation}</p>
                  </div>
                  <button
                    onClick={() => handleCloseJob(booking)}
                    style={{ padding: "0.6rem 1rem", borderRadius: "6px", border: "none", background: "#10B981", color: "white", fontWeight: 600, cursor: "pointer" }}
                  >
                    Close Job
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedBooking && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: "520px", width: "92%", padding: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>Review {selectedBooking.id}</h2>
            <p style={{ margin: "0 0 0.4rem", color: "#666" }}>{selectedBooking.pickupLocation} → {selectedBooking.dropoffLocation}</p>
            <p style={{ margin: "0 0 1rem", color: "#666" }}>
              Cost: {formatPhp(selectedBooking.totalCost)} • Date: {new Date(selectedBooking.shipmentDate).toLocaleDateString()}
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cost, ETA, and availability notes..."
              style={{ width: "100%", minHeight: "90px", border: "1px solid #D1D5DB", borderRadius: "6px", padding: "0.75rem", fontFamily: "inherit", marginBottom: "1rem" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <button onClick={handleReject} style={{ border: "none", borderRadius: "6px", padding: "0.65rem", background: "#EF4444", color: "white", fontWeight: 600, cursor: "pointer" }}>Reject</button>
              <button onClick={handleApprove} style={{ border: "none", borderRadius: "6px", padding: "0.65rem", background: "#10B981", color: "white", fontWeight: 600, cursor: "pointer" }}>Approve</button>
              <button onClick={() => setSelectedBooking(null)} style={{ border: "none", borderRadius: "6px", padding: "0.65rem", background: "#E5E7EB", color: "#1F2937", fontWeight: 600, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
