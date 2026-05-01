"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { announce } from "@/lib/useAnnouncer";

type DriverActivity = {
  driverId: string;
  driverName: string;
  /** Display label for SMS / UI */
  contactPhone: string;
  /** E.164 without spaces, e.g. +639171234567 */
  contactPhoneE164: string;
  status: string;
  currentLocation: string;
  distanceTraveledToday: string;
  tripCount: number;
  lastActivity: string;
  uptime: string;
  rating: number;
};

function googleMapsSearchUrl(place: string): string {
  const query = encodeURIComponent(`${place.trim()}, Philippines`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export default function DriverActivityPage() {
  const router = useRouter();
  const [activities] = useState<DriverActivity[]>([
    {
      driverId: "DRV-001",
      driverName: "Carlos Rodriguez",
      contactPhone: "+63 917 123 4567",
      contactPhoneE164: "+639171234567",
      status: "on_trip",
      currentLocation: "EDSA, Makati",
      distanceTraveledToday: "85 km",
      tripCount: 3,
      lastActivity: "Started Trip TRIP-001 at 09:30 AM",
      uptime: "8 hours 30 minutes",
      rating: 4.8,
    },
    {
      driverId: "DRV-002",
      driverName: "Maria Santos",
      contactPhone: "+63 918 987 6543",
      contactPhoneE164: "+639189876543",
      status: "on_trip",
      currentLocation: "Quezon City",
      distanceTraveledToday: "62 km",
      tripCount: 2,
      lastActivity: "Arrived at pickup location at 10:45 AM",
      uptime: "6 hours 20 minutes",
      rating: 4.6,
    },
    {
      driverId: "DRV-003",
      driverName: "Juan Dela Cruz",
      contactPhone: "+63 919 555 0199",
      contactPhoneE164: "+639195550199",
      status: "on_break",
      currentLocation: "Caloocan Rest Area",
      distanceTraveledToday: "45 km",
      tripCount: 2,
      lastActivity: "Took break at 01:00 PM",
      uptime: "4 hours 15 minutes",
      rating: 4.7,
    },
    {
      driverId: "DRV-004",
      driverName: "Rita Gonzales",
      contactPhone: "+63 920 444 7722",
      contactPhoneE164: "+639204447722",
      status: "available",
      currentLocation: "Warehouse",
      distanceTraveledToday: "0 km",
      tripCount: 0,
      lastActivity: "Checked in at 07:00 AM",
      uptime: "2 hours (waiting for assignment)",
      rating: 4.5,
    },
    {
      driverId: "DRV-005",
      driverName: "Miguel Reyes",
      contactPhone: "+63 921 333 8811",
      contactPhoneE164: "+639213338811",
      status: "completed_shift",
      currentLocation: "Main Office",
      distanceTraveledToday: "145 km",
      tripCount: 5,
      lastActivity: "Completed shift at 05:00 PM",
      uptime: "10 hours",
      rating: 4.9,
    },
  ]);

  const [contactFor, setContactFor] = useState<DriverActivity | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

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
    const url = googleMapsSearchUrl(activity.currentLocation);
    window.open(url, "_blank", "noopener,noreferrer");
    announce(`Opening map for ${activity.driverName} near ${activity.currentLocation}.`);
  };

  const telHref = (e164: string) => `tel:${e164.replace(/\s/g, "")}`;
  const smsHref = (e164: string, body: string) =>
    `sms:${e164.replace(/\s/g, "")}?body=${encodeURIComponent(body)}`;

  const copyPhone = async (activity: DriverActivity) => {
    const raw = activity.contactPhoneE164.replace(/\s/g, "");
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

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Driver Activity Tracking</h1>
        <p style={{ color: "#666666", margin: "0" }}>Monitor real-time driver location and activity</p>
      </div>

      {/* Activity Summary */}
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
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ON TRIP</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {activities.filter((a) => a.status === "on_trip").length}
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
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>AVAILABLE</p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {activities.filter((a) => a.status === "available").length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ON BREAK</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {activities.filter((a) => a.status === "on_break").length}
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
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>SHIFT COMPLETE</p>
          <p style={{ color: "#2196F3", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {activities.filter((a) => a.status === "completed_shift").length}
          </p>
        </div>
      </div>

      {/* Activity List */}
      <div style={{ display: "grid", gap: "1rem" }}>
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
                  {activity.driverId} • ★ {activity.rating}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LOCATION</p>
                <p style={{ color: "#2196F3", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{activity.currentLocation}</p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TODAY'S ACTIVITY</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {activity.distanceTraveledToday} • {activity.tripCount} trips
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
              <button
                type="button"
                style={{ ...btnBase, background: "#2196F3" }}
                onClick={() => openLocation(activity)}
              >
                View Location
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
                  Assign Trip
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
              Demo numbers for prototyping. Replace with your directory or telephony integration.
            </p>
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
                href={smsHref(contactFor.contactPhoneE164, `FleetOpt dispatcher — reply when safe. (${contactFor.driverId})`)}
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
