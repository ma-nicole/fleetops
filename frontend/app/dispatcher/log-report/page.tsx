"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DispatchApi } from "@/lib/dispatchApi";
import { WorkflowApi, type GeneralOperationalReportRow } from "@/lib/workflowApi";
import { announce } from "@/lib/useAnnouncer";

type AssignmentRow = Awaited<ReturnType<typeof WorkflowApi.dispatchAssignmentsBoard>>["assignments"][number];

const REPORT_TYPES: { value: string; label: string }[] = [
  { value: "route_change", label: "Route Change" },
  { value: "delivery_delay", label: "Delivery Delay" },
  { value: "maintenance_concern", label: "Maintenance Concern" },
  { value: "extra_cost", label: "Extra Cost" },
  { value: "fuel_toll_issue", label: "Fuel/Toll Issue" },
  { value: "driver_helper_concern", label: "Driver/Helper Concern" },
  { value: "customer_coordination_issue", label: "Customer Coordination Issue" },
  { value: "loading_unloading_issue", label: "Loading/Unloading Issue" },
  { value: "other_incident", label: "Other Incident" },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function statusLine(row: AssignmentRow): string {
  const parts = [row.trip_status, row.helper_progress_status].filter(Boolean) as string[];
  return parts.map((p) => p.replace(/_/g, " ")).join(" · ") || "—";
}

export default function DispatcherOperationalLogPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(true);

  const [tripId, setTripId] = useState<string>("");
  const [reportType, setReportType] = useState("route_change");
  const [priority, setPriority] = useState("medium");
  const [details, setDetails] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);

  const [genRows, setGenRows] = useState<GeneralOperationalReportRow[]>([]);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(true);

  const selected = useMemo(
    () => rows.find((r) => String(r.trip_id) === tripId) ?? null,
    [rows, tripId],
  );

  const loadBoard = useCallback(async () => {
    setLoadingBoard(true);
    setLoadErr(null);
    try {
      const data = await WorkflowApi.dispatchAssignmentsBoard();
      setRows(data.assignments ?? []);
      announce(`Loaded ${data.assignments?.length ?? 0} trips for operational log`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load trips.";
      setLoadErr(msg);
      announce(msg, "assertive");
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const loadGeneralForms = useCallback(async () => {
    setGenLoading(true);
    setGenErr(null);
    try {
      const res = await WorkflowApi.dispatchGeneralOperationalReports();
      setGenRows((res.reports ?? []).slice(0, 50));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load driver general forms.";
      setGenErr(msg);
      setGenRows([]);
    } finally {
      setGenLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGeneralForms();
  }, [loadGeneralForms]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErr(null);
    setLastSavedId(null);
    if (!tripId) {
      setSubmitErr("Select a related trip before saving.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("trip_id", tripId);
      fd.append("report_type", reportType);
      fd.append("priority_level", priority);
      fd.append("operational_details", details.trim());
      if (file) fd.append("file", file);
      const res = await DispatchApi.createOperationalLog(fd);
      setLastSavedId(res.id);
      setDetails("");
      setFile(null);
      announce("Operational log saved");
      void loadBoard();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setSubmitErr(msg);
      announce(msg, "assertive");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.5rem", maxWidth: "960px" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", margin: "1rem 0 0.35rem", fontSize: "1.65rem" }}>Operational Log</h1>
        <p style={{ color: "#64748B", margin: 0, lineHeight: 1.55, maxWidth: "40rem" }}>
          Record route changes, delays, maintenance concerns, extra costs, and trip-related incidents. Logs are tied
          to a trip and appear in Trip Logs and booking monitoring — they are not customer feedback.
        </p>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
          <Link href="/dispatcher/trip-logs" style={{ color: "var(--brand-text)", fontWeight: 600 }}>
            Open Trip Logs
          </Link>
        </p>
      </div>

      {loadErr ? (
        <div
          role="alert"
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "8px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
          }}
        >
          {loadErr}
        </div>
      ) : null}

      <form
        onSubmit={(ev) => void onSubmit(ev)}
        style={{
          display: "grid",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "12px",
          border: "1px solid #E8E8E8",
          background: "#fff",
        }}
      >
        <div>
          <label htmlFor="oplog-trip" style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>
            Related Trip / Booking <span style={{ color: "#B91C1C" }}>*</span>
          </label>
          <select
            id="oplog-trip"
            required
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            disabled={loadingBoard || rows.length === 0}
            style={{ width: "100%", padding: "0.55rem 0.65rem", borderRadius: "8px", border: "1px solid #CBD5E1" }}
          >
            <option value="">Select trip…</option>
            {rows.map((r) => (
              <option key={r.trip_id} value={String(r.trip_id)}>
                Trip #{r.trip_id} · Booking #{r.booking_id} · {r.truck_code || "—"} · {r.driver_name ?? "—"}
              </option>
            ))}
          </select>
          {loadingBoard ? (
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "#64748B" }}>Loading trips…</p>
          ) : null}
          {!loadingBoard && rows.length === 0 ? (
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "#B45309" }}>
              No assigned trips found. Assign trips first, then return here to log an incident.
            </p>
          ) : null}
        </div>

        {selected ? (
          <div
            style={{
              display: "grid",
              gap: "0.5rem",
              fontSize: "0.92rem",
              color: "#334155",
              padding: "0.85rem 1rem",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
            }}
          >
            <div>
              <strong>Booking ID:</strong> {selected.booking_id}
            </div>
            <div>
              <strong>Trip ID:</strong> {selected.trip_id}
            </div>
            <div>
              <strong>Vehicle plate:</strong> {selected.truck_code || "—"}
            </div>
            <div>
              <strong>Driver:</strong> {selected.driver_name ?? "—"}
            </div>
            <div>
              <strong>Helper:</strong> {selected.helper_name ?? "—"}
            </div>
            <div>
              <strong>Pickup:</strong> {selected.pickup_location}
            </div>
            <div>
              <strong>Dropoff:</strong> {selected.dropoff_location}
            </div>
            <div>
              <strong>Current status:</strong> {statusLine(selected)}
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="oplog-type" style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>
            Report Type
          </label>
          <select
            id="oplog-type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={{ width: "100%", padding: "0.55rem 0.65rem", borderRadius: "8px", border: "1px solid #CBD5E1" }}
          >
            {REPORT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="oplog-priority" style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>
            Priority Level
          </label>
          <select
            id="oplog-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={{ width: "100%", padding: "0.55rem 0.65rem", borderRadius: "8px", border: "1px solid #CBD5E1" }}
          >
            {PRIORITIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="oplog-details" style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>
            Operational Details
          </label>
          <textarea
            id="oplog-details"
            required
            minLength={3}
            rows={5}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe what happened, why it happened, and what action was taken."
            style={{
              width: "100%",
              padding: "0.65rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div>
          <label htmlFor="oplog-file" style={{ display: "block", fontWeight: 700, marginBottom: "0.35rem" }}>
            Supporting Documents / Photos (optional)
          </label>
          <input
            id="oplog-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.img"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: "0.9rem" }}
          />
        </div>

        {submitErr ? (
          <div role="alert" style={{ color: "#B91C1C", fontSize: "0.9rem" }}>
            {submitErr}
          </div>
        ) : null}
        {lastSavedId != null ? (
          <div style={{ color: "#15803D", fontSize: "0.9rem", fontWeight: 600 }}>
            Saved operational log #{lastSavedId}. It will appear in Trip Logs and this booking&apos;s monitoring
            details.
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !tripId}
          style={{
            padding: "0.7rem 1.1rem",
            borderRadius: "8px",
            border: "none",
            background: submitting || !tripId ? "#CBD5E1" : "#FF9800",
            color: "#fff",
            fontWeight: 700,
            cursor: submitting || !tripId ? "not-allowed" : "pointer",
            justifySelf: "start",
          }}
        >
          {submitting ? "Saving…" : "Save Operational Log"}
        </button>
      </form>
    </div>

    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1rem", maxWidth: "960px" }}>
      <h2 style={{ color: "#1A1A1A", margin: 0, fontSize: "1.25rem" }}>Driver general forms</h2>
      <p style={{ color: "#64748B", margin: 0, lineHeight: 1.5, maxWidth: "42rem" }}>
        Submissions from the driver <strong>General Form</strong> (operational updates, fuel, delays, completion
        notes). These records are also merged into <Link href="/dispatcher/trip-logs" style={{ color: "var(--brand-text)", fontWeight: 600 }}>Trip Logs</Link>{" "}
        per trip.
      </p>
      {genErr ? (
        <div role="alert" style={{ padding: "0.85rem 1rem", borderRadius: "8px", background: "#FEF2F2", color: "#991B1B" }}>
          {genErr}
        </div>
      ) : null}
      {genLoading ? (
        <p style={{ color: "#64748B", margin: 0 }}>Loading…</p>
      ) : genRows.length === 0 ? (
        <p style={{ color: "#64748B", margin: 0 }}>No driver general forms yet.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: "10px", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left" }}>
                <th style={{ padding: "0.65rem 0.75rem" }}>ID</th>
                <th style={{ padding: "0.65rem 0.75rem" }}>Trip / Booking</th>
                <th style={{ padding: "0.65rem 0.75rem" }}>Driver</th>
                <th style={{ padding: "0.65rem 0.75rem" }}>Category</th>
                <th style={{ padding: "0.65rem 0.75rem" }}>Date</th>
                <th style={{ padding: "0.65rem 0.75rem" }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {genRows.map((g) => (
                <tr key={g.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "0.65rem 0.75rem", fontWeight: 700, color: "#0EA5E9" }}>#{g.id}</td>
                  <td style={{ padding: "0.65rem 0.75rem" }}>
                    {g.trip_id} / {g.booking_id}
                  </td>
                  <td style={{ padding: "0.65rem 0.75rem" }}>{g.driver_name ?? "—"}</td>
                  <td style={{ padding: "0.65rem 0.75rem" }}>{g.category_label}</td>
                  <td style={{ padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>{g.report_date}</td>
                  <td style={{ padding: "0.65rem 0.75rem", color: "#475569", maxWidth: "360px" }}>
                    {g.description.length > 160 ? `${g.description.slice(0, 160)}…` : g.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  );
}
