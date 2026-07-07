"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import EvidenceCaptureInput from "@/components/EvidenceCaptureInput";
import { appendEvidenceToFormData } from "@/lib/evidenceFormData";
import type { EvidenceCaptureMetadata } from "@/lib/evidenceCapture";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type DriverVehicleIssueSelectableTrip } from "@/lib/workflowApi";

const OPERATIONAL_STATUS_LABELS: Record<string, string> = {
  assigned: "Assigned",
  for_pickup: "For pickup",
  picked_up: "Picked up",
  en_route: "En route",
  dropped_off: "Dropped off",
  completed: "Completed",
};

const ISSUE_TYPES: { value: string; label: string }[] = [
  { value: "engine_problem", label: "Engine problem" },
  { value: "tire_issue", label: "Tire issue" },
  { value: "brake_issue", label: "Brake issue" },
  { value: "battery_issue", label: "Battery issue" },
  { value: "fuel_issue", label: "Fuel issue" },
  { value: "overheating", label: "Overheating" },
  { value: "body_damage", label: "Body damage" },
  { value: "other_vehicle_concern", label: "Other vehicle concern" },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function operationalLabel(slug: string) {
  return OPERATIONAL_STATUS_LABELS[slug] ?? slug.replace(/_/g, " ");
}

export default function ReportVehicleIssuePage() {
  useRoleGuard(["driver"]);

  const [trips, setTrips] = useState<DriverVehicleIssueSelectableTrip[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const [tripId, setTripId] = useState<number | "">("");
  const [issueType, setIssueType] = useState("");
  const [priority, setPriority] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<EvidenceCaptureMetadata | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const selectedTrip = useMemo(
    () => trips.find((t) => t.trip_id === tripId) ?? null,
    [trips, tripId],
  );

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    setLoadError(null);
    try {
      const res = await WorkflowApi.driverVehicleIssueSelectableTrips();
      setTrips(res.trips ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load trips.";
      setLoadError(msg);
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const selected = useMemo(
    () => (tripId === "" ? undefined : trips.find((t) => t.trip_id === tripId)),
    [tripId, trips],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitOk(null);
    if (tripId === "") {
      setSubmitError("Select the trip this issue relates to.");
      return;
    }
    if (!issueType || !priority) {
      setSubmitError("Issue type and priority are required.");
      return;
    }
    if (description.trim().length < 10) {
      setSubmitError("Description must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("trip_id", String(tripId));
      fd.append("issue_type", issueType);
      fd.append("priority", priority);
      fd.append("description", description.trim());
      if (file) {
        fd.append("file", file);
        if (fileMeta) appendEvidenceToFormData(fd, fileMeta);
      }
      const res = await WorkflowApi.driverSubmitVehicleIssueReport(fd);
      setSubmitOk(`Report #${res.id} submitted. Dispatch has been notified.`);
      setDescription("");
      setFile(null);
      setFileMeta(null);
      setIssueType("");
      setPriority("");
      setTripId("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submit failed.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "520px",
    padding: "0.65rem 0.75rem",
    border: "1px solid #E2E8F0",
    borderRadius: "8px",
    fontFamily: "inherit",
    fontSize: "0.95rem",
    boxSizing: "border-box",
    background: "#fff",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#64748B",
    marginBottom: "0.35rem",
    letterSpacing: "0.02em",
  };

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.75rem", maxWidth: "900px" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Report Vehicle Issue</h1>
        <p style={{ color: "#666666", margin: 0 }}>
          Report truck issues related to your assigned trip or booking. Only live trip and fleet data from your
          assignments are shown—no maintenance placeholders.
        </p>
      </div>

      {loadError ? (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "8px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B91C1C",
          }}
        >
          {loadError}
        </div>
      ) : null}

      {loadingTrips ? (
        <p style={{ color: "#64748B", margin: 0 }}>Loading your trips…</p>
      ) : trips.length === 0 ? (
        <div
          style={{
            padding: "1.5rem",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            background: "#FAFAFA",
            color: "#475569",
          }}
        >
          <p style={{ margin: 0 }}>
            No eligible trips right now. You need an active or recently completed assigned trip to report a vehicle
            issue.
          </p>
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gap: "1.25rem",
          padding: "1.5rem",
          border: "1px solid #E8E8E8",
          borderRadius: "10px",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        }}
      >
        <div>
          <label htmlFor="trip-select" style={labelStyle}>
            Related trip / booking <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <select
            id="trip-select"
            required
            value={tripId === "" ? "" : String(tripId)}
            onChange={(e) => {
              const v = e.target.value;
              setTripId(v === "" ? "" : Number(v));
            }}
            style={inputStyle}
            disabled={trips.length === 0}
          >
            <option value="">Select trip…</option>
            {trips.map((t) => (
              <option key={t.trip_id} value={t.trip_id}>
                Booking #{t.booking_id} · Trip #{t.trip_id} · {t.truck_plate || "—"} · {t.route_label}
              </option>
            ))}
          </select>
        </div>

        {selected ? (
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "grid",
              gap: "0.5rem",
              fontSize: "0.9rem",
              color: "#334155",
            }}
          >
            <div>
              <strong>Truck plate:</strong> {selected.truck_plate || "—"}
            </div>
            <div>
              <strong>Truck model:</strong> {selected.truck_model?.trim() ? selected.truck_model : "—"}
            </div>
            <div>
              <strong>Booking ID:</strong> {selected.booking_id} · <strong>Trip ID:</strong> {selected.trip_id}
            </div>
            <div>
              <strong>Pickup:</strong> {selected.pickup_location}
            </div>
            <div>
              <strong>Dropoff:</strong> {selected.dropoff_location}
            </div>
            <div>
              <strong>Assigned helper:</strong> {selected.helper_name ?? "—"}
            </div>
            <div>
              <strong>Trip status:</strong> {selected.trip_status.replace(/_/g, " ")} ·{" "}
              <strong>Operational:</strong> {operationalLabel(selected.operational_status)}
            </div>
            {selected.scheduled_date ? (
              <div>
                <strong>Scheduled date:</strong> {selected.scheduled_date}
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="issue-type" style={labelStyle}>
            Issue type <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <select
            id="issue-type"
            required
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            style={inputStyle}
            disabled={trips.length === 0}
          >
            <option value="">Select issue type…</option>
            {ISSUE_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" style={labelStyle}>
            Priority <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <select
            id="priority"
            required
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={inputStyle}
            disabled={trips.length === 0}
          >
            <option value="">Select priority…</option>
            {PRIORITIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="description" style={labelStyle}>
            Description <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <textarea
            id="description"
            required
            minLength={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue clearly (minimum 10 characters)."
            rows={5}
            style={{ ...inputStyle, maxWidth: "100%", minHeight: "120px", resize: "vertical" }}
            disabled={trips.length === 0}
          />
        </div>

        <div>
          <EvidenceCaptureInput
            label="Photo / attachment"
            allowPdf
            watermarkContext={{
              bookingId: selectedTrip?.booking_id,
              tripId: typeof tripId === "number" ? tripId : null,
              crewName: selectedTrip?.helper_name,
            }}
            disabled={trips.length === 0}
            value={file}
            metadata={fileMeta}
            onCapture={(f, meta) => {
              setFile(f);
              setFileMeta(meta);
            }}
          />
        </div>

        {submitError ? (
          <div style={{ color: "#B91C1C", fontSize: "0.9rem" }}>{submitError}</div>
        ) : null}
        {submitOk ? (
          <div style={{ color: "#047857", fontSize: "0.9rem", fontWeight: 600 }}>{submitOk}</div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || trips.length === 0}
          style={{
            padding: "0.85rem 1.5rem",
            background: trips.length === 0 ? "#CBD5E1" : "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: submitting || trips.length === 0 ? "not-allowed" : "pointer",
            fontWeight: 700,
            justifySelf: "start",
          }}
        >
          {submitting ? "Submitting…" : "Submit Vehicle Issue"}
        </button>
      </form>

      <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748B", lineHeight: 1.5 }}>
        After you submit, dispatch sees this under <strong style={{ color: "#334155" }}>Reported Issues</strong>, in
        operations center alerts, and on <strong style={{ color: "#334155" }}>Trip Logs</strong> for that trip.
      </p>
    </div>
  );
}
