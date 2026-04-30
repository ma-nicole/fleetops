"use client";

import { useEffect, useMemo, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import Link from "next/link";
import BookingService, { Booking } from "@/lib/bookingService";

export default function DispatcherJobAssignmentsPage() {
  useRoleGuard(["dispatcher"]);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("driver-001");
  const [selectedTruck, setSelectedTruck] = useState("TRK-001");
  const dispatcherId = "dispatcher-001";
  const drivers = ["driver-001", "driver-002", "driver-003"];
  const trucks = ["TRK-001", "TRK-002", "TRK-003"];

  useEffect(() => {
    const refresh = () => setBookings(BookingService.getAllBookings());
    refresh();
    const interval = window.setInterval(refresh, 4000);
    return () => window.clearInterval(interval);
  }, []);

  const approvedBookings = useMemo(
    () => bookings.filter((b) => b.status === "approved"),
    [bookings]
  );
  const activeTrips = useMemo(
    () => bookings.filter((b) => ["assigned", "accepted", "enroute", "loading", "out_for_delivery"].includes(b.status)),
    [bookings]
  );
  const bookingsWithIssues = useMemo(
    () => activeTrips.filter((b) => b.exceptionType),
    [activeTrips]
  );

  const createAssignment = () => {
    if (!selectedBookingId) return;
    const routePlan = {
      waypoints: [
        { location: "Pickup", eta: new Date(Date.now() + 40 * 60000).toISOString() },
        { location: "Dropoff", eta: new Date(Date.now() + 3 * 60 * 60000).toISOString() },
      ],
      estimatedDistance: 56,
      estimatedDuration: 3.2,
    };
    BookingService.dispatcherAssignJob(selectedBookingId, dispatcherId, selectedDriver, selectedTruck, routePlan);
    setBookings(BookingService.getAllBookings());
  };

  const rerouteBooking = (booking: Booking) => {
    const newRoute = {
      waypoints: [
        { location: "Reroute Checkpoint", eta: new Date(Date.now() + 70 * 60000).toISOString() },
        { location: "Destination", eta: new Date(Date.now() + 4 * 60 * 60000).toISOString() },
      ],
      estimatedDistance: 74,
      estimatedDuration: 4.1,
    };
    BookingService.updateRouteForException(booking.id, dispatcherId, newRoute);
    setBookings(BookingService.getAllBookings());
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <div>
          <Link href="/dispatcher/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
            ← Dashboard
          </Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Job Assignments</h1>
          <p style={{ margin: 0, color: "#666" }}>Assign approved bookings and monitor trip progress in real time.</p>
        </div>

        <section className="card" style={{ padding: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>Create Assignment</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "0.75rem", alignItems: "end" }}>
            <select value={selectedBookingId} onChange={(e) => setSelectedBookingId(e.target.value)} style={{ padding: "0.65rem", borderRadius: "6px", border: "1px solid #D1D5DB" }}>
              <option value="">Select approved booking...</option>
              {approvedBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} • {b.pickupLocation} → {b.dropoffLocation}
                </option>
              ))}
            </select>
            <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} style={{ padding: "0.65rem", borderRadius: "6px", border: "1px solid #D1D5DB" }}>
              {drivers.map((driver) => <option key={driver} value={driver}>{driver}</option>)}
            </select>
            <select value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)} style={{ padding: "0.65rem", borderRadius: "6px", border: "1px solid #D1D5DB" }}>
              {trucks.map((truck) => <option key={truck} value={truck}>{truck}</option>)}
            </select>
            <button onClick={createAssignment} style={{ padding: "0.65rem 1rem", border: "none", borderRadius: "6px", background: "#3B82F6", color: "white", fontWeight: 600, cursor: "pointer" }}>
              Assign
            </button>
          </div>
        </section>

        <section className="card" style={{ padding: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>Ongoing Operations ({activeTrips.length})</h3>
          {activeTrips.length === 0 ? (
            <p style={{ color: "#666", marginBottom: 0 }}>No active assigned trips.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {activeTrips.map((booking) => (
                <div key={booking.id} style={{ border: "1px solid #E8E8E8", borderRadius: "8px", padding: "1rem", background: "white", display: "grid", gap: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{booking.id}</strong>
                    <WorkflowStatusBadge status={booking.status} />
                  </div>
                  <p style={{ margin: 0, color: "#666" }}>{booking.pickupLocation} → {booking.dropoffLocation}</p>
                  <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                    Driver: {booking.driverId || "-"} • Truck: {booking.truckAssignedId || "-"}
                  </p>
                  <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                    Location: {booking.currentLocation || "No update yet"} • ETA: {booking.currentETA ? new Date(booking.currentETA).toLocaleString() : "Pending"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" style={{ padding: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>Exception Handling ({bookingsWithIssues.length})</h3>
          {bookingsWithIssues.length === 0 ? (
            <p style={{ color: "#666", marginBottom: 0 }}>No active issues.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {bookingsWithIssues.map((booking) => (
                <div key={booking.id} style={{ border: "1px solid #FECACA", borderRadius: "8px", padding: "1rem", background: "#FFFBFB", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <p style={{ margin: "0 0 0.3rem", fontWeight: 700 }}>{booking.id}</p>
                    <p style={{ margin: "0 0 0.3rem", color: "#7F1D1D" }}>{booking.exceptionType?.replace("_", " ")}: {booking.exceptionDetails}</p>
                    <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>Update plan and ETA to notify manager/user.</p>
                  </div>
                  <button onClick={() => rerouteBooking(booking)} style={{ border: "none", borderRadius: "6px", padding: "0.65rem 1rem", background: "#F59E0B", color: "white", fontWeight: 600, cursor: "pointer", height: "fit-content" }}>
                    Re-route
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
