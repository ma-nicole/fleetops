"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WorkflowApi, type DriverTripNotificationRow } from "@/lib/workflowApi";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function kindLabel(kind: string): string {
  return kind === "assigned" ? "New trip assigned" : kind === "updated" ? "Trip updated" : kind;
}

const card: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1.15rem 1.25rem",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

type DriverTripNotificationsPanelProps = {
  scheduleHref?: string;
  onRefresh?: () => void;
};

export default function DriverTripNotificationsPanel({
  scheduleHref = "/driver/scheduled-trips",
  onRefresh,
}: DriverTripNotificationsPanelProps) {
  const [rows, setRows] = useState<DriverTripNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await WorkflowApi.driverTripNotifications({ limit: 20 });
      setRows(r.notifications);
      setUnreadCount(r.unread_count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  const markRead = async (id: number) => {
    setBusy(true);
    try {
      await WorkflowApi.driverMarkNotificationRead(id);
      await load();
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark notification read");
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await WorkflowApi.driverMarkAllNotificationsRead();
      await load();
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark all read");
    } finally {
      setBusy(false);
    }
  };

  if (rows.length === 0 && unreadCount === 0 && !error) {
    return null;
  }

  return (
    <article style={card} aria-label="Trip notifications">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.65rem", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 800 }}>Trip notifications</h3>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? "" : "s"}` : "All caught up"}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
          {unreadCount > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void markAllRead()}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                background: "#fff",
                fontWeight: 600,
                fontSize: "0.78rem",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Mark all read
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: 8,
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              fontWeight: 600,
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            {expanded ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error ? (
        <p style={{ margin: "0.75rem 0 0", color: "#B91C1C", fontSize: "0.85rem" }}>{error}</p>
      ) : null}

      {expanded ? (
        <ul style={{ margin: "0.85rem 0 0", padding: 0, listStyle: "none", display: "grid", gap: "0.65rem" }}>
          {rows.length === 0 ? (
            <li style={{ color: "#64748B", fontSize: "0.88rem" }}>No notifications yet.</li>
          ) : (
            rows.map((n) => (
              <li
                key={n.id}
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: 10,
                  border: n.read ? "1px solid #E2E8F0" : "1px solid #FDBA74",
                  background: n.read ? "#FAFAFA" : "#FFFBEB",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.35rem" }}>
                  <strong style={{ fontSize: "0.88rem", color: n.read ? "#334155" : "#C2410C" }}>{kindLabel(n.kind)}</strong>
                  <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{formatWhen(n.created_at)}</span>
                </div>
                <div style={{ marginTop: "0.45rem", fontSize: "0.86rem", color: "#1e293b", display: "grid", gap: 4 }}>
                  <div>
                    <strong>Booking ID:</strong> #{n.booking_id}
                    {n.trip_id ? (
                      <>
                        {" "}
                        · <strong>Trip ID:</strong> #{n.trip_id}
                      </>
                    ) : null}
                  </div>
                  <div>
                    <strong>Schedule:</strong> {n.schedule_summary || "—"}
                  </div>
                  <div>
                    <strong>Route:</strong> {n.route_summary || "—"}
                  </div>
                  <div style={{ marginTop: 2, color: "#475569" }}>
                    <strong>Required action:</strong> {n.required_action}
                  </div>
                </div>
                <div style={{ marginTop: "0.55rem", display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                  <Link
                    href={scheduleHref}
                    onClick={() => {
                      if (!n.read) void markRead(n.id);
                    }}
                    style={{
                      padding: "0.38rem 0.7rem",
                      borderRadius: 8,
                      background: "#FF9800",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      textDecoration: "none",
                    }}
                  >
                    Open Scheduled Bookings
                  </Link>
                  {!n.read ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markRead(n.id)}
                      style={{
                        padding: "0.38rem 0.7rem",
                        borderRadius: 8,
                        border: "1px solid #CBD5E1",
                        background: "#fff",
                        fontWeight: 600,
                        fontSize: "0.78rem",
                        cursor: busy ? "not-allowed" : "pointer",
                      }}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </article>
  );
}
