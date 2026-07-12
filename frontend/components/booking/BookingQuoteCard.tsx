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
  readOnly?: boolean;
  allowTollEdit?: boolean;
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
  readOnly = false,
  allowTollEdit = false,
  onManualDistanceKmChange,
  onManualTollEntryChange: _onManualTollEntryChange,
  onManualTollExitChange: _onManualTollExitChange,
  onManualVehicleClassChange: _onManualVehicleClassChange,
}: Props) {
  void allowTollEdit;
  void _onManualTollEntryChange;
  void _onManualTollExitChange;
  void _onManualVehicleClassChange;
  void manualTollEntry;
  void manualTollExit;
  void manualVehicleClass;
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
        {routeQuoteMeta?.routing_method === "google_directions" ||
        routeQuoteMeta?.routing_method === "osrm" ||
        routeQuoteMeta?.routing_method === "openrouteservice" ||
        routeQuoteMeta?.routing_method === "openrouteservice_hgv" ||
        routeQuoteMeta?.routing_method === "openrouteservice_car"
          ? routeQuoteMeta?.routing_method === "google_directions"
            ? " — same engine family as Google Maps driving distance."
            : " — computed along the mapped driving route (OSM)."
          : routeQuoteMeta?.routing_method === "same_location"
            ? " — same map location."
            : routeQuoteMeta?.routing_method === "haversine_road_factor"
              ? " — legacy approximate mode."
              : "."}
      </p>
      {routeQuoteMeta?.routing_method ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", opacity: 0.92 }}>
          {routingDistanceNote(routeQuoteMeta.routing_method)}
        </p>
      ) : null}
      {providerNote ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", opacity: 0.92 }}>
          {providerNote}
        </p>
      ) : !routeQuoteMeta ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#b45309" }}>
          Sign in with the API running to get routed road kilometers and pricing (no browser-only shortcut).
        </p>
      ) : null}
      {distanceWarning && (
        <p role="alert" style={{ margin: 0, fontSize: "0.85rem", color: "#b45309", fontWeight: 600 }}>
          {distanceWarning}
        </p>
      )}
      {!distanceConfirmed && !readOnly && (
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
      {freightLines ? (
        <>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            Fuel ₱/L is loaded automatically (cached) and toll is estimated from the Toll Matrix using pickup, dropoff,
            and truck class. Cargo rate (₱650/t), 4 km/L, and crew percentages stay fixed in the app formula.
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.15rem",
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              lineHeight: 1.55,
            }}
          >
            <li>
              Booking weight {freightLines.booking_weight_tons.toFixed(2)} t → {freightLines.total_trucks} truck load(s)
              (≤42 t each) — total cargo gross {formatPhp(cost.cargo_gross_php)}
            </li>
            <li>
              Fuel (all trucks, route km ÷ 4 km/L) → {freightLines.diesel_liters.toFixed(2)} L @ ₱
              {freightLines.diesel_price_per_liter.toFixed(2)}/L → {formatPhp(freightLines.diesel_cost_php)}
              {freightLines.fuel_price_fetched_at ? (
                <span>
                  {" "}
                  · last updated {new Date(freightLines.fuel_price_fetched_at).toLocaleString()}
                  {freightLines.fuel_price_source ? ` (${freightLines.fuel_price_source})` : ""}
                </span>
              ) : null}
            </li>
            <li>
              Driver share ({freightLines.driver_freight_share_pct.toFixed(2)}% of each truck&apos;s gross) →{" "}
              {formatPhp(freightLines.driver_share_php)}
            </li>
            <li>
              Helper share ({freightLines.helper_freight_share_pct.toFixed(2)}% of each truck&apos;s gross) →{" "}
              {formatPhp(freightLines.helper_share_php)}
            </li>
            <li>
              Toll (auto from {freightLines.toll_source || "Toll Matrix"}) → {formatPhp(freightLines.toll_fees_php)}
            </li>
            {tollEstimateMeta && (
              <li style={{ listStyle: "none", marginTop: "0.5rem" }}>
                <div
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderRadius: 8,
                    background: tollEstimateMeta.matched ? "rgba(124, 58, 237, 0.08)" : "rgba(251, 191, 36, 0.12)",
                    border: `1px solid ${tollEstimateMeta.matched ? "rgba(124, 58, 237, 0.25)" : "rgba(251, 191, 36, 0.35)"}`,
                  }}
                >
                  {tollEstimateMeta.matched ? (
                    <>
                      <strong>Estimated Toll Budget</strong>
                      {tollEstimateMeta.budgetPerTruck != null && (
                        <span> — {formatPhp(tollEstimateMeta.budgetPerTruck)} per truck</span>
                      )}
                      {tollEstimateMeta.budgetTotal != null && freightLines.total_trucks > 1 && (
                        <span> ({formatPhp(tollEstimateMeta.budgetTotal)} total)</span>
                      )}
                      {tollEstimateMeta.entryPoint && tollEstimateMeta.exitPoint && (
                        <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                          {tollEstimateMeta.entryPoint} → {tollEstimateMeta.exitPoint}
                          {tollEstimateMeta.effectiveDate ? ` (effective ${tollEstimateMeta.effectiveDate.slice(0, 10)})` : ""}
                        </div>
                      )}
                      {(tollEstimateMeta.segments?.length ?? 0) > 1 ? (
                        <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.1rem", fontSize: "0.8rem" }}>
                          {tollEstimateMeta.segments!.map((seg, idx) => (
                            <li key={`${seg.entry_point}-${seg.exit_point}-${idx}`}>
                              {seg.entry_point} → {seg.exit_point}: {formatPhp(seg.toll_fee)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div style={{ fontSize: "0.85rem", color: "#6B7280", marginTop: "0.25rem" }}>
                        Source: {tollEstimateMeta.tollSource || freightLines.toll_source || "Toll Matrix"} (automatic
                        descriptive lookup).
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>Toll estimate</strong>
                      <div style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
                        {tollEstimateMeta.message ||
                          "No Toll Matrix match for this route. Flat toll fallback is included so booking can continue."}
                      </div>
                    </>
                  )}
                </div>
              </li>
            )}
            <li>
              <strong>Model:</strong> net/truck = cargo gross + fuel + driver + helper + toll (additive).
            </li>
          </ul>
          {freightLines.truck_loads.length > 0 ? (
            <div style={{ marginTop: "0.75rem" }}>
              <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.9rem" }}>Truck allocation breakdown</p>
              <div style={{ display: "grid", gap: "0.65rem" }}>
                {freightLines.truck_loads.map((t) => (
                  <div
                    key={t.truck_index}
                    style={{
                      border: "1px solid rgba(76, 175, 80, 0.25)",
                      borderRadius: "8px",
                      padding: "0.65rem 0.75rem",
                      background: "rgba(255,255,255,0.5)",
                    }}
                  >
                    <p style={{ margin: "0 0 0.35rem", fontWeight: 600, fontSize: "0.85rem" }}>Truck {t.truck_index}</p>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "1.1rem",
                        fontSize: "0.78rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      <li>Weight: {t.weight_tons.toFixed(2)} t</li>
                      <li>Distance: {t.distance_km.toFixed(2)} km</li>
                      <li>Fuel cost: {formatPhp(t.diesel_cost_php)}</li>
                      <li>Driver share: {formatPhp(t.driver_share_php)}</li>
                      <li>Helper share: {formatPhp(t.helper_share_php)}</li>
                      <li>Toll: {formatPhp(t.toll_fees_php)}</li>
                      <li style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        Net profit: {formatPhp(t.net_profit_php)}
                      </li>
                    </ul>
                  </div>
                ))}
              </div>
              <p style={{ margin: "0.65rem 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                <strong>Final totals:</strong> {freightLines.total_trucks} truck(s) — total cargo gross{" "}
                {formatPhp(cost.cargo_gross_php)} — combined net profit {formatPhp(cost.net_profit_total_php)}
              </p>
            </div>
          ) : null}
        </>
      ) : null}
      {showApproximateRoutingWarning && (
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
          Admin sets diesel and toll under Calculations.
        </p>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
          gap: "1rem",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Cargo gross</p>
          <p style={{ margin: "0.08rem 0 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            ₱650/t × tons across all loads (≤42 t per truck)
          </p>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
            {formatPhp(cost.cargo_gross_php)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total additives</p>
          <p style={{ margin: "0.08rem 0 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            fuel + driver + helper + toll (all trucks)
          </p>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
            {formatPhp(cost.additives_total_php)}
          </p>
        </div>
        <div style={{ borderLeft: "2px solid rgba(76, 175, 80, 0.3)", paddingLeft: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Combined net profit</p>
          <p style={{ margin: "0.08rem 0 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            cargo gross + additives (per truck), summed
          </p>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.4rem", fontWeight: 800, color: "#4CAF50" }}>
            {formatPhp(cost.quoted_total)}
          </p>
        </div>
      </div>
    </div>
  );
}
