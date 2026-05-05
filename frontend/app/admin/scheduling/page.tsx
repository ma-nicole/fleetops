"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AdminFlowService, AdminSchedule } from "@/lib/adminFlowService";

export default function AdminSchedulingPage() {
  useRoleGuard(["admin", "manager"]);
  const [schedules, setSchedules] = useState<AdminSchedule[]>([]);
  const [pickup, setPickup] = useState("Makati");
  const [dropoff, setDropoff] = useState("Quezon City");
  const [driver, setDriver] = useState("driver-001");
  const [vehicle, setVehicle] = useState("TRK-001");
  const [startTime, setStartTime] = useState("08:00");
  const [eta, setEta] = useState("10:00");
  const LOCATION_OPTIONS = [
    "Makati",
    "Quezon City",
    "Pasig",
    "Taguig",
    "Paranaque",
    "Manila",
  ];

  useEffect(() => {
    setSchedules(AdminFlowService.getSchedules());
  }, []);

  const saveSchedule = () => {
    if (!pickup.trim() || !dropoff.trim()) return;
    if (pickup === dropoff) return;
    const route = `${pickup.trim()} → ${dropoff.trim()}`;
    const next: AdminSchedule = {
      id: `SCH-${String(schedules.length + 1).padStart(3, "0")}`,
      route,
      driver,
      vehicle,
      startTime,
      eta,
      status: "scheduled",
    };
    const updated = [next, ...schedules];
    setSchedules(updated);
    AdminFlowService.saveSchedules(updated);
    setPickup(LOCATION_OPTIONS[0]);
    setDropoff(LOCATION_OPTIONS[1]);
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/admin/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>← Admin Dashboard</Link>
            <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Scheduling</h1>
          </div>
          <Link href="/admin/trip-monitoring" style={{ textDecoration: "none", background: "#3B82F6", color: "white", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: 600 }}>Next: Trip Monitoring</Link>
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem", display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr auto", gap: "0.6rem" }}>
          <label style={{ display: "grid", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>Pickup</span>
            <select value={pickup} onChange={(e) => setPickup(e.target.value)} style={{ padding: "0.65rem", border: "1px solid #D1D5DB", borderRadius: "6px" }}>
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>Dropoff</span>
            <select value={dropoff} onChange={(e) => setDropoff(e.target.value)} style={{ padding: "0.65rem", border: "1px solid #D1D5DB", borderRadius: "6px" }}>
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>Driver</span>
            <select value={driver} onChange={(e) => setDriver(e.target.value)} style={{ padding: "0.65rem", border: "1px solid #D1D5DB", borderRadius: "6px" }}>
              <option>driver-001</option><option>driver-002</option><option>driver-003</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>Truck</span>
            <select value={vehicle} onChange={(e) => setVehicle(e.target.value)} style={{ padding: "0.65rem", border: "1px solid #D1D5DB", borderRadius: "6px" }}>
              <option>TRK-001</option><option>TRK-002</option><option>TRK-003</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>Start</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ padding: "0.65rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
          </label>
          <label style={{ display: "grid", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>ETA</span>
            <input type="time" value={eta} onChange={(e) => setEta(e.target.value)} style={{ padding: "0.65rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
          </label>
          <button onClick={saveSchedule} style={{ border: "none", borderRadius: "6px", background: "#10B981", color: "white", fontWeight: 600, padding: "0.65rem 0.9rem", cursor: "pointer", alignSelf: "end" }}>Save</button>
        </section>
        {pickup === dropoff && (
          <p style={{ margin: 0, color: "#B91C1C", fontSize: "0.9rem" }}>
            Pickup and dropoff cannot be the same location.
          </p>
        )}

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E8E8E8" }}>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Schedule</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Route</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Driver</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Vehicle</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Start/ETA</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Status</th>
            </tr></thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 700 }}>{s.id}</td><td style={{ padding: "0.75rem" }}>{s.route}</td><td style={{ padding: "0.75rem" }}>{s.driver}</td><td style={{ padding: "0.75rem" }}>{s.vehicle}</td><td style={{ padding: "0.75rem" }}>{s.startTime} / {s.eta}</td><td style={{ padding: "0.75rem", textTransform: "capitalize" }}>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

