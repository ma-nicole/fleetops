"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRoleGuard } from "@/lib/useRoleGuard";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import BookingService, { Booking, BookingStatus } from "@/lib/bookingService";
import { formatDateTime } from "@/lib/appLocale";

export default function DriverJobExecutionPage() {
  useRoleGuard(["driver"]);

  const [jobs, setJobs] = useState<Booking[]>([]);
  const [activeJob, setActiveJob] = useState<Booking | null>(null);
  const [issueType, setIssueType] = useState<"breakdown" | "traffic_delay" | "other">("breakdown");
  const [issueDetails, setIssueDetails] = useState("");
  const [locationUpdate, setLocationUpdate] = useState("");
  const driverId = "driver-001";

  const loadDriverJobs = () => {
    const all = BookingService.getAllBookings();
    const driverJobs = all.filter((b) => b.driverId === driverId);
    setJobs(driverJobs);
    setActiveJob((prev) => driverJobs.find((job) => job.id === prev?.id) || driverJobs[0] || null);
  };

  useEffect(() => {
    loadDriverJobs();
    const interval = window.setInterval(loadDriverJobs, 4000);
    return () => window.clearInterval(interval);
  }, []);

  const runAction = (status: BookingStatus) => {
    if (!activeJob) return;
    if (status === "accepted") BookingService.driverAcceptJob(activeJob.id, driverId);
    if (status === "enroute") BookingService.driverDepartToPickup(activeJob.id, driverId, locationUpdate || activeJob.pickupLocation);
    if (status === "loading") BookingService.driverStartLoading(activeJob.id, driverId, locationUpdate || activeJob.pickupLocation);
    if (status === "out_for_delivery") BookingService.driverDepartForDelivery(activeJob.id, driverId, locationUpdate || "Departed pickup");
    if (status === "completed") BookingService.driverCompleteDelivery(activeJob.id, driverId, activeJob.dropoffLocation, "POD captured");
    loadDriverJobs();
  };

  const reportIssue = () => {
    if (!activeJob || !issueDetails.trim()) return;
    BookingService.reportException(activeJob.id, driverId, issueType, issueDetails);
    setIssueDetails("");
    loadDriverJobs();
  };

  const updateLocation = () => {
    if (!activeJob || !locationUpdate.trim()) return;
    const eta = new Date(Date.now() + 45 * 60000).toISOString();
    BookingService.updateDriverLocation(activeJob.id, driverId, locationUpdate, eta);
    setLocationUpdate("");
    loadDriverJobs();
  };

  const timelineSteps = [
    { id: "assigned", label: "Assigned", completed: ["accepted", "enroute", "loading", "out_for_delivery", "completed"].includes(activeJob?.status || ""), current: activeJob?.status === "assigned" },
    { id: "accepted", label: "Accepted", completed: ["enroute", "loading", "out_for_delivery", "completed"].includes(activeJob?.status || ""), current: activeJob?.status === "accepted" },
    { id: "enroute", label: "Enroute", completed: ["loading", "out_for_delivery", "completed"].includes(activeJob?.status || ""), current: activeJob?.status === "enroute" },
    { id: "loading", label: "Loading", completed: ["out_for_delivery", "completed"].includes(activeJob?.status || ""), current: activeJob?.status === "loading" },
    { id: "delivery", label: "Out for Delivery", completed: ["completed"].includes(activeJob?.status || ""), current: activeJob?.status === "out_for_delivery" },
    { id: "completed", label: "Completed", completed: activeJob?.status === "completed", current: false },
  ];

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.5rem", gridTemplateColumns: "1fr 330px" }}>
        <section className="card" style={{ padding: "1.25rem" }}>
          <Link href="/driver/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>← Dashboard</Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Job Execution</h1>
          <p style={{ margin: "0 0 1rem", color: "#666" }}>Driver actions and status updates.</p>

          {!activeJob ? (
            <p style={{ color: "#666", marginBottom: 0 }}>No active assigned jobs.</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <strong>{activeJob.id}</strong>
                <WorkflowStatusBadge status={activeJob.status} size="lg" />
              </div>
              <p style={{ margin: "0 0 0.25rem", color: "#666" }}>{activeJob.pickupLocation} → {activeJob.dropoffLocation}</p>
              <p style={{ margin: "0 0 1rem", color: "#666", fontSize: "0.9rem" }}>
                Current location: {activeJob.currentLocation || "No location update"} • ETA: {activeJob.currentETA ? formatDateTime(activeJob.currentETA) : "Pending"}
              </p>

              <WorkflowTimeline steps={timelineSteps} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                {activeJob.status === "assigned" && <button onClick={() => runAction("accepted")} style={{ border: "none", borderRadius: "6px", padding: "0.75rem", background: "#10B981", color: "white", fontWeight: 600, cursor: "pointer" }}>Accept Job</button>}
                {activeJob.status === "accepted" && <button onClick={() => runAction("enroute")} style={{ border: "none", borderRadius: "6px", padding: "0.75rem", background: "#3B82F6", color: "white", fontWeight: 600, cursor: "pointer" }}>Depart to Pickup</button>}
                {activeJob.status === "enroute" && <button onClick={() => runAction("loading")} style={{ border: "none", borderRadius: "6px", padding: "0.75rem", background: "#F59E0B", color: "white", fontWeight: 600, cursor: "pointer" }}>Arrived & Loading Started</button>}
                {activeJob.status === "loading" && <button onClick={() => runAction("out_for_delivery")} style={{ border: "none", borderRadius: "6px", padding: "0.75rem", background: "#8B5CF6", color: "white", fontWeight: 600, cursor: "pointer" }}>Out for Delivery</button>}
                {activeJob.status === "out_for_delivery" && <button onClick={() => runAction("completed")} style={{ border: "none", borderRadius: "6px", padding: "0.75rem", background: "#059669", color: "white", fontWeight: 600, cursor: "pointer" }}>Delivered (Capture POD)</button>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <input value={locationUpdate} onChange={(e) => setLocationUpdate(e.target.value)} placeholder="Update current location..." style={{ padding: "0.65rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                <button onClick={updateLocation} style={{ border: "none", borderRadius: "6px", padding: "0.65rem 1rem", background: "#334155", color: "white", fontWeight: 600, cursor: "pointer" }}>Update ETA</button>
              </div>

              <div style={{ border: "1px solid #FECACA", background: "#FFFBFB", borderRadius: "8px", padding: "0.9rem" }}>
                <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#7F1D1D" }}>Exception Handling</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "0.5rem" }}>
                  <select value={issueType} onChange={(e) => setIssueType(e.target.value as "breakdown" | "traffic_delay" | "other")} style={{ padding: "0.6rem", border: "1px solid #D1D5DB", borderRadius: "6px" }}>
                    <option value="breakdown">Breakdown</option>
                    <option value="traffic_delay">Traffic Delay</option>
                    <option value="other">Other</option>
                  </select>
                  <input value={issueDetails} onChange={(e) => setIssueDetails(e.target.value)} placeholder="Issue details..." style={{ padding: "0.6rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
                  <button onClick={reportIssue} style={{ border: "none", borderRadius: "6px", padding: "0.6rem 0.9rem", background: "#EF4444", color: "white", fontWeight: 600, cursor: "pointer" }}>Report</button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="card" style={{ padding: "1rem", height: "fit-content" }}>
          <h3 style={{ marginTop: 0 }}>My Jobs</h3>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setActiveJob(job)}
                style={{ border: activeJob?.id === job.id ? "2px solid #3B82F6" : "1px solid #E5E7EB", borderRadius: "8px", background: "white", cursor: "pointer", textAlign: "left", padding: "0.75rem" }}
              >
                <p style={{ margin: "0 0 0.3rem", fontWeight: 700 }}>{job.id}</p>
                <p style={{ margin: "0 0 0.3rem", color: "#666", fontSize: "0.85rem" }}>{job.pickupLocation}</p>
                <WorkflowStatusBadge status={job.status} size="sm" />
              </button>
            ))}
            {jobs.length === 0 && <p style={{ margin: 0, color: "#666" }}>No jobs yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
