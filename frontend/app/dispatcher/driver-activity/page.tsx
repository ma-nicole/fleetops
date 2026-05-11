"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { announce } from "@/lib/useAnnouncer";
import { DispatchApi, type DispatcherDashboardResponse } from "@/lib/dispatchApi";
import { WorkflowApi } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

type BoardAssignment = {
  trip_id: number;
  trip_status: string;
  driver_id: number | null;
  pickup_location: string;
  dropoff_location: string;
  distance_km: number;
  current_latitude: number | null;
  current_longitude: number | null;
};

type DriverActivity = {
  driverId: string;
  driverName: string;
  contactPhone: string;
  contactPhoneE164: string;
  status: "available" | "on_trip" | "on_break" | "completed_shift";
  currentLocation: string;
  distanceTraveledToday: string;
  tripCount: number;
  lastActivity: string;
  uptime: string;
  rating: number | null;
};

function googleMapsSearchUrl(place: string): string {
  const query = encodeURIComponent(`${place.trim()}, Philippines`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function tripActive(status: string): boolean {
  return !["completed", "cancelled"].includes(status);
}

export default function DriverActivityPage() {
  useRoleGuard(["dispatcher", "manager", "admin"]);
  const router = useRouter();

  const [activities, setActivities] = useState<DriverActivity[]>([]);
  const [dashboard, setDashboard] = useState<DispatcherDashboardResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contactFor, setContactFor] = useState<DriverActivity | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadError(null);
      try {
        const [dash, roster, board] = await Promise.all([
          DispatchApi.dashboard(),
          WorkflowApi.dispatchRoster(),
          WorkflowApi.dispatchAssignmentsBoard(),
        ]);
        if (cancelled) return;
        setDashboard(dash);
        const assignments: BoardAssignment[] = (board.assignments as BoardAssignment[]) ?? [];
        const drivers = roster.drivers ?? [];
        const built: DriverActivity[] = drivers.map((d) => {
          const row = assignments.find((a) => a.driver_id === d.id && tripActive(a.trip_status));
          const gps =
            row && row.current_latitude != null && row.current_longitude != null
              ? `${row.current_latitude.toFixed(4)}, ${row.current_longitude.toFixed(4)}`
              : null;
          const routeHint =
            row != null
              ? `${row.pickup_location.slice(0, 48)}${row.pickup_location.length > 48 ? "…" : ""} → ${row.dropoff_location.slice(0, 48)}${row.dropoff_location.length > 48 ? "…" : ""}`
              : null;
          return {
            driverId: String(d.id),
            driverName: d.name,
            contactPhone: "Not on file",
            contactPhoneE164: "",
            status: row ? "on_trip" : "available",
            currentLocation: gps || routeHint || "—",
            distanceTraveledToday: row ? `${row.distance_km} km (est.)` : "—",
            tripCount: row ? 1 : 0,
            lastActivity: row ? `Trip #${row.trip_id} · ${row.trip_status}` : "No active trip",
            uptime: "—",
            rating: null,
          };
        });
        setActivities(built);
      } catch (e) {
        if (!cancelled) {
          setActivities([]);
          setDashboard(null);
          setLoadError(e instanceof Error ? e.message : "Could not load driver activity.");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!contactFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContactFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contactFor]);

  useEffect(() => {
    if (!copyFeedback) return;
    const t = window.setTimeout(() => setCopyFeedback(null), 2200);
    return () => window.clearTimeout(t);
  }, [copyFeedback]);

  const openLocation = (activity: DriverActivity) => {
    if (activity.currentLocation === "—" || !activity.currentLocation.trim()) {
      announce("No location available for this driver yet.");
      return;
    }
    const url = googleMapsSearchUrl(activity.currentLocation);
    window.open(url, "_blank", "noopener,noreferrer");
    announce(`Opening map near ${activity.currentLocation}.`);
  };

  const telHref = (e164: string) => `tel:${e164.replace(/\s/g, "")}`;
  const smsHref = (e164: string, body: string) =>
    `sms:${e164.replace(/\s/g, "")}?body=${encodeURIComponent(body)}`;

  const copyPhone = async (activity: DriverActivity) => {
    const raw = activity.contactPhoneE164.replace(/\s/g, "");
    if (!raw) {
      setCopyFeedback("No phone number stored for this user.");
      return;
    }
    try {
      await navigator.clipboard.writeText(raw);
      setCopyFeedback("Copied to clipboard.");
      announce(`Phone number copied for ${activity.driverName}.`);
    } catch {
      setCopyFeedback("Could not copy — select the number manually.");
      announce("Could not copy phone number.", "assertive");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "#4CAF50";
      case "on_trip":
        return "#FF6B6B";
      case "on_break":
        return "#FF9800";
      case "completed_shift":
        return "#2196F3";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "✓ Available";
      case "on_trip":
        return " On Trip";
      case "on_break":
        return " On Break";
      case "completed_shift":
        return " Shift Complete";
      default:
        return "Unknown";
    }
  };

  const actionsRowStyle: CSSProperties = {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
    position: "relative",
    zIndex: 2,
    isolation: "isolate",
    marginTop: 2,
  };

  const btnBase: CSSProperties = {
    padding: "0.5rem 1rem",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.85rem",
  };

  const kpi = dashboard?.kpis;

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Driver activity</h1>
        <p style={{ color: "#666666", margin: "0" }}>Crew roster with live trip assignment context (no mock contacts).</p>
      </div>

      {loadError ? (
        <div style={{ padding: "1rem", background: "#FEE2E2", color: "#991B1B", borderRadius: "8px" }}>{loadError}</div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ACTIVE TRIPS</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {kpi?.active_trips ?? "—"}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DRIVERS BUSY</p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {kpi?.drivers_busy ?? "—"}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DRIVERS IDLE</p>
          <p style={{ color: "#2196F3", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {kpi?.drivers_idle ?? "—"}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(158, 158, 158, 0.08), rgba(158, 158, 158, 0.04))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PENDING ORDERS</p>
          <p style={{ color: "#616161", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {kpi?.pending_orders ?? "—"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        {activities.length === 0 && !loadError ? (
          <div
            style={{
              padding: "2rem",
              border: "1px solid #E8E8E8",
              borderRadius: "8px",
              color: "#666",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0 }}>No drivers in roster. Add driver users and refresh.</p>
          </div>
        ) : null}
        {activities.map((activity) => (
          <div
            key={activity.driverId}
            style={{
              padding: "1.5rem",
              border: `2px solid ${getStatusColor(activity.status)}`,
              borderRadius: "8px",
              background: "#F9F9F9",
              position: "relative",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1.5rem", marginBottom: "1rem", alignItems: "center" }}>
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0" }}>{activity.driverName}</h3>
                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  ID {activity.driverId}
                  {activity.rating != null ? ` · ★ ${activity.rating}` : ""}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LOCATION / ROUTE</p>
                <p style={{ color: "#2196F3", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{activity.currentLocation}</p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TRIP CONTEXT</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {activity.distanceTraveledToday} · {activity.tripCount} active
                </p>
              </div>

              <span
                style={{
                  padding: "0.4rem 0.75rem",
                  background: getStatusColor(activity.status) + "20",
                  color: getStatusColor(activity.status),
                  borderRadius: "4px",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                }}
              >
                {getStatusLabel(activity.status)}
              </span>
            </div>

            <div
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #E8E8E8",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LAST ACTIVITY</p>
                  <p style={{ color: "#1A1A1A", fontSize: "0.9rem", margin: "0.25rem 0 0 0" }}>{activity.lastActivity}</p>
                </div>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>UPTIME</p>
                  <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{activity.uptime}</p>
                </div>
              </div>
            </div>

            <div style={actionsRowStyle}>
              <button type="button" style={{ ...btnBase, background: "#2196F3" }} onClick={() => openLocation(activity)}>
                View location
              </button>
              <button type="button" style={{ ...btnBase, background: "#FF9800" }} onClick={() => setContactFor(activity)}>
                Contact
              </button>
              {activity.status === "available" && (
                <button
                  type="button"
                  style={{ ...btnBase, background: "#4CAF50" }}
                  onClick={() => {
                    const q = new URLSearchParams({
                      fromDriver: activity.driverId,
                      driverName: activity.driverName,
                    });
                    announce(`Opening Job Assignment for ${activity.driverName}.`);
                    router.push(`/dispatcher/job-assignments?${q.toString()}`);
                  }}
                >
                  Assign trip
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {contactFor ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setContactFor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-driver-title"
            style={{
              background: "#fff",
              borderRadius: "12px",
              maxWidth: "420px",
              width: "100%",
              padding: "1.25rem",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="contact-driver-title" style={{ margin: "0 0 0.35rem", fontSize: "1.15rem", color: "#1A1A1A" }}>
              Contact driver
            </h2>
            <p style={{ margin: "0 0 1rem", color: "#666", fontSize: "0.95rem" }}>
              <strong>{contactFor.driverName}</strong>
              <span style={{ color: "#999" }}> · {contactFor.driverId}</span>
            </p>
            <p style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.02em" }}>
              {contactFor.contactPhone}
            </p>
            <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#888" }}>
              Phone numbers are shown when stored on the user profile. Integrate your directory or HR export as needed.
            </p>
            {contactFor.contactPhoneE164 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <a
                  href={telHref(contactFor.contactPhoneE164)}
                  style={{
                    ...btnBase,
                    background: "#2196F3",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Call
                </a>
                <a
                  href={smsHref(contactFor.contactPhoneE164, `FleetOps dispatcher — reply when safe. (${contactFor.driverId})`)}
                  style={{
                    ...btnBase,
                    background: "#FF9800",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  SMS
                </a>
                <button type="button" style={{ ...btnBase, background: "#455A64" }} onClick={() => copyPhone(contactFor)}>
                  Copy number
                </button>
              </div>
            ) : null}
            {copyFeedback ? <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "#2E7D32" }}>{copyFeedback}</p> : null}
            <button
              type="button"
              onClick={() => setContactFor(null)}
              style={{
                width: "100%",
                padding: "0.65rem",
                borderRadius: "6px",
                border: "1px solid #E0E0E0",
                background: "#FAFAFA",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
