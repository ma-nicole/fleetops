"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AdminFlowService, type AdminTrip } from "@/lib/adminFlowService";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function tripIdSortKey(id: string): number {
  const m = id.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

const STATUS_SORT_ORDER: Record<AdminTrip["status"], number> = {
  enroute: 0,
  delayed: 1,
  completed: 2,
};

type SortKey = "trip" | "eta" | "status";

export default function AdminTripMonitoringPage() {
  useRoleGuard(["admin", "manager"]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setTrips(AdminFlowService.getTrips());
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  };

  const sortedTrips = useMemo(() => {
    if (!sortKey) return trips;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...trips].sort((a, b) => {
      if (sortKey === "trip") {
        const na = tripIdSortKey(a.id);
        const nb = tripIdSortKey(b.id);
        if (na !== nb) return (na - nb) * dir;
        return a.id.localeCompare(b.id) * dir;
      }
      if (sortKey === "eta") {
        const ea = timeToMinutes(a.eta);
        const eb = timeToMinutes(b.eta);
        return (ea - eb) * dir;
      }
      const oa = STATUS_SORT_ORDER[a.status];
      const ob = STATUS_SORT_ORDER[b.status];
      if (oa !== ob) return (oa - ob) * dir;
      return a.id.localeCompare(b.id) * dir;
    });
  }, [trips, sortKey, sortDir]);

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

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/admin/payment-approval" style={{ color: "#0EA5E9", textDecoration: "none" }}>← Payment approval</Link>
            <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Trip Execution & Monitoring</h1>
          </div>
          <Link href="/admin/orders" style={{ textDecoration: "none", background: "#3B82F6", color: "white", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: 600 }}>Next: Orders</Link>
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E8E8E8" }}>
                <th style={{ padding: "0.75rem", textAlign: "left" }} aria-sort={sortKey === "trip" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" style={thBtn} onClick={() => toggleSort("trip")}>
                    Trip
                    <span style={{ fontSize: "0.85rem", opacity: sortKey === "trip" ? 1 : 0.35 }} aria-hidden>
                      {sortKey === "trip" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                    </span>
                  </button>
                </th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Driver</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Vehicle</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Location</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }} aria-sort={sortKey === "eta" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" style={thBtn} onClick={() => toggleSort("eta")}>
                    ETA
                    <span style={{ fontSize: "0.85rem", opacity: sortKey === "eta" ? 1 : 0.35 }} aria-hidden>
                      {sortKey === "eta" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
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
              {sortedTrips.map((trip) => (
                <tr key={trip.id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 700 }}>{trip.id}</td>
                  <td style={{ padding: "0.75rem" }}>{trip.driver}</td>
                  <td style={{ padding: "0.75rem" }}>{trip.vehicle}</td>
                  <td style={{ padding: "0.75rem" }}>{trip.location}</td>
                  <td style={{ padding: "0.75rem" }}>{trip.eta}</td>
                  <td style={{ padding: "0.75rem", textTransform: "capitalize" }}>{trip.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
