"use client";

import LoadingMessage from "@/components/ui/LoadingMessage";
import { geocodeProviderNote, routingDistanceNote } from "./bookingQuoteUtils";
import type { LiveCostQuote, QuoteGeoMeta } from "./wizardTypes";

type Props = {
  cost: LiveCostQuote | null;
  loading: boolean;
  hasEnoughSites: boolean;
  bookingPricingHint: string;
  routeQuoteMeta: QuoteGeoMeta | null;
  distanceWarning: string | null;
  distanceConfirmed: boolean;
  manualDistanceKm: string;
  quoteStatus: string | null;
  showApproximateRoutingWarning: boolean;
  onManualDistanceKmChange: (value: string) => void;
};

/** Route step: distance and routing preview only — no pricing totals until Review. */
export default function RouteDistancePreview({
  cost,
  loading,
  hasEnoughSites,
  bookingPricingHint,
  routeQuoteMeta,
  distanceWarning,
  distanceConfirmed,
  manualDistanceKm,
  quoteStatus,
  showApproximateRoutingWarning,
  onManualDistanceKmChange,
}: Props) {
  const providerNote = geocodeProviderNote(routeQuoteMeta);

  if (loading && hasEnoughSites) {
    return <LoadingMessage label="Calculating road distance…" size="sm" />;
  }

  if (!cost) {
    return !loading ? <div className="booking-placeholder">{bookingPricingHint}</div> : null;
  }

  return (
    <div
      className="booking-route-preview"
      style={{
        border: "1px solid rgba(82, 183, 136, 0.3)",
        borderRadius: "12px",
        padding: "1rem",
        display: "grid",
        gap: "0.65rem",
        background: "rgba(82, 183, 136, 0.05)",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
        <strong style={{ color: "var(--text-primary)" }}>Road distance: {cost.distance_km} km</strong>
        {quoteStatus && quoteStatus !== "Confirmed" && (
          <span style={{ color: "#b45309", fontWeight: 600 }}> · {quoteStatus}</span>
        )}
        {" — "}
        <strong style={{ color: "var(--text-primary)" }}>{cost.total_trucks} truck(s)</strong> estimated for routing
      </p>
      {routeQuoteMeta?.routing_method ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          {routingDistanceNote(routeQuoteMeta.routing_method)}
        </p>
      ) : null}
      {providerNote ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>{providerNote}</p>
      ) : null}
      {distanceWarning ? (
        <p role="alert" style={{ margin: 0, fontSize: "0.85rem", color: "#b45309", fontWeight: 600 }}>
          {distanceWarning}
        </p>
      ) : null}
      {!distanceConfirmed && (
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
      )}
      {showApproximateRoutingWarning ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#92400E" }}>
          Use clear saved site addresses so the server can geocode and route accurately. Full cost estimate appears on the
          final Review step after shipment details are entered.
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          Pricing is calculated from the server after you complete shipment details. The full breakdown appears on Review.
        </p>
      )}
    </div>
  );
}
