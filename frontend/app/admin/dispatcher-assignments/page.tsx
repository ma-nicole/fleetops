"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/appLocale";
import { formatBookingWeightTons } from "@/lib/bookingWeightOptions";
import type { DispatcherAssignmentRow, DispatcherUserOption } from "@/lib/dispatcherAssignment";
import { WorkflowApi } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

type Filter = "all" | "unassigned" | "assigned";

export default function AdminDispatcherAssignmentsPage() {
  useRoleGuard(["admin", "manager"]);
  const [rows, setRows] = useState<DispatcherAssignmentRow[]>([]);
  const [dispatchers, setDispatchers] = useState<DispatcherUserOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyBookingId, setBusyBookingId] = useState<number | null>(null);
  const [draftByBooking, setDraftByBooking] = useState<Record<number, string>>({});

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [list, users] = await Promise.all([
        WorkflowApi.listDispatcherAssignments(),
        WorkflowApi.listDispatchers(),
      ]);
      setRows(list);
      setDispatchers(users);
      setDraftByBooking((prev) => {
        const next = { ...prev };
        for (const row of list) {
          if (next[row.booking_id] === undefined) {
            next[row.booking_id] =
              row.assigned_dispatcher_id != null ? String(row.assigned_dispatcher_id) : "";
          }
        }
        return next;
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load dispatcher assignments.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (filter === "unassigned") return row.assigned_dispatcher_id == null;
      if (filter === "assigned") return row.assigned_dispatcher_id != null;
      return true;
    });
  }, [filter, rows]);

  const saveAssignment = async (bookingId: number) => {
    const raw = draftByBooking[bookingId] ?? "";
    setBusyBookingId(bookingId);
    try {
      const updated = await WorkflowApi.assignBookingDispatcher(
        bookingId,
        raw.trim() === "" ? null : Number(raw),
      );
      setRows((prev) => prev.map((r) => (r.booking_id === bookingId ? updated : r)));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not save dispatcher assignment.");
    } finally {
      setBusyBookingId(null);
    }
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div>
          <Link href="/admin/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
            ← Admin Dashboard
          </Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Dispatcher booking assignments</h1>
          <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
            Assign bookings to dispatchers. Each dispatcher only sees their assigned bookings unless they have admin or
            manager access. Unassigned bookings remain visible to all dispatchers until assigned.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
            <span style={{ fontWeight: 600, color: "#374151" }}>Filter</span>
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              <option value="assigned">Assigned</option>
            </select>
          </label>
          <button type="button" className="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        {loadError && (
          <p role="alert" style={{ margin: 0, color: "#B91C1C" }}>
            {loadError}
          </p>
        )}

        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", textAlign: "left" }}>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Booking</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Route / cargo</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Current assignment</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB", minWidth: 260 }}>Assign dispatcher</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "1.25rem", color: "#6B7280", textAlign: "center" }}>
                    No bookings match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const busy = busyBookingId === row.booking_id;
                  const draft = draftByBooking[row.booking_id] ?? "";
                  return (
                    <tr key={row.booking_id} style={{ borderBottom: "1px solid #F3F4F6", verticalAlign: "top" }}>
                      <td style={{ padding: "0.75rem" }}>
                        <strong>#{row.booking_id}</strong>
                        <div style={{ color: "#6B7280", fontSize: "0.8rem", marginTop: 4 }}>
                          Customer #{row.customer_id}
                          <br />
                          {row.status.replace(/_/g, " ")}
                          <br />
                          {row.scheduled_date} · {row.scheduled_time_slot}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem", maxWidth: 280 }}>
                        <div>{row.pickup_location}</div>
                        <div style={{ color: "#6B7280" }}>→ {row.dropoff_location}</div>
                        <div style={{ marginTop: 4, fontSize: "0.8rem" }}>
                          {row.cargo_description || "—"}
                          <br />
                          {formatBookingWeightTons(row.cargo_weight_tons)}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {row.assigned_dispatcher_name ? (
                          <>
                            <strong>{row.assigned_dispatcher_name}</strong>
                            {row.job_issued_at && (
                              <div style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: 4 }}>
                                Updated {formatDateTime(row.job_issued_at)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "#B45309" }}>Unassigned (all dispatchers)</span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                          <select
                            className="input"
                            value={draft}
                            onChange={(e) =>
                              setDraftByBooking((prev) => ({ ...prev, [row.booking_id]: e.target.value }))
                            }
                            style={{ minWidth: 200 }}
                          >
                            <option value="">Unassigned</option>
                            {dispatchers.map((d) => (
                              <option key={d.id} value={String(d.id)}>
                                {d.full_name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="button"
                            disabled={busy}
                            onClick={() => void saveAssignment(row.booking_id)}
                          >
                            Save
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
