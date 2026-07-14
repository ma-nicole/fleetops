"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkflowApi, type CustomerNotificationRow } from "@/lib/workflowApi";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function kindLabel(kind: string): string {
  if (kind === "document_revision") return "Documents need revision";
  if (kind === "document_rejected") return "Documents rejected";
  if (kind === "support_received") return "Support request received";
  return kind;
}

const card: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1.15rem 1.25rem",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

type CustomerNotificationsPanelProps = {
  onUnreadChange?: (count: number) => void;
  onRefresh?: () => void;
};

export default function CustomerNotificationsPanel({
  onUnreadChange,
  onRefresh,
}: CustomerNotificationsPanelProps) {
  const [rows, setRows] = useState<CustomerNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const viewedClearingRef = useRef(false);
  const unreadCountRef = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await WorkflowApi.customerNotifications({ limit: 20 });
      setRows(r.notifications);
      setUnreadCount(r.unread_count);
      unreadCountRef.current = r.unread_count;
      onUnreadChange?.(r.unread_count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications");
    }
  }, [onUnreadChange]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  const markRead = async (id: number) => {
    setBusy(true);
    try {
      await WorkflowApi.customerMarkNotificationRead(id);
      await load();
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark notification read");
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = useCallback(async () => {
    if (unreadCountRef.current <= 0 || viewedClearingRef.current) return;
    viewedClearingRef.current = true;
    setBusy(true);
    try {
      await WorkflowApi.customerMarkAllNotificationsRead();
      await load();
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark all read");
    } finally {
      setBusy(false);
      viewedClearingRef.current = false;
    }
  }, [load, onRefresh]);

  // Clear the red unread badge once the user has viewed the notifications panel.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35);
        if (visible && expanded && unreadCountRef.current > 0) {
          void markAllRead();
        }
      },
      { threshold: [0.35] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, markAllRead]);

  useEffect(() => {
    if (expanded && unreadCount > 0) {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.85 && rect.bottom > 0;
      if (inView) void markAllRead();
    }
  }, [expanded, unreadCount, markAllRead]);

  const dismiss = async (id: number) => {
    setBusy(true);
    try {
      await WorkflowApi.customerDismissNotification(id);
      await load();
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not dismiss notification");
    } finally {
      setBusy(false);
    }
  };

  if (rows.length === 0 && unreadCount === 0 && !error) {
    return null;
  }

  return (
    <article
      ref={rootRef}
      style={card}
      className="customer-notifications-panel"
      aria-label="Customer notifications"
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.65rem", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 800 }}>Notifications</h3>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#64748B" }}>
              {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? "" : "s"}` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 ? (
            <span
              aria-label={`${unreadCount} unread`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 22,
                height: 22,
                padding: "0 6px",
                borderRadius: 999,
                background: "#DC2626",
                color: "#fff",
                fontSize: "0.72rem",
                fontWeight: 800,
              }}
            >
              {unreadCount}
            </span>
          ) : null}
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
                  border: n.read ? "1px solid #E2E8F0" : "1px solid #FECACA",
                  background: n.read ? "#FAFAFA" : "#FEF2F2",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.35rem" }}>
                  <strong style={{ fontSize: "0.88rem", color: n.read ? "#334155" : "#B91C1C" }}>
                    {n.title || kindLabel(n.kind)}
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{formatWhen(n.created_at)}</span>
                </div>
                <div style={{ marginTop: "0.45rem", fontSize: "0.86rem", color: "#1e293b", display: "grid", gap: 4 }}>
                  {n.booking_id ? (
                    <div>
                      <strong>Booking ID:</strong> #{n.booking_id}
                    </div>
                  ) : null}
                  <div>{n.message || "—"}</div>
                  {n.required_action ? (
                    <div style={{ marginTop: 2, color: "#475569" }}>
                      <strong>Required action:</strong> {n.required_action}
                    </div>
                  ) : null}
                </div>
                <div style={{ marginTop: "0.55rem", display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                  {n.link_path ? (
                    <Link
                      href={n.link_path}
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
                      Open
                    </Link>
                  ) : null}
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
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void dismiss(n.id)}
                    style={{
                      padding: "0.38rem 0.7rem",
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      background: "#fff",
                      fontWeight: 600,
                      fontSize: "0.78rem",
                      cursor: busy ? "not-allowed" : "pointer",
                      color: "#64748B",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </article>
  );
}
