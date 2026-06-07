"use client";

import { useEffect, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { TollPlazaApi } from "@/lib/tollPlazaApi";
import { TollMatrixApi } from "@/lib/tollMatrixApi";
import type { Booking } from "@/lib/workflowApi";

type Props = {
  booking?: Booking | null;
  bookingId?: number;
  compact?: boolean;
  onUpdated?: (updated: Partial<Booking>) => void;
};

const inputStyle: React.CSSProperties = {
  padding: "0.5rem",
  borderRadius: 6,
  border: "1px solid #E5E7EB",
  width: "100%",
};

export default function BookingTollReviewPanel({
  booking,
  bookingId: bookingIdProp,
  compact = false,
  onUpdated,
}: Props) {
  const bookingId = booking?.id ?? bookingIdProp ?? 0;
  const [entry, setEntry] = useState(booking?.toll_entry_point ?? "");
  const [exit, setExit] = useState(booking?.toll_exit_point ?? "");
  const [vehicleClass, setVehicleClass] = useState(booking?.vehicle_class_used ?? "Class 3");
  const [distanceKm, setDistanceKm] = useState("");
  const [plazaOptions, setPlazaOptions] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void TollPlazaApi.options()
      .then((rows) => setPlazaOptions(rows.map((r) => r.name)))
      .catch(() => setPlazaOptions([]));
  }, []);

  useEffect(() => {
    if (!booking) return;
    setEntry(booking.toll_entry_point ?? "");
    setExit(booking.toll_exit_point ?? "");
    setVehicleClass(booking.vehicle_class_used ?? "Class 3");
  }, [booking]);

  const previewFee = async () => {
    if (!entry || !exit) return;
    setError(null);
    try {
      const matrix = await TollMatrixApi.list("active");
      const row = matrix.find(
        (r) =>
          r.entry_point.toLowerCase() === entry.toLowerCase() &&
          r.exit_point.toLowerCase() === exit.toLowerCase() &&
          r.vehicle_class === vehicleClass
      );
      setResult(row ? `Matrix toll fee: ${formatPhp(row.toll_fee)}` : "No matrix row for this entry/exit/class.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  };

  const applyOverride = async () => {
    if (!bookingId || !entry || !exit) {
      setError("Booking ID, entry plaza, and exit plaza are required.");
      return;
    }
    const dist = distanceKm.trim() ? Number(distanceKm) : undefined;
    if (distanceKm.trim() && (!Number.isFinite(dist) || (dist ?? 0) <= 0)) {
      setError("Distance override must be a positive number (km).");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const updated = await TollPlazaApi.overrideBookingToll(bookingId, {
        toll_entry_point: entry,
        toll_exit_point: exit,
        vehicle_class: vehicleClass,
        distance_km_override: dist,
      });
      setResult(
        `Booking #${bookingId} updated — toll matched: ${updated.toll_matrix_matched ? "yes" : "no"}, budget ${formatPhp(Number(updated.estimated_toll_budget_php) || 0)}, quoted ${formatPhp(Number(updated.estimated_cost) || 0)}`
      );
      onUpdated?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setLoading(false);
    }
  };

  const showCurrent =
    booking &&
    (booking.estimated_toll_budget_php != null ||
      booking.toll_entry_point ||
      booking.toll_estimate_message);

  return (
    <div style={{ maxWidth: compact ? "100%" : "40rem" }}>
      {!compact && (
        <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Set entry/exit plazas and vehicle class. Toll fee is resolved from the Toll Matrix only. Optionally override
          distance (km) when geocoding could not verify the route.
        </p>
      )}

      {showCurrent && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "0.75rem",
            borderRadius: 8,
            background: booking.toll_matrix_matched ? "rgba(124, 58, 237, 0.08)" : "rgba(251, 191, 36, 0.12)",
            border: `1px solid ${booking.toll_matrix_matched ? "rgba(124, 58, 237, 0.25)" : "rgba(251, 191, 36, 0.35)"}`,
          }}
        >
          <strong>Current toll estimate</strong>
          {booking.estimated_toll_budget_php != null && (
            <span> — {formatPhp(booking.estimated_toll_budget_php)} per truck</span>
          )}
          {booking.toll_entry_point && booking.toll_exit_point && (
            <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
              {booking.toll_entry_point} → {booking.toll_exit_point}
              {booking.vehicle_class_used ? ` · ${booking.vehicle_class_used}` : ""}
            </div>
          )}
          {!booking.toll_matrix_matched && booking.toll_estimate_message && (
            <div style={{ fontSize: "0.85rem", marginTop: "0.35rem", color: "#92400E" }}>
              {booking.toll_estimate_message}
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: 6, marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}
      {result && (
        <div style={{ background: "#D1FAE5", color: "#047857", padding: "0.75rem", borderRadius: 6, marginBottom: "0.75rem" }}>
          {result}
        </div>
      )}

      <div className="card" style={{ padding: compact ? "1rem" : "1.25rem", display: "grid", gap: "0.75rem" }}>
        {!booking && (
          <label style={{ display: "grid", gap: 4 }}>
            <span>Booking ID</span>
            <input value={bookingId || ""} readOnly style={{ ...inputStyle, background: "#F9FAFB" }} />
          </label>
        )}
        <label style={{ display: "grid", gap: 4 }}>
          <span>Entry plaza</span>
          <select value={entry} onChange={(e) => setEntry(e.target.value)} style={inputStyle}>
            <option value="">— select entry plaza —</option>
            {plazaOptions.map((n) => (
              <option key={`e-${n}`} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Exit plaza</span>
          <select value={exit} onChange={(e) => setExit(e.target.value)} style={inputStyle}>
            <option value="">— select exit plaza —</option>
            {plazaOptions.map((n) => (
              <option key={`x-${n}`} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Vehicle class</span>
          <input value={vehicleClass} onChange={(e) => setVehicleClass(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Distance override (km, optional)</span>
          <input
            type="number"
            min={1}
            step={0.1}
            placeholder="Use when distance could not be verified"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            style={inputStyle}
          />
        </label>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={() => void previewFee()} style={secondaryBtn}>
            Preview matrix fee
          </button>
          <button type="button" disabled={loading || !bookingId} onClick={() => void applyOverride()} style={primaryBtn}>
            {loading ? "Applying…" : "Apply toll & distance"}
          </button>
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "#7C3AED",
  color: "white",
  border: "none",
  borderRadius: 6,
  fontWeight: 600,
  cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "white",
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  fontWeight: 600,
  cursor: "pointer",
};
