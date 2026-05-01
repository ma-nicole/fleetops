"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WorkflowApi } from "@/lib/workflowApi";

type DayCell = {
  date: string;
  weekday: string;
  activity?: {
    trip_id: number;
    booking_id?: number;
    truck_id?: number;
    status: string;
    pickup?: string;
    dropoff?: string;
    route?: string;
  } | null;
};

type TruckRow = {
  truck_id: number;
  code: string;
  capacity_tons: number;
  status: string;
  days: DayCell[];
};

type DriverRow = {
  driver_id: number;
  name: string;
  days: DayCell[];
};

export default function WeekBoardPage() {
  const [tab, setTab] = useState<"trucks" | "drivers">("trucks");
  const [trucks, setTrucks] = useState<TruckRow[] | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, d] = await Promise.all([
          WorkflowApi.scheduleTrucks() as Promise<{ trucks: TruckRow[]; week_start: string }>,
          WorkflowApi.scheduleDrivers() as Promise<{ drivers: DriverRow[]; week_start: string }>,
        ]);
        if (!alive) return;
        setTrucks(t.trucks);
        setDrivers(d.drivers);
        setWeekStart(t.week_start);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load schedule");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const cellStyle: React.CSSProperties = {
    border: "1px solid #E5E7EB",
    padding: 8,
    minHeight: 70,
    fontSize: 13,
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 20 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ margin: 0 }}>Weekly Schedule Board</h1>
            <p style={{ margin: "6px 0 0", color: "#6B7280" }}>
              Paper Fig 16 / 17 — truck × day and driver × day matrices for {weekStart || "this week"}.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setTab("trucks")}
              style={tabStyle(tab === "trucks")}
            >
              Trucks
            </button>
            <button
              onClick={() => setTab("drivers")}
              style={tabStyle(tab === "drivers")}
            >
              Drivers
            </button>
          </div>
        </header>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>
            {error}
          </div>
        )}

        {tab === "trucks" && trucks && (
          <div style={{ overflow: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...cellStyle, background: "#F3F4F6", textAlign: "left" }}>Truck</th>
                  {trucks[0]?.days.map((d) => (
                    <th key={d.date} style={{ ...cellStyle, background: "#F3F4F6" }}>
                      {d.weekday}
                      <br />
                      <small>{d.date.slice(5)}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trucks.map((row) => (
                  <tr key={row.truck_id}>
                    <td style={{ ...cellStyle, fontWeight: 700 }}>
                      {row.code}
                      <br />
                      <small>
                        {row.capacity_tons}t · {row.status}
                      </small>
                    </td>
                    {row.days.map((d) => (
                      <td key={d.date} style={cellStyle}>
                        {d.activity ? (
                          <Link
                            href={`/trips/${d.activity.trip_id}/track`}
                            style={{
                              display: "block",
                              background: statusColor(d.activity.status),
                              color: "white",
                              padding: 4,
                              borderRadius: 4,
                              textDecoration: "none",
                            }}
                          >
                            #{d.activity.trip_id}
                            <br />
                            {d.activity.pickup} → {d.activity.dropoff}
                            <br />
                            <small>{d.activity.status}</small>
                          </Link>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "drivers" && drivers && (
          <div style={{ overflow: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...cellStyle, background: "#F3F4F6", textAlign: "left" }}>Driver</th>
                  {drivers[0]?.days.map((d) => (
                    <th key={d.date} style={{ ...cellStyle, background: "#F3F4F6" }}>
                      {d.weekday}
                      <br />
                      <small>{d.date.slice(5)}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drivers.map((row) => (
                  <tr key={row.driver_id}>
                    <td style={{ ...cellStyle, fontWeight: 700 }}>{row.name}</td>
                    {row.days.map((d) => (
                      <td key={d.date} style={cellStyle}>
                        {d.activity ? (
                          <Link
                            href={`/trips/${d.activity.trip_id}/track`}
                            style={{
                              display: "block",
                              background: statusColor(d.activity.status),
                              color: "white",
                              padding: 4,
                              borderRadius: 4,
                              textDecoration: "none",
                            }}
                          >
                            #{d.activity.trip_id}
                            <br />
                            {d.activity.route}
                            <br />
                            <small>{d.activity.status}</small>
                          </Link>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    border: "1px solid #D1D5DB",
    background: active ? "#0EA5E9" : "white",
    color: active ? "white" : "#111827",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  };
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "#10B981";
    case "cancelled":
      return "#9CA3AF";
    case "in_delivery":
    case "departed":
      return "#0EA5E9";
    case "loading":
      return "#F59E0B";
    case "assigned":
      return "#7C3AED";
    case "accepted":
      return "#3B82F6";
    default:
      return "#6B7280";
  }
}
