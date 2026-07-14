"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { DispatchApi } from "@/lib/dispatchApi";

const MAP_VERIFY_WARNING =
  "Map location could not be verified. You may continue using manual route details.";

type RouteOpt = Awaited<ReturnType<typeof DispatchApi.getBookingRouteOptions>>["options"][number];

function objectiveLabelsForOptions(options: RouteOpt[]): Map<number, string[]> {
  const labels = new Map<number, string[]>();
  if (!options.length) return labels;
  for (const o of options) labels.set(o.id, []);

  const push = (id: number, label: string) => {
    const cur = labels.get(id) ?? [];
    if (!cur.includes(label)) cur.push(label);
    labels.set(id, cur);
  };

  const byHours = [...options].sort(
    (a, b) => (a.duration_hours ?? Number.POSITIVE_INFINITY) - (b.duration_hours ?? Number.POSITIVE_INFINITY),
  );
  if (byHours[0]?.duration_hours != null) push(byHours[0].id, "Fastest Route");

  const byKm = [...options].sort((a, b) => a.distance_km - b.distance_km);
  if (byKm[0]) push(byKm[0].id, "Shortest Distance");

  const byToll = [...options].sort((a, b) => a.toll_cost - b.toll_cost);
  if (byToll[0]) {
    push(byToll[0].id, byToll[0].toll_cost <= 0.01 ? "Avoid Toll Roads" : "Lowest Toll Cost");
  }

  const byTotal = [...options].sort((a, b) => a.total_cost - b.total_cost);
  if (byTotal[0]) push(byTotal[0].id, "Balanced Route");

  for (const o of options) {
    const cur = labels.get(o.id) ?? [];
    if (!cur.length) push(o.id, o.source === "manual" ? "Manual Route" : "Generated Route");
  }
  return labels;
}

export default function DispatcherRouteSetter({
  bookingId,
  pickupLocation,
  dropoffLocation,
}: {
  bookingId: number;
  pickupLocation?: string;
  dropoffLocation?: string;
}) {
  const [options, setOptions] = useState<RouteOpt[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapWarning, setMapWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({
    route_name: "Manual route",
    distance_km: "",
    duration_hours: "",
    toll_cost_php: "",
    notes: "",
  });

  const objectiveById = useMemo(() => objectiveLabelsForOptions(options), [options]);

  const applyResponse = (data: Awaited<ReturnType<typeof DispatchApi.getBookingRouteOptions>>) => {
    setOptions(data.options);
    setSelectedId(data.selected_route_option_id);
    setMapWarning(data.map_verification_warning ?? null);
  };

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await DispatchApi.getBookingRouteOptions(bookingId);
      applyResponse(data);
    } catch (e) {
      setOptions([]);
      setSelectedId(null);
      setMapWarning(null);
      setError(e instanceof Error ? e.message : "Could not load route options.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const data = await DispatchApi.generateBookingRouteOptions(bookingId);
      applyResponse(data);
      setOkMsg(`Generated ${data.generated} route option(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate routes.");
    } finally {
      setBusy(false);
    }
  };

  const saveSelection = async () => {
    if (!selectedId) {
      setError("Select a route option first.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const data = await DispatchApi.selectBookingRouteOption(bookingId, selectedId);
      applyResponse(data);
      setOkMsg("Route saved for this booking.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save route selection.");
    } finally {
      setBusy(false);
    }
  };

  const saveManualRoute = async () => {
    const distance = Number(manual.distance_km);
    const duration = Number(manual.duration_hours);
    const toll = manual.toll_cost_php.trim() ? Number(manual.toll_cost_php) : 0;
    if (!manual.route_name.trim()) {
      setError("Route name is required.");
      return;
    }
    if (!Number.isFinite(distance) || distance <= 0) {
      setError("Enter a valid estimated distance (km).");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Enter a valid estimated travel time (hours).");
      return;
    }
    if (manual.toll_cost_php.trim() && (!Number.isFinite(toll) || toll < 0)) {
      setError("Enter a valid toll estimate or leave blank.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const data = await DispatchApi.saveManualBookingRoute(bookingId, {
        route_name: manual.route_name.trim(),
        distance_km: distance,
        duration_hours: duration,
        toll_cost_php: toll,
        notes: manual.notes.trim() || null,
      });
      applyResponse(data);
      setOkMsg("Manual route saved for this booking.");
      setShowManual(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save manual route.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #BFDBFE",
        borderRadius: 10,
        padding: 14,
        background: "rgba(37, 99, 235, 0.04)",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <strong style={{ color: "#1E3A8A" }}>Route setter</strong>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#4B5563", lineHeight: 1.45 }}>
            Compare generated routes (fastest, shortest, lowest toll, balanced) or enter manual details. Assignment uses
            the saved route when available.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void generate()}
            style={{
              padding: "0.45rem 0.75rem",
              borderRadius: 6,
              border: "1px solid #93C5FD",
              background: "#fff",
              cursor: busy ? "wait" : "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            Generate options
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowManual((v) => !v)}
            style={{
              padding: "0.45rem 0.75rem",
              borderRadius: 6,
              border: "1px solid #FCD34D",
              background: "#FFFBEB",
              cursor: busy ? "wait" : "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            {showManual ? "Hide manual route" : "Manual route"}
          </button>
          <button
            type="button"
            disabled={busy || !selectedId}
            onClick={() => void saveSelection()}
            style={{
              padding: "0.45rem 0.75rem",
              borderRadius: 6,
              border: "none",
              background: "var(--brand-text)",
              color: "#fff",
              cursor: busy ? "wait" : "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            Save selection
          </button>
        </div>
      </div>

      {(pickupLocation || dropoffLocation) && (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151" }}>
          <strong>Pickup:</strong> {pickupLocation ?? "—"}
          <br />
          <strong>Dropoff:</strong> {dropoffLocation ?? "—"}
        </p>
      )}

      {mapWarning && (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "8px 10px",
            borderRadius: 8,
            background: "#FFFBEB",
            border: "1px solid #FCD34D",
            color: "#92400E",
            fontSize: "0.85rem",
            lineHeight: 1.45,
          }}
        >
          {mapWarning === MAP_VERIFY_WARNING ? mapWarning : `${MAP_VERIFY_WARNING} ${mapWarning}`}
        </p>
      )}

      {showManual && (
        <div
          style={{
            display: "grid",
            gap: 8,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #E5E7EB",
            background: "#fff",
          }}
        >
          <strong style={{ fontSize: "0.88rem" }}>Manual route</strong>
          <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            Route name
            <input
              value={manual.route_name}
              onChange={(e) => setManual((m) => ({ ...m, route_name: e.target.value }))}
              style={{ padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid #D1D5DB" }}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
              Distance (km)
              <input
                type="number"
                min={0}
                step={0.1}
                value={manual.distance_km}
                onChange={(e) => setManual((m) => ({ ...m, distance_km: e.target.value }))}
                style={{ padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid #D1D5DB" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
              Travel time (hours)
              <input
                type="number"
                min={0}
                step={0.1}
                value={manual.duration_hours}
                onChange={(e) => setManual((m) => ({ ...m, duration_hours: e.target.value }))}
                style={{ padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid #D1D5DB" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
              Toll estimate (PHP)
              <input
                type="number"
                min={0}
                step={1}
                value={manual.toll_cost_php}
                onChange={(e) => setManual((m) => ({ ...m, toll_cost_php: e.target.value }))}
                placeholder="Optional"
                style={{ padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid #D1D5DB" }}
              />
            </label>
          </div>
          <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            Notes
            <textarea
              rows={2}
              value={manual.notes}
              onChange={(e) => setManual((m) => ({ ...m, notes: e.target.value }))}
              style={{ padding: "0.4rem 0.5rem", borderRadius: 6, border: "1px solid #D1D5DB", resize: "vertical" }}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveManualRoute()}
            style={{
              justifySelf: "start",
              padding: "0.45rem 0.75rem",
              borderRadius: 6,
              border: "none",
              background: "#B45309",
              color: "#fff",
              cursor: busy ? "wait" : "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            Save manual route
          </button>
        </div>
      )}

      {loading && <p style={{ margin: 0, fontSize: "0.85rem", color: "#6B7280" }}>Loading route options…</p>}
      {error && (
        <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: "0.85rem" }}>
          {error}
        </p>
      )}
      {okMsg && (
        <p style={{ margin: 0, color: "#047857", fontSize: "0.85rem" }}>
          {okMsg}
        </p>
      )}

      {!loading && options.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400E" }}>
          No route options yet. Click <strong>Generate options</strong> or use <strong>Manual route</strong> if map
          placement fails.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              fontSize: "0.72rem",
              color: "#64748B",
            }}
            aria-label="Route objective legend"
          >
            {[
              "Fastest Route",
              "Shortest Distance",
              "Lowest Toll Cost",
              "Avoid Toll Roads",
              "Balanced Route",
              "Avoid Heavy Traffic (coming soon)",
            ].map((label) => (
              <span
                key={label}
                style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: 999,
                  border: "1px dashed #CBD5E1",
                  background: label.includes("coming soon") ? "#F8FAFC" : "#fff",
                  opacity: label.includes("coming soon") ? 0.7 : 1,
                }}
              >
                {label}
              </span>
            ))}
          </div>
          {options.map((opt) => {
            const objectives = objectiveById.get(opt.id) ?? [];
            return (
              <label
                key={opt.id}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 12,
                  borderRadius: 10,
                  border: `1.5px solid ${selectedId === opt.id ? "var(--brand-text)" : "#E5E7EB"}`,
                  background: selectedId === opt.id ? "#EFF6FF" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="radio"
                    name={`route-option-${bookingId}`}
                    checked={selectedId === opt.id}
                    onChange={() => setSelectedId(opt.id)}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.9rem" }}>
                        {opt.route_name ?? `Option #${opt.rank}`}
                      </strong>
                      {objectives.map((tag) => (
                        <span
                          key={`${opt.id}-${tag}`}
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            color: "#1E40AF",
                            background: "#DBEAFE",
                            padding: "0.12rem 0.45rem",
                            borderRadius: 999,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {opt.is_selected && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#047857",
                            background: "#D1FAE5",
                            padding: "0.1rem 0.45rem",
                            borderRadius: 999,
                          }}
                        >
                          Saved
                        </span>
                      )}
                      {opt.source === "manual" && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#92400E",
                            background: "#FEF3C7",
                            padding: "0.1rem 0.45rem",
                            borderRadius: 999,
                          }}
                        >
                          Manual
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                        gap: 8,
                        fontSize: "0.8rem",
                      }}
                    >
                      <div>
                        <div style={{ color: "#6B7280", fontSize: "0.7rem", fontWeight: 700 }}>Distance</div>
                        {opt.distance_km.toFixed(1)} km
                      </div>
                      <div>
                        <div style={{ color: "#6B7280", fontSize: "0.7rem", fontWeight: 700 }}>Time</div>
                        {opt.duration_hours != null ? `${opt.duration_hours.toFixed(1)} h` : "—"}
                      </div>
                      <div>
                        <div style={{ color: "#6B7280", fontSize: "0.7rem", fontWeight: 700 }}>Toll</div>
                        {formatPhp(opt.toll_cost)}
                      </div>
                      <div>
                        <div style={{ color: "#6B7280", fontSize: "0.7rem", fontWeight: 700 }}>Fuel</div>
                        {formatPhp(opt.fuel_cost)}
                      </div>
                      <div>
                        <div style={{ color: "#6B7280", fontSize: "0.7rem", fontWeight: 700 }}>Total</div>
                        {formatPhp(opt.total_cost)}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "#4B5563", lineHeight: 1.4 }}>
                      <strong>Summary:</strong> {opt.path.join(" → ")}
                    </span>
                    {opt.notes ? (
                      <span style={{ fontSize: "0.78rem", color: "#6B7280" }}>Notes: {opt.notes}</span>
                    ) : null}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
