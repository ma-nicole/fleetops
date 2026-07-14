"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import LoadingMessage from "@/components/ui/LoadingMessage";
import BookingCustomsClearanceSection from "@/components/BookingCustomsClearanceSection";
import ContactSupportButton from "@/components/ContactSupportButton";
import CustomerBookingAssignmentsList from "@/components/CustomerBookingAssignmentsList";
import CustomerDocumentReviewSection from "@/components/CustomerDocumentReviewSection";
import { APP_LOCALE, APP_TIMEZONE, formatPhp } from "@/lib/appLocale";
import { LOADING_AUTH_RESTORE } from "@/lib/loadingMessages";
import { WorkflowApi, type CustomerBookingHistoryRow } from "@/lib/workflowApi";

export default function BookingHistoryPage() {
  const { ready, allowed } = useRoleGuard(["customer"]);

  const [rows, setRows] = useState<CustomerBookingHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedBooking, setSelectedBooking] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setRows(await WorkflowApi.customerBookingHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !allowed) return;
    void load();
  }, [ready, allowed, load]);

  const filteredBookings = useMemo(() => {
    if (filterStatus === "all") return rows;
    return rows.filter((b) => b.display_status === filterStatus);
  }, [rows, filterStatus]);

  const getStatusColor = (display: string) => {
    switch (display) {
      case "completed":
        return "#4CAF50";
      case "cancelled":
      case "payment_rejected":
      case "rejected":
        return "#F44336";
      case "expired":
        return "#9E9E9E";
      default:
        return "#999";
    }
  };

  const stats = useMemo(() => {
    const completed = rows.filter((b) => b.display_status === "completed");
    const totalSpent = completed.reduce(
      (sum, b) => sum + Number(b.actual_cost ?? b.estimated_cost ?? 0),
      0,
    );
    const avgCost = completed.length ? totalSpent / completed.length : 0;
    return {
      total: rows.length,
      completed: completed.length,
      totalSpent,
      avgCost,
    };
  }, [rows]);

  if (!ready) {
    return (
      <div className="container" style={{ paddingTop: "var(--space-3)" }}>
        <LoadingMessage label={LOADING_AUTH_RESTORE} />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/customer" },
          { label: "My Bookings" },
          { label: "Booking History" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Booking History</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Past and closed bookings from your account (completed, cancelled, rejected payment, or expired).
        </p>

        {error && (
          <div role="alert" style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8, marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: "#666" }}>Loading…</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "1rem",
                marginBottom: "2rem",
              }}
            >
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>{stats.total}</div>
                <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total closed</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>{stats.completed}</div>
                <div style={{ color: "#666666", fontSize: "0.9rem" }}>Completed</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>{formatPhp(stats.totalSpent)}</div>
                <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total spent (completed)</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>{formatPhp(stats.avgCost)}</div>
                <div style={{ color: "#666666", fontSize: "0.9rem" }}>Avg cost (completed)</div>
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ color: "#1A1A1A", fontWeight: 600, marginRight: "1rem" }}>Filter by status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  color: "#1A1A1A",
                  cursor: "pointer",
                }}
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="payment_rejected">Payment rejected</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              {filteredBookings.length === 0 ? (
                <p style={{ color: "#666" }}>No bookings in history yet.</p>
              ) : (
                filteredBookings.map((booking) => {
                  const cost = Number(booking.actual_cost ?? booking.estimated_cost ?? 0);
                  return (
                    <div
                      key={booking.id}
                      className="card"
                      onClick={() =>
                        setSelectedBooking(selectedBooking === booking.id ? null : booking.id)
                      }
                      style={{
                        padding: "1rem",
                        cursor: "pointer",
                        background: selectedBooking === booking.id ? "rgba(255, 152, 0, 0.15)" : "#FFFFFF",
                        border:
                          selectedBooking === booking.id ? "2px solid #FF9800" : "1px solid #E8E8E8",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "start",
                          gap: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                              marginBottom: "0.5rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <strong style={{ color: "#1A1A1A" }}>Booking #{booking.id}</strong>
                            {booking.primary_trip_id != null ? (
                              <span style={{ color: "#666", fontSize: "0.9rem" }}>Trip #{booking.primary_trip_id}</span>
                            ) : null}
                            <span
                              style={{
                                padding: "0.25rem 0.75rem",
                                background: getStatusColor(booking.display_status),
                                color: "white",
                                borderRadius: "4px",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                              }}
                            >
                              {booking.display_status_label}
                            </span>
                          </div>
                          <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                            {booking.pickup_location} → {booking.dropoff_location}
                          </p>
                          <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                            Scheduled:{" "}
                            {new Intl.DateTimeFormat(APP_LOCALE, {
                              timeZone: APP_TIMEZONE,
                              dateStyle: "medium",
                            }).format(new Date(`${booking.scheduled_date}T12:00:00`))}{" "}
                            · Slot {booking.scheduled_time_slot} · Cargo {booking.cargo_weight_tons}T
                          </p>
                          {booking.closed_at ? (
                            <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.82rem" }}>
                              Updated {new Date(booking.closed_at).toLocaleString(APP_LOCALE)}
                            </p>
                          ) : null}
                        </div>
                        <div style={{ textAlign: "right", marginLeft: "1rem", whiteSpace: "nowrap" }}>
                          <div style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.2rem" }}>{formatPhp(cost)}</div>
                          <div style={{ fontSize: "0.78rem", color: "#888" }}>Quoted / final</div>
                        </div>
                      </div>

                      {selectedBooking === booking.id && (
                        <div
                          style={{
                            background: "rgba(255, 152, 0, 0.08)",
                            border: "1px solid #FFE0B2",
                            borderRadius: "8px",
                            padding: "1rem",
                            marginTop: "1rem",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <h4 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>Details — all assigned trucks</h4>
                          <div style={{ marginBottom: "0.85rem" }}>
                            <ContactSupportButton bookingId={booking.id} />
                          </div>
                          <CustomerBookingAssignmentsList
                            assignments={booking.assignments}
                            dropoffAddress={booking.dropoff_location}
                            showDeliveryTimeline
                          />
                          <CustomerDocumentReviewSection
                            booking={booking}
                            onUpdated={(updated) => {
                              setRows((prev) =>
                                prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
                              );
                            }}
                          />
                          <BookingCustomsClearanceSection booking={booking} editable={false} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
