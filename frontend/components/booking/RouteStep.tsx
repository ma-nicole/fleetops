"use client";

import type { CustomerSite } from "@/lib/customerSites";
import { MIN_BOOKING_SITES } from "@/lib/customerSites";
import RouteDistancePreview from "./RouteDistancePreview";
import { siteMenuLabel } from "./bookingQuoteUtils";
import type { FormErrors, LiveCostQuote, QuoteGeoMeta, RouteOptionQuote } from "./wizardTypes";

type Props = {
  sites: CustomerSite[];
  hasEnoughSites: boolean;
  pickupId: string;
  dropoffId: string;
  pickup: string;
  dropoff: string;
  errors: FormErrors;
  cost: LiveCostQuote | null;
  loading: boolean;
  bookingPricingHint: string;
  routeQuoteMeta: QuoteGeoMeta | null;
  distanceWarning: string | null;
  distanceConfirmed: boolean;
  manualDistanceKm: string;
  quoteStatus: string | null;
  showApproximateRoutingWarning: boolean;
  onPickupIdChange: (id: string) => void;
  onDropoffIdChange: (id: string) => void;
  onClearError: (key: string) => void;
  onManualDistanceKmChange: (value: string) => void;
  routeOptions: RouteOptionQuote[];
  selectedRouteOptionId: string | null;
  recommendedRouteOptionId: string | null;
  travelTimeLabel: string | null;
  onSelectRouteOption: (optionId: string) => void;
};

export default function RouteStep({
  sites,
  hasEnoughSites,
  pickupId,
  dropoffId,
  pickup,
  dropoff,
  errors,
  cost,
  loading,
  bookingPricingHint,
  routeQuoteMeta,
  distanceWarning,
  distanceConfirmed,
  manualDistanceKm,
  quoteStatus,
  showApproximateRoutingWarning,
  onPickupIdChange,
  onDropoffIdChange,
  onClearError,
  onManualDistanceKmChange,
  routeOptions,
  selectedRouteOptionId,
  recommendedRouteOptionId,
  travelTimeLabel,
  onSelectRouteOption,
}: Props) {
  return (
    <div className="booking-wizard-step" style={{ display: "grid", gap: "1rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "1rem",
        }}
      >
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              marginBottom: "0.5rem",
            }}
          >
            <span>Pickup location</span>
            <span className="field-help" title="Addresses come from Sites on your customer dashboard.">
              ?
            </span>
            {pickupId && pickup.length >= 3 && !errors.pickup_location && <span className="field-valid">✓</span>}
          </label>
          <select
            className="select"
            value={pickupId}
            disabled={!hasEnoughSites}
            onChange={(e) => {
              onPickupIdChange(e.target.value);
              onClearError("pickup_location");
            }}
            style={errors.pickup_location ? { borderColor: "#F44336" } : {}}
          >
            <option value="">
              {hasEnoughSites ? "Select pickup address from your sites…" : `Add at least ${MIN_BOOKING_SITES} sites on your dashboard first…`}
            </option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {siteMenuLabel(s)}
              </option>
            ))}
          </select>
          {errors.pickup_location && (
            <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>{errors.pickup_location}</p>
          )}
        </div>

        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              marginBottom: "0.5rem",
            }}
          >
            <span>Dropoff location</span>
            <span className="field-help" title="Addresses come from Sites on your customer dashboard.">
              ?
            </span>
            {dropoffId && dropoff.length >= 3 && !errors.dropoff_location && <span className="field-valid">✓</span>}
          </label>
          <select
            className="select"
            value={dropoffId}
            disabled={!hasEnoughSites}
            onChange={(e) => {
              onDropoffIdChange(e.target.value);
              onClearError("dropoff_location");
            }}
            style={errors.dropoff_location ? { borderColor: "#F44336" } : {}}
          >
            <option value="">
              {hasEnoughSites ? "Select dropoff address from your sites…" : `Add at least ${MIN_BOOKING_SITES} sites on your dashboard first…`}
            </option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {siteMenuLabel(s)}
              </option>
            ))}
          </select>
          {errors.dropoff_location && (
            <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>{errors.dropoff_location}</p>
          )}
        </div>
      </div>

      <RouteDistancePreview
        cost={cost}
        loading={loading}
        hasEnoughSites={hasEnoughSites}
        bookingPricingHint={bookingPricingHint}
        routeQuoteMeta={routeQuoteMeta}
        distanceWarning={distanceWarning}
        distanceConfirmed={distanceConfirmed}
        manualDistanceKm={manualDistanceKm}
        quoteStatus={quoteStatus}
        showApproximateRoutingWarning={showApproximateRoutingWarning}
        onManualDistanceKmChange={onManualDistanceKmChange}
        routeOptions={routeOptions}
        selectedRouteOptionId={selectedRouteOptionId}
        recommendedRouteOptionId={recommendedRouteOptionId}
        travelTimeLabel={travelTimeLabel}
        onSelectRouteOption={onSelectRouteOption}
      />
    </div>
  );
}
