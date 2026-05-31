"use client";

import { WorkflowApi, type DriverVehicleIssueSelectableTrip } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "trip_completion", label: "Trip completion" },
  { value: "delay_report", label: "Delay report" },
  { value: "vehicle_concern", label: "Vehicle concern" },
  { value: "delivery_issue", label: "Delivery issue" },
  { value: "fuel_log", label: "Fuel log" },
  { value: "incident_report", label: "Incident report" },
  { value: "general_operational_update", label: "General operational update" },
];

const TRIP_STATUSES: { value: string; label: string }[] = [
  { value: "", label: "— Not specified —" },
  { value: "assigned", label: "Assigned" },
  { value: "for_pickup", label: "For pickup" },
  { value: "picked_up", label: "Picked up" },
  { value: "en_route", label: "En route" },
  { value: "dropped_off", label: "Dropped off" },
  { value: "completed", label: "Completed" },
];

export default function DriverGeneralFormPage() {
  useRoleGuard(["driver"]);

  const [trips, setTrips] = useState<DriverVehicleIssueSelectableTrip[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const [tripId, setTripId] = useState<number | "">("");
  const [reportDate, setReportDate] = useState("");
  const [category, setCategory] = useState("");
  const [tripStatus, setTripStatus] = useState("");
  const [startOdo, setStartOdo] = useState("");
  const [endOdo, setEndOdo] = useState("");
  const [fuelConsumed, setFuelConsumed] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedOk, setSubmittedOk] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    setLoadError(null);
    try {
      const res = await WorkflowApi.driverGeneralOperationalFormTrips();
      setTrips(res.trips ?? []);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Could not load trips.");
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
    setReportDate(todayIsoDate());
  }, [loadTrips]);

  const selected = useMemo(
    () => (tripId === "" ? undefined : trips.find((t) => t.trip_id === tripId)),
    [tripId, trips],
  );

  const resetForm = () => {
    setTripId("");
    setReportDate(todayIsoDate());
    setCategory("");
    setTripStatus("");
    setStartOdo("");
    setEndOdo("");
    setFuelConsumed("");
    setDescription("");
    setNotes("");
    setFile(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmittedOk(null);
    if (tripId === "") {
      setSubmitError("Select the related trip.");
      return;
    }
    if (!reportDate.trim()) {
      setSubmitError("Report date is required.");
      return;
    }
    if (!category) {
      setSubmitError("Select a report category.");
      return;
    }
    if (description.trim().length < 10) {
      setSubmitError("Main description must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("trip_id", String(tripId));
      fd.append("report_date", reportDate.trim());
      fd.append("category", category);
      fd.append("trip_status", tripStatus);
      fd.append("starting_odometer", startOdo.trim());
      fd.append("ending_odometer", endOdo.trim());
      fd.append("fuel_consumed", fuelConsumed.trim());
      fd.append("description", description.trim());
      fd.append("notes", notes.trim());
      if (file) fd.append("file", file);
      const res = await WorkflowApi.driverSubmitGeneralOperationalReport(fd);
      setSubmittedOk(`Form #${res.id} saved. Dispatch and trip logs will show this record.`);
      resetForm();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "560px",
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

  if (submittedOk) {
    return (
      <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.5rem", maxWidth: "720px" }}>
        <div
          style={{
            padding: "2rem",
            background: "rgba(76, 175, 80, 0.12)",
            border: "2px solid #4CAF50",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#15803D", margin: "0 0 0.5rem 0" }}>Submitted</h2>
          <p style={{ color: "#475569", margin: 0 }}>{submittedOk}</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setSubmittedOk(null);
              void loadTrips();
            }}
            style={{
              padding: "0.75rem 1.25rem",
              background: "#FF9800",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Submit another
          </button>
          <Link
            href="/driver/dashboard"
            style={{
              padding: "0.75rem 1.25rem",
              background: "#F1F5F9",
              color: "#0F172A",
              borderRadius: "8px",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.5rem", maxWidth: "920px" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>General Form</h1>
        <p style={{ color: "#666666", margin: 0, lineHeight: 1.55, maxWidth: "42rem" }}>
          Submit trip-related operational details, issues, updates, or completion information. Data is saved to the
          fleet database and appears in dispatcher log views, trip logs, and booking monitoring (staff only).
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
            padding: "1.25rem",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            background: "#FAFAFA",
            color: "#475569",
          }}
        >
          No eligible trips found. You need an active or recently completed assigned trip to file this form.
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gap: "1.15rem",
          padding: "1.5rem",
          border: "1px solid #E8E8E8",
          borderRadius: "10px",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        }}
      >
        <div>
          <label htmlFor="gf-trip" style={labelStyle}>
            Related trip <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <select
            id="gf-trip"
            required
            value={tripId === "" ? "" : String(tripId)}
            onChange={(e) => setTripId(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={trips.length === 0}
            style={inputStyle}
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
              padding: "1rem 1.2rem",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              fontSize: "0.9rem",
              color: "#334155",
              display: "grid",
              gap: "0.4rem",
            }}
          >
            <div>
              <strong>Route:</strong> {selected.route_label}
            </div>
            <div>
              <strong>Truck plate:</strong> {selected.truck_plate || "—"}
            </div>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <div>
            <label htmlFor="gf-date" style={labelStyle}>
              Date <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              id="gf-date"
              type="date"
              required
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              disabled={trips.length === 0}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="gf-cat" style={labelStyle}>
              Report category <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <select
              id="gf-cat"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={trips.length === 0}
              style={inputStyle}
            >
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="gf-trip-status" style={labelStyle}>
            Trip status (operational context)
          </label>
          <select
            id="gf-trip-status"
            value={tripStatus}
            onChange={(e) => setTripStatus(e.target.value)}
            disabled={trips.length === 0}
            style={inputStyle}
          >
            {TRIP_STATUSES.map((s) => (
              <option key={s.value || "none"} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div>
            <label htmlFor="gf-start-odo" style={labelStyle}>
              Starting odometer (km)
            </label>
            <input
              id="gf-start-odo"
              type="number"
              min={0}
              step="0.1"
              value={startOdo}
              onChange={(e) => setStartOdo(e.target.value)}
              disabled={trips.length === 0}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="gf-end-odo" style={labelStyle}>
              Ending odometer (km)
            </label>
            <input
              id="gf-end-odo"
              type="number"
              min={0}
              step="0.1"
              value={endOdo}
              onChange={(e) => setEndOdo(e.target.value)}
              disabled={trips.length === 0}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="gf-fuel" style={labelStyle}>
              Fuel consumed (liters)
            </label>
            <input
              id="gf-fuel"
              type="number"
              min={0}
              step="0.1"
              value={fuelConsumed}
              onChange={(e) => setFuelConsumed(e.target.value)}
              disabled={trips.length === 0}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label htmlFor="gf-desc" style={labelStyle}>
            Main description / report <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <textarea
            id="gf-desc"
            required
            minLength={10}
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={trips.length === 0}
            placeholder="Trip completion notes, delays, incidents, delivery details, escalation, etc."
            style={{ ...inputStyle, maxWidth: "100%", minHeight: "140px", resize: "vertical" }}
          />
        </div>

        <div>
          <label htmlFor="gf-notes" style={labelStyle}>
            Additional notes
          </label>
          <textarea
            id="gf-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={trips.length === 0}
            style={{ ...inputStyle, maxWidth: "100%", resize: "vertical" }}
          />
        </div>

        <div>
          <label htmlFor="gf-file" style={labelStyle}>
            Attachment (photo, proof, document — optional)
          </label>
          <input
            id="gf-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.img"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={trips.length === 0}
            style={{ fontSize: "0.9rem" }}
          />
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#94A3B8" }}>Max 12 MB.</p>
        </div>

        {submitError ? <div style={{ color: "#B91C1C", fontSize: "0.9rem" }}>{submitError}</div> : null}

        <button
          type="submit"
          disabled={submitting || trips.length === 0}
          style={{
            padding: "0.85rem 1.5rem",
            background: trips.length === 0 ? "#CBD5E1" : "var(--brand-text)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 700,
            cursor: submitting || trips.length === 0 ? "not-allowed" : "pointer",
            justifySelf: "start",
          }}
        >
          {submitting ? "Submitting…" : "Submit General Form"}
        </button>
      </form>
    </div>
  );
}
