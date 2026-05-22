"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { DispatchApi } from "@/lib/dispatchApi";
import type { DispatchRouteOption } from "@/lib/dispatchRoute";

export default function DispatcherRouteSetter({
  bookingId,
  pickupLocation,
  dropoffLocation,
}: {
  bookingId: number;
  pickupLocation?: string;
  dropoffLocation?: string;
}) {
  const [options, setOptions] = useState<DispatchRouteOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await DispatchApi.getBookingRouteOptions(bookingId);
      setOptions(data.options);
      setSelectedId(data.selected_route_option_id);
    } catch (e) {
      setOptions([]);
      setSelectedId(null);
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
      setOptions(data.options);
      setSelectedId(data.selected_route_option_id);
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
      setOptions(data.options);
      setSelectedId(data.selected_route_option_id);
      setOkMsg("Route saved for this booking.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save route selection.");
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
            Select the route before assigning drivers. Assignment uses the saved route when available; otherwise the
            existing dispatch routing fallback applies.
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
            disabled={busy || !selectedId}
            onClick={() => void saveSelection()}
            style={{
              padding: "0.45rem 0.75rem",
              borderRadius: 6,
              border: "none",
              background: "#2563EB",
              color: "#fff",
              cursor: busy ? "wait" : "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            Save route
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
          No route options yet. Click <strong>Generate options</strong> to build candidates for this booking.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {options.map((opt) => (
            <label
              key={opt.id}
              style={{
                display: "grid",
                gap: 4,
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${selectedId === opt.id ? "#2563EB" : "#E5E7EB"}`,
                background: selectedId === opt.id ? "#EFF6FF" : "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  name={`route-option-${bookingId}`}
                  checked={selectedId === opt.id}
                  onChange={() => setSelectedId(opt.id)}
                />
                <strong style={{ fontSize: "0.88rem" }}>
                  Option #{opt.rank} · {opt.distance_km.toFixed(1)} km · {formatPhp(opt.total_cost)}
                </strong>
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
              </div>
              <span style={{ fontSize: "0.8rem", color: "#4B5563" }}>
                {opt.path.join(" → ")}
              </span>
              <span style={{ fontSize: "0.78rem", color: "#6B7280" }}>
                Fuel {formatPhp(opt.fuel_cost)} · Toll {formatPhp(opt.toll_cost)} · Source {opt.source}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
