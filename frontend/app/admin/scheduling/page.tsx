"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AdminFlowService, type AdminSchedule } from "@/lib/adminFlowService";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

const STATUS_SORT_ORDER: Record<AdminSchedule["status"], number> = {
  scheduled: 0,
  enroute: 1,
  completed: 2,
};

function routeMatchesFilter(route: string, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const r = route.toLowerCase();
  if (r.includes(q)) return true;
  if ((q === "qc" || q === "q.c.") && r.includes("quezon")) return true;
  return false;
}

type SortKey = "startEta" | "status";

export default function AdminSchedulingPage() {
  useRoleGuard(["admin", "manager"]);
  const [schedules, setSchedules] = useState<AdminSchedule[]>([]);
  const [pickup, setPickup] = useState("Makati");
  const [dropoff, setDropoff] = useState("Quezon City");
  const [driver, setDriver] = useState("driver-001");
  const [vehicle, setVehicle] = useState("TRK-001");
  const [startTime, setStartTime] = useState("08:00");
  const [eta, setEta] = useState("10:00");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminSchedule["status"]>("all");
  const [routeFilter, setRouteFilter] = useState("");
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

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = schedules;
    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }
    const q = routeFilter.trim();
    if (q) {
      list = list.filter((s) => routeMatchesFilter(s.route, q));
    }
    if (!sortKey) return list;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "startEta") {
        const sa = timeToMinutes(a.startTime);
        const sb = timeToMinutes(b.startTime);
        if (sa !== sb) return (sa - sb) * dir;
        return (timeToMinutes(a.eta) - timeToMinutes(b.eta)) * dir;
      }
      const oa = STATUS_SORT_ORDER[a.status];
      const ob = STATUS_SORT_ORDER[b.status];
      if (oa !== ob) return (oa - ob) * dir;
      return a.id.localeCompare(b.id) * dir;
    });
  }, [schedules, statusFilter, routeFilter, sortKey, sortDir]);

  const thBtn: React.CSSProperties = {
    border: "none",
    background: "transparent",
    padding: 0,
    font: "inherit",
    fontWeight: 600,
    color: "#111827",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
  };

  const selectFilterStyle: React.CSSProperties = {
    padding: "0.5rem 0.65rem",
    border: "1px solid #D1D5DB",
    borderRadius: "6px",
    fontSize: "0.9rem",
    minWidth: 140,
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
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

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: "1rem",
            padding: "1rem",
            background: "white",
            border: "1px solid #E8E8E8",
            borderRadius: "10px",
          }}
        >
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>Filter by status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              style={selectFilterStyle}
              aria-label="Filter schedules by status"
            >
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled (not started)</option>
              <option value="enroute">Enroute (on the way)</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.35rem", flex: "1 1 200px" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>Filter by route / location</span>
            <input
              type="search"
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              placeholder="e.g. Quezon City, QC, Makati…"
              style={{
                padding: "0.5rem 0.65rem",
                border: "1px solid #D1D5DB",
                borderRadius: "6px",
                fontSize: "0.9rem",
                width: "100%",
                maxWidth: 320,
              }}
              aria-label="Filter routes containing this text"
            />
          </label>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#6B7280", alignSelf: "center" }}>
            Showing <strong>{filteredAndSorted.length}</strong> of {schedules.length}
            {statusFilter !== "all" || routeFilter.trim() ? " (filtered)" : ""}
          </p>
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E8E8E8" }}>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Schedule</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Route</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Driver</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Vehicle</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }} aria-sort={sortKey === "startEta" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" style={thBtn} onClick={() => toggleSort("startEta")}>
                    Start/ETA
                    <span style={{ fontSize: "0.85rem", opacity: sortKey === "startEta" ? 1 : 0.35 }} aria-hidden>
                      {sortKey === "startEta" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                    </span>
                  </button>
                </th>
                <th style={{ padding: "0.75rem", textAlign: "left" }} aria-sort={sortKey === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" style={thBtn} onClick={() => toggleSort("status")}>
                    Status
                    <span style={{ fontSize: "0.85rem", opacity: sortKey === "status" ? 1 : 0.35 }} aria-hidden>
                      {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
                    No schedules match your filters. Try &ldquo;All statuses&rdquo; or clear the route search.
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 700 }}>{s.id}</td><td style={{ padding: "0.75rem" }}>{s.route}</td><td style={{ padding: "0.75rem" }}>{s.driver}</td><td style={{ padding: "0.75rem" }}>{s.vehicle}</td><td style={{ padding: "0.75rem" }}>{s.startTime} / {s.eta}</td><td style={{ padding: "0.75rem", textTransform: "capitalize" }}>{s.status}</td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

