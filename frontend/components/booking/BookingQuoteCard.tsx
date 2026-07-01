"use client";

import { formatPhp } from "@/lib/appLocale";
import LoadingMessage from "@/components/ui/LoadingMessage";
import { geocodeProviderNote, routingDistanceNote } from "./bookingQuoteUtils";
import type {
  FreightLineDetail,
  LiveCostQuote,
  QuoteGeoMeta,
  TollEstimateMeta,
} from "./wizardTypes";

type Props = {
  cost: LiveCostQuote | null;
  loading: boolean;
  hasEnoughSites: boolean;
  bookingPricingHint: string;
  freightLines: FreightLineDetail | null;
  routeQuoteMeta: QuoteGeoMeta | null;
  tollEstimateMeta: TollEstimateMeta | null;
  distanceWarning: string | null;
  distanceConfirmed: boolean;
  manualDistanceKm: string;
  manualTollEntry: string;
  manualTollExit: string;
  manualVehicleClass: string;
  quoteStatus: string | null;
  showApproximateRoutingWarning: boolean;
  compact?: boolean;
  onManualDistanceKmChange: (value: string) => void;
  onManualTollEntryChange: (value: string) => void;
  onManualTollExitChange: (value: string) => void;
  onManualVehicleClassChange: (value: string) => void;
};

export default function BookingQuoteCard({
  cost,
  loading,
  hasEnoughSites,
  bookingPricingHint,
  freightLines,
  routeQuoteMeta,
  tollEstimateMeta,
  distanceWarning,
  distanceConfirmed,
  manualDistanceKm,
  manualTollEntry,
  manualTollExit,
  manualVehicleClass,
  quoteStatus,
  showApproximateRoutingWarning,
  compact = false,
  onManualDistanceKmChange,
  onManualTollEntryChange,
  onManualTollExitChange,
  onManualVehicleClassChange,
}: Props) {
  const providerNote = geocodeProviderNote(routeQuoteMeta);

  if (loading && hasEnoughSites) {
    return <LoadingMessage label="Calculating road distance & price…" size="sm" />;
  }

  if (!cost) {
    return !loading ? <div className="booking-placeholder">{bookingPricingHint}</div> : null;
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(82, 183, 136, 0.1), rgba(82, 183, 136, 0.05))",
        border: "1px solid rgba(82, 183, 136, 0.3)",
        borderRadius: "12px",
        padding: "1rem",
        display: "grid",
        gap: "0.75rem",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
        <strong style={{ color: "var(--text-primary)" }}>Road distance: {cost.distance_km} km</strong>
        {quoteStatus && quoteStatus !== "Confirmed" && (
          <span style={{ color: "#b45309", fontWeight: 600 }}> · {quoteStatus}</span>
        )}
        {" — "}
        <strong style={{ color: "var(--text-primary)" }}>{cost.total_trucks} truck(s)</strong>
        {cost.total_trucks > 1 ? " (42 t max per truck)" : ""}
      </p>
      {!compact && routeQuoteMeta?.routing_method ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", opacity: 0.92 }}>
          {routingDistanceNote(routeQuoteMeta.routing_method)}
        </p>
      ) : null}
      {!compact && providerNote ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", opacity: 0.92 }}>{providerNote}</p>
      ) : null}
      {distanceWarning ? (
        <p role="alert" style={{ margin: 0, fontSize: "0.85rem", color: "#b45309", fontWeight: 600 }}>
          {distanceWarning}
        </p>
      ) : null}
      {!distanceConfirmed && !compact ? (
        <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", maxWidth: "16rem" }}>
          <span>Confirm estimated distance (km)</span>
          <input
            type="number"
            min={1}
            step={0.1}
            value={manualDistanceKm}
            onChange={(e) => onManualDistanceKmChange(e.target.value)}
            placeholder="e.g. 95"
            style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
          />
        </label>
      ) : null}
      {!compact && freightLines ? (
        <ul style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
          <li>
            Booking weight {freightLines.booking_weight_tons.toFixed(2)} t → {freightLines.total_trucks} truck load(s) — total
            cargo gross {formatPhp(cost.cargo_gross_php)}
          </li>
          <li>
            Fuel → {freightLines.diesel_liters.toFixed(2)} L @ ₱{freightLines.diesel_price_per_liter.toFixed(2)}/L →{" "}
            {formatPhp(freightLines.diesel_cost_php)}
          </li>
          <li>Driver share → {formatPhp(freightLines.driver_share_php)}</li>
          <li>Helper share → {formatPhp(freightLines.helper_share_php)}</li>
          <li>Toll → {formatPhp(freightLines.toll_fees_php)}</li>
          {tollEstimateMeta && !tollEstimateMeta.matched && tollEstimateMeta.plazaOptions.length > 0 ? (
            <li style={{ listStyle: "none", marginTop: "0.5rem" }}>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
                  <span>Entry toll plaza (manual)</span>
                  <select
                    value={manualTollEntry}
                    onChange={(e) => onManualTollEntryChange(e.target.value)}
                    style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
                  >
                    <option value="">— select entry plaza —</option>
                    {tollEstimateMeta.plazaOptions.map((p) => (
                      <option key={`e-${p}`} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
                  <span>Exit toll plaza (manual)</span>
                  <select
                    value={manualTollExit}
                    onChange={(e) => onManualTollExitChange(e.target.value)}
                    style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
                  >
                    <option value="">— select exit plaza —</option>
                    {tollEstimateMeta.plazaOptions.map((p) => (
                      <option key={`x-${p}`} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
                  <span>Vehicle class</span>
                  <input
                    value={manualVehicleClass}
                    onChange={(e) => onManualVehicleClassChange(e.target.value)}
                    style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
                  />
                </label>
              </div>
            </li>
          ) : null}
        </ul>
      ) : null}
      {showApproximateRoutingWarning && !compact ? (
        <p
          style={{
            margin: 0,
            fontSize: "0.82rem",
            color: "#92400E",
            background: "rgba(251, 191, 36, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "8px",
            padding: "0.5rem 0.65rem",
          }}
        >
          Rough distance / pins — use clear saved site addresses so the server can geocode and route accurately.
        </p>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
          gap: "1rem",
        }}
      >
        {!compact ? (
          <>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Cargo gross</p>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
                {formatPhp(cost.cargo_gross_php)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total additives</p>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
                {formatPhp(cost.additives_total_php)}
              </p>
            </div>
          </>
        ) : null}
        <div style={compact ? undefined : { borderLeft: "2px solid rgba(76, 175, 80, 0.3)", paddingLeft: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {compact ? "Quoted total" : "Combined net profit"}
          </p>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: compact ? "1.35rem" : "1.4rem", fontWeight: 800, color: "#4CAF50" }}>
            {formatPhp(cost.quoted_total)}
          </p>
        </div>
      </div>
    </div>
  );
}
