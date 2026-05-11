"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";

type BookingAvailability = {
  booking_id: number;
  required_truck_count: number;
  cargo_weight_tons: number;
  weight_splits: number[];
  trucks: { id: number; code: string; capacity_tons: number }[];
  drivers: { id: number; name: string }[];
  helpers: { id: number; name: string }[];
};

type AssignmentRow = {
  trip_id: number;
  trip_status: string;
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
      setAssignments(board?.assignments ?? []);
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
  };

  const driverContext = fromDriverId || fromDriverName;

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Job Assignment</h1>
          <p style={{ color: "#6B7280", marginTop: 4 }}>
            Shows bookings with <strong>verified payment</strong> that still need truck / driver / helper assignment.
            Capacity rules (four 42 t trucks, overlap by route duration) also apply to customer booking windows.
          </p>
        </header>

        {loadingBookings ? <p style={{ color: "#6B7280", margin: 0 }}>Loading bookings…</p> : null}

        {listError ? (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>
            <strong>Could not load bookings.</strong> {listError}{" "}
            <code style={{ fontSize: "0.85em" }}>/workflow/booking/assignable</code>
          </div>
        ) : null}

        {!loadingBookings && !listError && bookings.length === 0 ? (
          <div
            role="status"
            style={{
              background: "#FFFBEB",
              border: "1px solid #FCD34D",
              color: "#92400E",
              padding: 14,
              borderRadius: 10,
              lineHeight: 1.5,
            }}
          >
            <strong>No verified-payment bookings waiting for assignment.</strong> Customers must complete payment proof and an
            admin/manager must <strong>verify</strong> it. Approve the booking if it is still pending, then return here.
          </div>
        ) : null}

        {driverContext ? (
          <div
            role="status"
            style={{
              background: "#ECFDF5",
              border: "1px solid #6EE7B7",
              color: "#065F46",
              padding: 14,
              borderRadius: 10,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700 }}>Driver context (from Driver Activity)</div>
            <div>
              {fromDriverName ? <strong>{fromDriverName}</strong> : null}
              {fromDriverId ? (
                <span style={{ color: "#047857" }}>
                  {fromDriverName ? " · " : null}
                  {fromDriverId}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <Link href="/dispatcher/job-assignments" style={{ fontWeight: 600, color: "#047857", textDecoration: "underline" }}>
                Clear driver context
              </Link>
            </div>
          </div>
        ) : null}

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div>
        )}
        {okMsg && <div style={{ background: "#D1FAE5", color: "#047857", padding: 12, borderRadius: 8 }}>{okMsg}</div>}

        <section style={card}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Booking</span>
            <select
              value={bookingId}
              onChange={(e) => {
                setBookingId(Number(e.target.value));
              }}
              disabled={loadingBookings || bookings.length === 0}
              style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
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
              <strong>Pickup:</strong> {selected.pickup_location}
              <br />
              <strong>Dropoff:</strong> {selected.dropoff_location}
              <br />
              <strong>Schedule:</strong> {selected.scheduled_date} · window {selected.scheduled_time_slot} ·{" "}
              <strong>{selected.cargo_weight_tons} t</strong> cargo
              <br />
              <strong>Required trucks:</strong>{" "}
              {availability?.required_truck_count ??
                Math.max(1, selected.required_truck_count || Math.ceil(selected.cargo_weight_tons / 42))}
            </p>
          ) : null}

          {availabilityError ? (
            <p style={{ color: "#991B1B", marginTop: 12 }}>{availabilityError}</p>
          ) : null}

          {availability ? (
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
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
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <label style={{ display: "grid", gap: 4 }}>
                        <span>Truck</span>
                        <select
                          value={row.truck_id}
                          onChange={(e) => updateRow(idx, { truck_id: Number(e.target.value) })}
                          style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
                        >
                          <option value={0}>— truck —</option>
                          {availability.trucks
                            .filter((t) => !usedTrucks.has(t.id) || t.id === row.truck_id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.code} · {t.capacity_tons} t
                              </option>
                            ))}
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 4 }}>
                        <span>Driver</span>
                        <select
                          value={row.driver_id}
                          onChange={(e) => updateRow(idx, { driver_id: Number(e.target.value) })}
                          style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
                        >
                          <option value={0}>— driver —</option>
                          {availability.drivers
                            .filter((d) => !usedDrivers.has(d.id) || d.id === row.driver_id)
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 4 }}>
                        <span>Helper (required)</span>
                        <select
                          value={row.helper_id}
                          onChange={(e) => updateRow(idx, { helper_id: Number(e.target.value) })}
                          style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
                        >
                          <option value={0}>— helper —</option>
                          {availability.helpers
                            .filter((h) => !usedHelpers.has(h.id) || h.id === row.helper_id)
                            .map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                        </select>
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
                background: "#2563EB",
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
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left" }}>
                  <th style={{ padding: 8 }}>Trip</th>
                  <th style={{ padding: 8 }}>Booking</th>
                  <th style={{ padding: 8 }}>Date / slot</th>
                  <th style={{ padding: 8 }}>Route</th>
                  <th style={{ padding: 8 }}>Wt (t)</th>
                  <th style={{ padding: 8 }}>Truck</th>
                  <th style={{ padding: 8 }}>Driver</th>
                  <th style={{ padding: 8 }}>Helper</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Latest Location</th>
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
                      <td style={{ padding: 8, fontWeight: 600 }}>#{a.trip_id}</td>
                      <td style={{ padding: 8 }}>#{a.booking_id}</td>
                      <td style={{ padding: 8 }}>
                        {a.scheduled_date} {a.scheduled_time_slot}
                      </td>
                      <td style={{ padding: 8, maxWidth: 220 }}>
                        {a.pickup_location.slice(0, 40)}… → {a.dropoff_location.slice(0, 40)}…
                      </td>
                      <td style={{ padding: 8 }}>{a.cargo_weight_tons}</td>
                      <td style={{ padding: 8 }}>{a.truck_code}</td>
                      <td style={{ padding: 8 }}>{a.driver_name ?? "—"}</td>
                      <td style={{ padding: 8 }}>{a.helper_name ?? "—"}</td>
                      <td style={{ padding: 8, textTransform: "capitalize" }}>
                        {(a.helper_progress_status || a.trip_status || "—").replace(/_/g, " ")}
                      </td>
                      <td style={{ padding: 8 }}>{a.latest_location ?? "—"}</td>
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
