"use client";

import { apiFullUrl } from "@/lib/api";
import { WorkflowApi, type GeneralOperationalReportRow } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function attachmentHref(url: string | null | undefined): string | null {
  const u = (url || "").trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/uploads/")) return apiFullUrl(u);
  return u;
}

export default function ManagerGeneralFormReportsPage() {
  useRoleGuard(["manager", "admin"]);

  const [reports, setReports] = useState<GeneralOperationalReportRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await WorkflowApi.dispatchGeneralOperationalReports();
      setReports(res.reports ?? []);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Could not load reports.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <Link href="/manager/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
            ← Dashboard
          </Link>
          <h1 style={{ margin: "1rem 0 0.5rem", fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>
            General Form submissions
          </h1>
          <p style={{ margin: 0, color: "#666", maxWidth: "40rem", lineHeight: 1.55 }}>
            Driver-submitted operational reports (trip completion, delays, fuel, incidents, etc.). Same feed is
            available to dispatch under Operational Log and Trip Logs.
          </p>
        </div>

        {loadError ? (
          <div
            style={{
              padding: "1rem",
              borderRadius: "8px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              marginBottom: "1rem",
            }}
          >
            {loadError}
          </div>
        ) : null}

        <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E8E8E8", background: "#F9FAFB" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>
                    ID
                  </th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>
                    Trip
                  </th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>
                    Driver
                  </th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>
                    Category
                  </th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>
                    Report date
                  </th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>
                    Route
                  </th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: 700, color: "#666", fontSize: "0.9rem" }}>
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#64748B" }}>
                      Loading…
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#64748B" }}>
                      No general form submissions yet.
                    </td>
                  </tr>
                ) : (
                  reports.map((r, i) => {
                    const href = attachmentHref(r.attachment_url);
                    return (
                      <tr key={r.id} style={{ borderBottom: i < reports.length - 1 ? "1px solid #E8E8E8" : "none" }}>
                        <td style={{ padding: "1rem", fontWeight: 700, color: "#0EA5E9" }}>#{r.id}</td>
                        <td style={{ padding: "1rem", color: "#1A1A1A", fontWeight: 600 }}>
                          {r.trip_id} / B{r.booking_id}
                        </td>
                        <td style={{ padding: "1rem", color: "#1A1A1A" }}>{r.driver_name ?? `User ${r.driver_id}`}</td>
                        <td style={{ padding: "1rem", color: "#334155", fontSize: "0.9rem" }}>{r.category_label}</td>
                        <td style={{ padding: "1rem", color: "#64748B", fontSize: "0.9rem" }}>{r.report_date}</td>
                        <td style={{ padding: "1rem", color: "#64748B", fontSize: "0.85rem", maxWidth: "220px" }}>
                          {r.route || "—"}
                          <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>Plate: {r.truck_plate || "—"}</div>
                        </td>
                        <td style={{ padding: "1rem", color: "#475569", fontSize: "0.88rem", maxWidth: "320px" }}>
                          <div style={{ lineHeight: 1.45 }}>{r.description}</div>
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-text)", fontSize: "0.85rem" }}>
                              Attachment
                            </a>
                          ) : null}
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
    </main>
  );
}
