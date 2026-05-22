"use client";

import type { CSSProperties } from "react";
import type { CrewAssignedBookingRow, Trip } from "@/lib/workflowApi";

export type SchedulingPlotData = {
  assigned_at: string | null;
  pickup_date: string | null;
  pickup_time_slot: string | null;
  pickup_location: string;
  delivery_at: string | null;
  delivery_location: string;
  route_waypoints: string[];
  route_distance_km: number;
  duration_hours: number;
  truck_code: string | null;
  truck_model: string | null;
  driver_name: string | null;
  helper_name: string | null;
  status: string;
  trip_status: string;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function parseRouteWaypoints(routePath: string | null | undefined, pickup: string, dropoff: string): string[] {
  const raw = (routePath || "").trim();
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        const strs = arr.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
        if (strs.length) return strs;
      }
    } catch {
      /* ignore */
    }
  }
  if (raw.includes("->")) {
    const parts = raw.split("->").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts;
  }
  if (raw) return [raw];
  if (pickup && dropoff) return [pickup, dropoff];
  return [];
}

export function schedulingPlotFromCrewRow(row: CrewAssignedBookingRow): SchedulingPlotData {
  if (row.scheduling_plot) return row.scheduling_plot;
  const bk = row.booking;
  const pickup = bk?.pickup_location ?? "";
  const dropoff = bk?.dropoff_location ?? "";
  const waypoints = row.route_waypoints?.length
    ? row.route_waypoints
    : parseRouteWaypoints(row.route_path, pickup, dropoff);
  return {
    assigned_at: row.assigned_at ?? null,
    pickup_date: bk?.scheduled_date ?? null,
    pickup_time_slot: bk?.scheduled_time_slot ?? null,
    pickup_location: pickup,
    delivery_at: row.estimated_delivery_time ?? null,
    delivery_location: dropoff,
    route_waypoints: waypoints,
    route_distance_km: row.road_distance_km ?? row.distance_km ?? 0,
    duration_hours: row.duration_hours ?? 0,
    truck_code: row.truck?.code ?? null,
    truck_model: row.truck?.model_name ?? null,
    driver_name: row.driver_name ?? null,
    helper_name: row.helper_name ?? null,
    status: row.operational_status || row.helper_progress_status || row.trip_status,
    trip_status: row.trip_status,
  };
}

export function schedulingPlotFromTrip(t: Trip): SchedulingPlotData {
  const bk = t.booking;
  const pickup = bk?.pickup_location ?? "";
  const dropoff = bk?.dropoff_location ?? "";
  const waypoints = parseRouteWaypoints(t.route_path, pickup, dropoff);
  return {
    assigned_at: t.assigned_at,
    pickup_date: bk?.scheduled_date ?? null,
    pickup_time_slot: bk?.scheduled_time_slot ?? null,
    pickup_location: pickup,
    delivery_at: t.estimated_delivery_time,
    delivery_location: dropoff,
    route_waypoints: waypoints,
    route_distance_km: t.road_distance_km ?? t.distance_km ?? 0,
    duration_hours: t.duration_hours ?? 0,
    truck_code: t.truck?.code ?? null,
    truck_model: t.truck?.model_name ?? null,
    driver_name: t.driver_name ?? null,
    helper_name: t.helper_name ?? null,
    status: (t.operational_status || t.helper_progress_status || t.status || "").toLowerCase(),
    trip_status: t.status,
  };
}

const plotCard: CSSProperties = {
  padding: "1rem 1.1rem",
  border: "2px solid #FF9800",
  borderRadius: 12,
  background: "linear-gradient(180deg, rgba(255,152,0,0.06) 0%, #FFFBF5 100%)",
  marginBottom: "1rem",
};

const stepDot: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#FF9800",
  flexShrink: 0,
  marginTop: 4,
};

const stepLine: CSSProperties = {
  width: 2,
  flex: 1,
  minHeight: 12,
  background: "#FDBA74",
  marginLeft: 4,
};

const stepLabel: CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 800,
  letterSpacing: "0.06em",
  color: "#C2410C",
  textTransform: "uppercase",
};

const stepBody: CSSProperties = {
  fontSize: "0.88rem",
  color: "#1e293b",
  lineHeight: 1.45,
};

type CrewSchedulingPlotPanelProps = {
  plot: SchedulingPlotData;
  title?: string;
};

export default function CrewSchedulingPlotPanel({ plot, title = "Schedule & assignment plot" }: CrewSchedulingPlotPanelProps) {
  const truckLine = [plot.truck_code, plot.truck_model?.trim()].filter(Boolean).join(" · ") || "—";
  const deliverySchedule = plot.delivery_at
    ? formatWhen(plot.delivery_at)
    : plot.pickup_date
      ? `${formatDateOnly(plot.pickup_date)}${plot.pickup_time_slot ? ` · ${plot.pickup_time_slot}` : ""} (booking window)`
      : "—";

  const steps = [
    {
      key: "assigned",
      label: "Assigned",
      body: (
        <>
          <div style={{ fontWeight: 700 }}>{formatWhen(plot.assigned_at)}</div>
          <div style={{ color: "#64748B", fontSize: "0.82rem" }}>Trip assigned to crew</div>
        </>
      ),
    },
    {
      key: "pickup",
      label: "Pickup schedule",
      body: (
        <>
          <div style={{ fontWeight: 700 }}>
            {formatDateOnly(plot.pickup_date)}
            {plot.pickup_time_slot ? ` · ${plot.pickup_time_slot}` : ""}
          </div>
          <div style={{ marginTop: 4 }}>{plot.pickup_location || "—"}</div>
        </>
      ),
    },
    {
      key: "route",
      label: "Route",
      body: (
        <>
          <div style={{ fontWeight: 700 }}>
            {Math.round(plot.route_distance_km * 10) / 10} km
            {plot.duration_hours > 0 ? ` · ~${plot.duration_hours} hr` : ""}
          </div>
          {plot.route_waypoints.length > 0 ? (
            <ol style={{ margin: "0.45rem 0 0", paddingLeft: "1.15rem", fontSize: "0.84rem", color: "#475569" }}>
              {plot.route_waypoints.map((wp, i) => (
                <li key={`${i}-${wp.slice(0, 24)}`} style={{ marginBottom: 2 }}>
                  {wp}
                </li>
              ))}
            </ol>
          ) : (
            <div style={{ marginTop: 4, color: "#64748B", fontSize: "0.82rem" }}>Route path not set yet</div>
          )}
        </>
      ),
    },
    {
      key: "delivery",
      label: "Delivery schedule",
      body: (
        <>
          <div style={{ fontWeight: 700 }}>{deliverySchedule}</div>
          <div style={{ marginTop: 4 }}>{plot.delivery_location || "—"}</div>
        </>
      ),
    },
    {
      key: "resources",
      label: "Truck · helper · status",
      body: (
        <div style={{ display: "grid", gap: 4 }}>
          <div>
            <strong>Truck:</strong> {truckLine}
          </div>
          <div>
            <strong>Helper:</strong> {plot.helper_name ?? "—"}
          </div>
          <div>
            <strong>Status:</strong>{" "}
            <span
              style={{
                display: "inline-block",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "0.15rem 0.5rem",
                borderRadius: 999,
                background: "#FFF7ED",
                color: "#C2410C",
                border: "1px solid #FDBA74",
                textTransform: "lowercase",
              }}
            >
              {plot.status || plot.trip_status}
            </span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section style={plotCard} aria-label={title}>
      <h3 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", fontWeight: 800, color: "#C2410C" }}>{title}</h3>
      <div style={{ display: "grid", gap: 0 }}>
        {steps.map((step, idx) => (
          <div key={step.key} style={{ display: "flex", gap: "0.75rem", alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 18 }}>
              <div style={stepDot} />
              {idx < steps.length - 1 ? <div style={stepLine} /> : null}
            </div>
            <div style={{ paddingBottom: idx < steps.length - 1 ? "0.85rem" : 0, flex: 1 }}>
              <div style={stepLabel}>{step.label}</div>
              <div style={stepBody}>{step.body}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
