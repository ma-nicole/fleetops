"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WorkflowApi, type Booking, type DispatchResourceAvailabilityRow } from "@/lib/workflowApi";
import { formatDateTime } from "@/lib/appLocale";
import { dispatchAssignedTripStatusLabel, isActiveAssignedTrip } from "@/lib/dispatchAssignedTripStatus";
import DispatcherRouteSetter from "@/components/DispatcherRouteSetter";
import StatusBanner from "@/components/ui/StatusBanner";

type BookingAvailability = {
  booking_id: number;
  required_truck_count: number;
  cargo_weight_tons: number;
  weight_splits: number[];
  schedule_window_start?: string;
  schedule_window_end?: string;
  trucks: { id: number; code: string; capacity_tons: number }[];
  drivers: { id: number; name: string }[];
  helpers: { id: number; name: string }[];
  truck_roster: DispatchResourceAvailabilityRow[];
  driver_roster: DispatchResourceAvailabilityRow[];
  helper_roster: DispatchResourceAvailabilityRow[];
};

function statusBadgeStyle(status: DispatchResourceAvailabilityRow["status"]): CSSProperties {
  if (status === "available") return { background: "#DCFCE7", color: "#166534" };
  if (status === "on_trip") return { background: "#DBEAFE", color: "#1D4ED8" };
  if (status === "assigned") return { background: "#FEF3C7", color: "#92400E" };
  return { background: "#F3F4F6", color: "#4B5563" };
}

function ResourceStatusBadge({ status, label }: { status: DispatchResourceAvailabilityRow["status"]; label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: 6,
        padding: "0.1rem 0.45rem",
        borderRadius: 999,
        fontSize: "0.72rem",
        fontWeight: 700,
        ...statusBadgeStyle(status),
      }}
    >
      {label}
    </span>
  );
}

function rosterById(
  roster: DispatchResourceAvailabilityRow[] | undefined,
  id: number,
): DispatchResourceAvailabilityRow | undefined {
  return roster?.find((r) => r.id === id);
}

function rosterOptionLabel(row: DispatchResourceAvailabilityRow, kind: "truck" | "crew"): string {
  const base = kind === "truck" ? `${row.code ?? row.name} · ${row.capacity_tons ?? "—"} t` : row.name;
  const next = row.next_available_at ? ` · free after ${formatDateTime(row.next_available_at)}` : "";
  return `${base} — ${row.status_label}${next}`;
}

function rosterConflictMessage(
  kind: "Truck" | "Driver" | "Helper",
  row: DispatchResourceAvailabilityRow | undefined,
): string | null {
  if (!row || row.assignable) return null;
  return row.conflict_reason ?? `${kind} is ${row.status_label.toLowerCase()} for the selected schedule.`;
}

type AssignmentRow = {
  trip_id: number;
  trip_status: string;
  operational_status?: string | null;
  booking_id: number;
  pickup_location: string;
  dropoff_location: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  cargo_weight_tons: number;
  truck_code: string;
  driver_name: string | null;
  helper_name: string | null;
  helper_progress_status: string | null;
  distance_km: number;
  latest_location: string | null;
  last_updated: string | null;
};

type DraftAssignmentRow = {
  truck_id: number;
  driver_id: number;
  helper_id: number;
  assigned_weight: number;
};

function DispatcherJobAssignmentsInner() {
  const searchParams = useSearchParams();
  const fromDriverId = searchParams.get("fromDriver");
  const fromDriverName = searchParams.get("driverName");
  const bookingIdParam = searchParams.get("bookingId");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState<number>(0);
  const [availability, setAvailability] = useState<BookingAvailability | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [draftRows, setDraftRows] = useState<DraftAssignmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setListError(null);
    try {
      const [list, board] = await Promise.all([
        WorkflowApi.assignableBookings(),
        WorkflowApi.dispatchAssignmentsBoard().catch(() => null),
      ]);
      setBookings(list);
      setAssignments((board?.assignments ?? []).filter(isActiveAssignedTrip));
      setBookingId((prev) => {
        if (list.length === 0) return 0;
        if (prev && list.some((b) => b.id === prev)) return prev;
        return list[0].id;
      });
    } catch (err) {
      setBookings([]);
      setBookingId(0);
      setListError(err instanceof Error ? err.message : "Could not load assignable bookings.");
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const n = Number(bookingIdParam);
    if (!Number.isFinite(n) || n <= 0 || bookings.length === 0) return;
    if (bookings.some((b) => b.id === n)) setBookingId(n);
  }, [bookingIdParam, bookings]);

  const selected = bookings.find((b) => b.id === bookingId);

  useEffect(() => {
    setAvailability(null);
    setAvailabilityError(null);
    setDraftRows([]);
    if (!bookingId) return;
    let cancelled = false;
    void WorkflowApi.dispatchBookingAvailability(bookingId)
      .then((res) => {
        if (cancelled) return;
        setAvailability(res);
        setDraftRows(
          res.weight_splits.map((w) => ({
            truck_id: 0,
            driver_id: 0,
            helper_id: 0,
            assigned_weight: Number(w.toFixed(3)),
          })),
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setAvailabilityError(e instanceof Error ? e.message : "Could not load available crews.");
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const selectedTruckIds = useMemo(
    () => draftRows.map((r) => r.truck_id).filter((x) => x > 0),
    [draftRows],
  );
  const selectedDriverIds = useMemo(
    () => draftRows.map((r) => r.driver_id).filter((x) => x > 0),
    [draftRows],
  );
  const selectedHelperIds = useMemo(
    () => draftRows.map((r) => r.helper_id).filter((x) => x > 0),
    [draftRows],
  );

  const updateRow = (idx: number, patch: Partial<DraftAssignmentRow>) => {
    setDraftRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const validateBeforeSubmit = (): string | null => {
    if (!selected || !availability) return "Pick a booking first.";
    if (draftRows.length !== availability.required_truck_count) {
      return `Exactly ${availability.required_truck_count} assignment rows are required.`;
    }
    for (let i = 0; i < draftRows.length; i++) {
      const row = draftRows[i];
      if (!row.truck_id || !row.driver_id || !row.helper_id) {
        return `Assignment ${i + 1} is incomplete. Truck, driver, and helper are all required.`;
      }
      const truckConflict = rosterConflictMessage("Truck", rosterById(availability.truck_roster, row.truck_id));
      if (truckConflict) return `Assignment ${i + 1}: ${truckConflict}`;
      const driverConflict = rosterConflictMessage("Driver", rosterById(availability.driver_roster, row.driver_id));
      if (driverConflict) return `Assignment ${i + 1}: ${driverConflict}`;
      const helperConflict = rosterConflictMessage("Helper", rosterById(availability.helper_roster, row.helper_id));
      if (helperConflict) return `Assignment ${i + 1}: ${helperConflict}`;
    }
    const truckSet = new Set(selectedTruckIds);
    const driverSet = new Set(selectedDriverIds);
    const helperSet = new Set(selectedHelperIds);
    if (
      truckSet.size !== draftRows.length ||
      driverSet.size !== draftRows.length ||
      helperSet.size !== draftRows.length
    ) {
      return "Duplicate truck, driver, or helper selection is not allowed within the same booking.";
    }
    const sumWeights = draftRows.reduce((s, r) => s + Number(r.assigned_weight || 0), 0);
    if (Math.abs(sumWeights - Number(selected.cargo_weight_tons)) > 0.01) {
      return "Assigned weights must total the booking cargo weight.";
    }
    return null;
  };

  const assignAll = async () => {
    const validation = validateBeforeSubmit();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await WorkflowApi.dispatchAssignBatch(bookingId, draftRows);
      setOkMsg("All crews assigned successfully.");
      await refresh();
      const av = await WorkflowApi.dispatchBookingAvailability(bookingId);
      setAvailability(av);
      setDraftRows(
        av.weight_splits.map((w) => ({
          truck_id: 0,
          driver_id: 0,
          helper_id: 0,
          assigned_weight: Number(w.toFixed(3)),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign all failed.");
    } finally {
      setBusy(false);
    }
  };

  const card: CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 18,
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  };

  const driverContext = fromDriverId || fromDriverName;

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh", overflowX: "hidden" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16, minWidth: 0, width: "100%" }}>
        <header>
          <h1 style={{ margin: 0 }}>Job Assignment</h1>
          <p style={{ color: "#6B7280", marginTop: 4 }}>
            Clear sequence: select a ready booking → assign truck → assign driver → assign helper → create trip.
            Only schedule-free resources can be selected. Resources marked <strong>On Trip</strong> stay
            locked until that live trip finishes or the booking is completed/cancelled.
          </p>
        </header>

        <ol
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            listStyle: "none",
            margin: 0,
            padding: "0.75rem 1rem",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            fontSize: "0.82rem",
            fontWeight: 600,
            color: "#334155",
          }}
        >
          {[
            "1. Select booking",
            "2. Assign truck",
            "3. Assign driver",
            "4. Assign helper",
            "5. Create trip",
          ].map((step, idx) => (
            <li
              key={step}
              style={{
                padding: "0.35rem 0.65rem",
                borderRadius: 8,
                background: bookingId && idx === 0 ? "#DBEAFE" : "#fff",
                border: "1px solid #E2E8F0",
              }}
            >
              {step}
            </li>
          ))}
        </ol>

        {loadingBookings ? <p style={{ color: "#6B7280", margin: 0 }}>Loading bookings…</p> : null}

        {listError ? (
          <StatusBanner tone="error">
            <strong>Could not load bookings.</strong> {listError}{" "}
            <code style={{ fontSize: "0.85em" }}>/workflow/booking/assignable</code>
          </StatusBanner>
        ) : null}

        {!loadingBookings && !listError && bookings.length === 0 ? (
          <StatusBanner tone="warning" title="No bookings ready to assign">
            Customers must complete payment proof, goods declaration approval, and admin cargo type validation for the
            same booking ID before dispatch.
          </StatusBanner>
        ) : null}

        {driverContext ? (
          <StatusBanner tone="success" title="Driver context (from Driver Activity)">
            <div>
              {fromDriverName ? <strong>{fromDriverName}</strong> : null}
              {fromDriverId ? (
                <span>
                  {fromDriverName ? " · " : null}
                  {fromDriverId}
                </span>
              ) : null}
            </div>
            <div style={{ marginTop: 8 }}>
              <Link href="/dispatcher/job-assignments" style={{ fontWeight: 600, color: "#047857", textDecoration: "underline" }}>
                Clear driver context
              </Link>
            </div>
          </StatusBanner>
        ) : null}

        {error && (
          <StatusBanner tone="error">{error}</StatusBanner>
        )}
        {okMsg && <StatusBanner tone="success">{okMsg}</StatusBanner>}

        <section style={card}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Booking</span>
            <select
              value={bookingId}
              onChange={(e) => {
                setBookingId(Number(e.target.value));
              }}
              disabled={loadingBookings || bookings.length === 0}
              style={{
                padding: 8,
                border: "1px solid #D1D5DB",
                borderRadius: 6,
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <option value={0}>{loadingBookings ? "Loading…" : "— pick a booking —"}</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.cargo_weight_tons} t · {b.pickup_location.slice(0, 36)}… → {b.status}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <p style={{ color: "#4B5563", fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
              <strong>Booking ID:</strong> #{selected.id} (same ID across payment, declaration, cargo, and trips)
              <br />
              <strong>Pickup:</strong> {selected.pickup_location}
              <br />
              <strong>Dropoff:</strong> {selected.dropoff_location}
              <br />
              <strong>Schedule:</strong> {selected.scheduled_date} · window {selected.scheduled_time_slot}
              {availability?.schedule_window_start && availability?.schedule_window_end ? (
                <>
                  {" "}
                  · planned run {formatDateTime(availability.schedule_window_start)} →{" "}
                  {formatDateTime(availability.schedule_window_end)}
                </>
              ) : null}
              {" "}
              · <strong>{selected.cargo_weight_tons} t</strong> cargo
              <br />
              <strong>Required trucks:</strong>{" "}
              {availability?.required_truck_count ??
                Math.max(1, selected.required_truck_count || Math.ceil(selected.cargo_weight_tons / 42))}
            </p>
          ) : null}

          {bookingId > 0 && selected ? (
            <div style={{ marginTop: 14 }}>
              <DispatcherRouteSetter
                bookingId={bookingId}
                pickupLocation={selected.pickup_location}
                dropoffLocation={selected.dropoff_location}
              />
            </div>
          ) : null}

          {availabilityError ? (
            <p style={{ color: "#991B1B", marginTop: 12 }}>{availabilityError}</p>
          ) : null}

          {availability ? (
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <div
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  padding: 12,
                  display: "grid",
                  gap: 10,
                  background: "#F9FAFB",
                }}
              >
                <div style={{ fontWeight: 700 }}>Resource availability for this booking window</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {(["truck", "driver", "helper"] as const).map((kind) => {
                    const roster =
                      kind === "truck"
                        ? (availability.truck_roster ??
                          availability.trucks.map((t) => ({
                            id: t.id,
                            name: t.code,
                            code: t.code,
                            capacity_tons: t.capacity_tons,
                            status: "available" as const,
                            status_label: "Available",
                            assignable: true,
                          })))
                        : kind === "driver"
                          ? (availability.driver_roster ??
                            availability.drivers.map((d) => ({
                              id: d.id,
                              name: d.name,
                              status: "available" as const,
                              status_label: "Available",
                              assignable: true,
                            })))
                          : (availability.helper_roster ??
                            availability.helpers.map((h) => ({
                              id: h.id,
                              name: h.name,
                              status: "available" as const,
                              status_label: "Available",
                              assignable: true,
                            })));
                    const title = kind === "truck" ? "Trucks" : kind === "driver" ? "Drivers" : "Helpers";
                    return (
                      <div key={kind} style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#374151" }}>
                          {roster.map((r) => (
                            <li key={r.id} style={{ marginBottom: 4 }}>
                              {kind === "truck" ? `${r.code ?? r.name} · ${r.capacity_tons ?? "—"} t` : r.name}
                              <ResourceStatusBadge status={r.status} label={r.status_label} />
                              {r.next_available_at ? (
                                <span style={{ display: "block", color: "#6B7280", marginTop: 2 }}>
                                  Next available: {formatDateTime(r.next_available_at)}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>

              {draftRows.map((row, idx) => {
                const usedTrucks = new Set(draftRows.filter((_, i) => i !== idx).map((r) => r.truck_id).filter((id) => id > 0));
                const usedDrivers = new Set(
                  draftRows.filter((_, i) => i !== idx).map((r) => r.driver_id).filter((id) => id > 0),
                );
                const usedHelpers = new Set(
                  draftRows.filter((_, i) => i !== idx).map((r) => r.helper_id).filter((id) => id > 0),
                );
                return (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 10,
                      padding: 12,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Assignment {idx + 1} of {draftRows.length}</div>
                    <div style={{ color: "#4B5563", fontSize: 13 }}>
                      Assigned weight: <strong>{row.assigned_weight} t</strong>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
                        gap: 12,
                        alignItems: "start",
                      }}
                    >
                      <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <span>Truck</span>
                        <select
                          value={row.truck_id}
                          onChange={(e) => updateRow(idx, { truck_id: Number(e.target.value) })}
                          style={{
                            padding: 8,
                            border: "1px solid #D1D5DB",
                            borderRadius: 6,
                            width: "100%",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value={0}>— truck —</option>
                          {(availability.truck_roster ?? availability.trucks.map((t) => ({
                            id: t.id,
                            name: t.code,
                            code: t.code,
                            capacity_tons: t.capacity_tons,
                            status: "available" as const,
                            status_label: "Available",
                            assignable: true,
                          })))
                            .filter((t) => !usedTrucks.has(t.id) || t.id === row.truck_id)
                            .map((t) => (
                              <option key={t.id} value={t.id} disabled={!t.assignable && t.id !== row.truck_id}>
                                {rosterOptionLabel(t, "truck")}
                              </option>
                            ))}
                        </select>
                        {row.truck_id > 0 ? (
                          <span style={{ fontSize: 12, color: "#6B7280" }}>
                            {(() => {
                              const r = rosterById(availability.truck_roster, row.truck_id);
                              return r ? (
                                <>
                                  Status: <ResourceStatusBadge status={r.status} label={r.status_label} />
                                </>
                              ) : null;
                            })()}
                          </span>
                        ) : null}
                      </label>
                      <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <span>Driver</span>
                        <select
                          value={row.driver_id}
                          onChange={(e) => updateRow(idx, { driver_id: Number(e.target.value) })}
                          style={{
                            padding: 8,
                            border: "1px solid #D1D5DB",
                            borderRadius: 6,
                            width: "100%",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value={0}>— driver —</option>
                          {(availability.driver_roster ?? availability.drivers.map((d) => ({
                            id: d.id,
                            name: d.name,
                            status: "available" as const,
                            status_label: "Available",
                            assignable: true,
                          })))
                            .filter((d) => !usedDrivers.has(d.id) || d.id === row.driver_id)
                            .map((d) => (
                              <option key={d.id} value={d.id} disabled={!d.assignable && d.id !== row.driver_id}>
                                {rosterOptionLabel(d, "crew")}
                              </option>
                            ))}
                        </select>
                        {row.driver_id > 0 ? (
                          <span style={{ fontSize: 12, color: "#6B7280" }}>
                            {(() => {
                              const r = rosterById(availability.driver_roster, row.driver_id);
                              return r ? (
                                <>
                                  Status: <ResourceStatusBadge status={r.status} label={r.status_label} />
                                </>
                              ) : null;
                            })()}
                          </span>
                        ) : null}
                      </label>
                      <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <span>Helper (required)</span>
                        <select
                          value={row.helper_id}
                          onChange={(e) => updateRow(idx, { helper_id: Number(e.target.value) })}
                          style={{
                            padding: 8,
                            border: "1px solid #D1D5DB",
                            borderRadius: 6,
                            width: "100%",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value={0}>— helper —</option>
                          {(availability.helper_roster ?? availability.helpers.map((h) => ({
                            id: h.id,
                            name: h.name,
                            status: "available" as const,
                            status_label: "Available",
                            assignable: true,
                          })))
                            .filter((h) => !usedHelpers.has(h.id) || h.id === row.helper_id)
                            .map((h) => (
                              <option key={h.id} value={h.id} disabled={!h.assignable && h.id !== row.helper_id}>
                                {rosterOptionLabel(h, "crew")}
                              </option>
                            ))}
                        </select>
                        {row.helper_id > 0 ? (
                          <span style={{ fontSize: 12, color: "#6B7280" }}>
                            {(() => {
                              const r = rosterById(availability.helper_roster, row.helper_id);
                              return r ? (
                                <>
                                  Status: <ResourceStatusBadge status={r.status} label={r.status_label} />
                                </>
                              ) : null;
                            })()}
                          </span>
                        ) : null}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={assignAll}
              disabled={!bookingId || !availability || busy}
              style={{
                padding: "10px 18px",
                background: "var(--brand-text)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              {busy ? "Assigning…" : "Assign all selected crews"}
            </button>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Assigned trips</h2>
          <p style={{ color: "#6B7280", marginTop: 0 }}>
            Live board: booking, pickup window, route, truck, driver, helper, trip status, latest location.
          </p>
          <div style={{ overflowX: "auto", width: "100%", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
            <table
              style={{
                width: "100%",
                minWidth: 900,
                borderCollapse: "collapse",
                fontSize: 13,
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left" }}>
                  <th style={{ padding: 8, width: "7%" }}>Trip</th>
                  <th style={{ padding: 8, width: "8%" }}>Booking</th>
                  <th style={{ padding: 8, width: "12%" }}>Date / slot</th>
                  <th style={{ padding: 8, width: "18%" }}>Route</th>
                  <th style={{ padding: 8, width: "6%" }}>Wt (t)</th>
                  <th style={{ padding: 8, width: "8%" }}>Truck</th>
                  <th style={{ padding: 8, width: "10%" }}>Driver</th>
                  <th style={{ padding: 8, width: "10%" }}>Helper</th>
                  <th style={{ padding: 8, width: "10%" }}>Status</th>
                  <th style={{ padding: 8, width: "11%" }}>Latest Location</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 12, color: "#6B7280" }}>
                      No assignments yet.
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.trip_id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: 8, fontWeight: 600, overflowWrap: "anywhere" }}>#{a.trip_id}</td>
                      <td style={{ padding: 8, overflowWrap: "anywhere" }}>#{a.booking_id}</td>
                      <td style={{ padding: 8, overflowWrap: "anywhere" }}>
                        {a.scheduled_date} {a.scheduled_time_slot}
                      </td>
                      <td style={{ padding: 8, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                        {a.pickup_location.slice(0, 40)}… → {a.dropoff_location.slice(0, 40)}…
                      </td>
                      <td style={{ padding: 8 }}>{a.cargo_weight_tons}</td>
                      <td style={{ padding: 8, overflowWrap: "anywhere" }}>{a.truck_code}</td>
                      <td style={{ padding: 8, overflowWrap: "anywhere" }}>{a.driver_name ?? "—"}</td>
                      <td style={{ padding: 8, overflowWrap: "anywhere" }}>{a.helper_name ?? "—"}</td>
                      <td style={{ padding: 8, overflowWrap: "anywhere" }}>
                        {dispatchAssignedTripStatusLabel(a)}
                      </td>
                      <td style={{ padding: 8, overflowWrap: "anywhere" }}>{a.latest_location ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function JobAssignmentsFallback() {
  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <p style={{ color: "#6B7280" }}>Loading job assignment…</p>
    </main>
  );
}

export default function DispatcherJobAssignmentsPage() {
  return (
    <Suspense fallback={<JobAssignmentsFallback />}>
      <DispatcherJobAssignmentsInner />
    </Suspense>
  );
}
