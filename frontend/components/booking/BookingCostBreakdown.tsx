"use client";

import { formatPhp } from "@/lib/appLocale";
import type { FreightLineDetail, LiveCostQuote } from "./wizardTypes";

type Props = {
  cost: LiveCostQuote;
  freightLines: FreightLineDetail | null;
};

/** Summary cost lines from backend route-quote response — no frontend recalculation. */
export default function BookingCostBreakdown({ cost, freightLines }: Props) {
  const fuelPrice = freightLines?.diesel_price_per_liter;
  const fuelUpdated = freightLines?.fuel_price_fetched_at
    ? new Date(freightLines.fuel_price_fetched_at).toLocaleString()
    : null;
  const tollSource = freightLines?.toll_source || "Toll Matrix";
  const maintenance = freightLines?.maintenance_cost_php ?? 0;
  const serviceFee = freightLines?.service_fee_php ?? 0;

  return (
    <div className="booking-cost-breakdown">
      <h3 className="booking-cost-breakdown__title">Cost estimate breakdown</h3>
      <dl className="booking-cost-breakdown__list">
        <div className="booking-cost-breakdown__row">
          <dt>Distance</dt>
          <dd>{cost.distance_km} km</dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Fuel price used</dt>
          <dd>{fuelPrice != null ? `₱${fuelPrice.toFixed(2)}/L` : "—"}</dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Fuel cost</dt>
          <dd>{formatPhp(cost.diesel_cost_php)}</dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Estimated toll</dt>
          <dd>
            {formatPhp(cost.toll_fees_php)}
            {freightLines?.toll_is_estimated ? (
              <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                Nearest plazas (estimated)
              </span>
            ) : null}
          </dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Driver cost</dt>
          <dd>{formatPhp(cost.driver_share_php)}</dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Helper cost</dt>
          <dd>{formatPhp(cost.helper_share_php)}</dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Maintenance</dt>
          <dd>
            {formatPhp(maintenance)}
            <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              Not applied in current quote formula
            </span>
          </dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Service fee</dt>
          <dd>
            {formatPhp(serviceFee)}
            <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              Not applied in current quote formula
            </span>
          </dd>
        </div>
        <div className="booking-cost-breakdown__row booking-cost-breakdown__row--total">
          <dt>Grand total</dt>
          <dd>{formatPhp(cost.quoted_total)}</dd>
        </div>
      </dl>
      <p style={{ margin: "0.75rem 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
        Fuel price last updated: {fuelUpdated || "—"}
        {freightLines?.fuel_price_source ? ` · Source: ${freightLines.fuel_price_source}` : ""}
        <br />
        Toll source: {tollSource}
        {freightLines?.toll_is_estimated ? " · nearest-plaza estimate" : ""}
      </p>
    </div>
  );
}
