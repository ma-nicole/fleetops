"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { WorkflowApi, type DriverPaySummary } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

function shorten(s: string, max: number): string {
  const t = (s || "").trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function statusBadge(status: string): { color: string; label: string } {
  const s = (status || "").toLowerCase();
  if (s === "paid") return { color: "#15803D", label: "Paid" };
  if (s === "unpaid") return { color: "#64748B", label: "Unpaid" };
  if (s === "pending" || s === "pending_payroll") return { color: "#C2410C", label: "Pending payroll processing" };
  return { color: "#64748B", label: status.replace(/_/g, " ") };
}

export default function PayPage() {
  useRoleGuard(["driver"]);

  const [data, setData] = useState<DriverPaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await WorkflowApi.driverPaySummary();
      setData(d);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load pay summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem", maxWidth: 1200 }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Total Pay</h1>
        <p style={{ color: "#666666", margin: "0" }}>Earnings from your completed trips (current month). No placeholder data.</p>
      </div>

      {error ? (
        <div role="alert" style={{ background: "#FEF2F2", color: "#991B1B", padding: 12, borderRadius: 8, border: "1px solid #FECACA" }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#64748B", margin: 0 }}>Loading…</p>
      ) : data ? (
        <>
          <div style={{ padding: "2rem", border: "2px solid #4CAF50", borderRadius: "8px", background: "rgba(76, 175, 80, 0.05)" }}>
            <h2 style={{ color: "#166534", marginBottom: "1.25rem", marginTop: 0, fontSize: "1.25rem" }}>
              Current period ({data.period_label})
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
              <div>
                <p style={{ color: "#64748B", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TRIPS COMPLETED</p>
                <p style={{ color: "#1A1A1A", fontSize: "1.8rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>{data.trips_completed}</p>
              </div>
              <div>
                <p style={{ color: "#64748B", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TOTAL DISTANCE</p>
                <p style={{ color: "#1A1A1A", fontSize: "1.5rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>{data.total_distance_km} km</p>
              </div>
              <div style={{ gridColumn: "span 1" }}>
                <p style={{ color: "#64748B", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DRIVER SHARE RULE</p>
                <p style={{ color: "#334155", fontSize: "0.88rem", fontWeight: 600, margin: "0.5rem 0 0 0", lineHeight: 1.45 }}>
                  {data.driver_share_formula.description}
                </p>
              </div>
            </div>

            <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "2px solid #E8E8E8" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1.5rem" }}>
                <div>
                  <p style={{ color: "#64748B", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>BASE EARNINGS</p>
                  <p style={{ color: "#1A1A1A", fontSize: "1.5rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>{formatPhp(data.base_earnings)}</p>
                </div>
                <div>
                  <p style={{ color: "#64748B", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>BONUS</p>
                  <p style={{ color: "#15803D", fontSize: "1.5rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>{formatPhp(data.bonus)}</p>
                </div>
                <div>
                  <p style={{ color: "#64748B", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>DEDUCTIONS</p>
                  <p style={{ color: "#B91C1C", fontSize: "1.5rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>{formatPhp(data.deductions)}</p>
                </div>
                <div style={{ paddingTop: "0.5rem", borderTop: "2px solid #22C55E" }}>
                  <p style={{ color: "#64748B", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>CURRENT TOTAL (this month)</p>
                  <p style={{ color: "#15803D", fontSize: "2rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>{formatPhp(data.current_total)}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ color: "#1A1A1A", marginBottom: "1rem", fontSize: "1.15rem" }}>Payment history (completed trips)</h2>
            <p style={{ color: "#64748B", fontSize: "0.88rem", marginTop: 0, marginBottom: "0.75rem" }}>{data.payroll_note}</p>
            <div style={{ border: "1px solid #E8E8E8", borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#F5F5F5", borderBottom: "1px solid #E8E8E8" }}>
                      <th style={{ textAlign: "left", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Completed</th>
                      <th style={{ textAlign: "left", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Trip</th>
                      <th style={{ textAlign: "left", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Booking</th>
                      <th style={{ textAlign: "left", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Route</th>
                      <th style={{ textAlign: "right", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Cargo (t)</th>
                      <th style={{ textAlign: "right", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Km</th>
                      <th style={{ textAlign: "right", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Driver pay</th>
                      <th style={{ textAlign: "right", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Bonus</th>
                      <th style={{ textAlign: "right", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Deduction</th>
                      <th style={{ textAlign: "right", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Total</th>
                      <th style={{ textAlign: "left", padding: "0.75rem 0.65rem", fontWeight: 700, color: "#64748B" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payment_history.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ padding: "1.25rem", color: "#64748B" }}>
                          No completed trips / pay records yet.
                        </td>
                      </tr>
                    ) : (
                      data.payment_history.map((row) => {
                        const b = statusBadge(row.status);
                        return (
                          <tr key={`${row.trip_id}-${row.completed_at}`} style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "0.65rem", whiteSpace: "nowrap" }}>{row.period_label}</td>
                            <td style={{ padding: "0.65rem", fontWeight: 600 }}>#{row.trip_id}</td>
                            <td style={{ padding: "0.65rem" }}>#{row.booking_id}</td>
                            <td style={{ padding: "0.65rem", maxWidth: 220 }} title={row.route_label}>
                              {shorten(row.route_label, 56)}
                            </td>
                            <td style={{ padding: "0.65rem", textAlign: "right" }}>{row.cargo_weight_tons}</td>
                            <td style={{ padding: "0.65rem", textAlign: "right" }}>{row.distance_km}</td>
                            <td style={{ padding: "0.65rem", textAlign: "right" }}>{formatPhp(row.driver_pay)}</td>
                            <td style={{ padding: "0.65rem", textAlign: "right" }}>{formatPhp(row.bonus)}</td>
                            <td style={{ padding: "0.65rem", textAlign: "right" }}>{formatPhp(row.deduction)}</td>
                            <td style={{ padding: "0.65rem", textAlign: "right", fontWeight: 700 }}>{formatPhp(row.total_pay)}</td>
                            <td style={{ padding: "0.65rem" }}>
                              <span
                                style={{
                                  padding: "0.25rem 0.5rem",
                                  background: `${b.color}18`,
                                  color: b.color,
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  fontSize: "0.72rem",
                                  display: "inline-block",
                                  maxWidth: 180,
                                  lineHeight: 1.25,
                                }}
                              >
                                {b.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ padding: "1.25rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <p style={{ color: "#334155", fontWeight: 700, margin: "0 0 0.35rem 0" }}>How this page works</p>
            <p style={{ color: "#475569", margin: 0, fontSize: "0.9rem", lineHeight: 1.55 }}>
              Figures are computed from your <strong>completed</strong> trip legs in the database (booking cargo weight and trip
              distance). Settlement status is shown as pending until a payroll module records paid amounts.
            </p>
          </div>
        </>
      ) : (
        <p style={{ color: "#64748B" }}>No data.</p>
      )}
    </div>
  );
}
