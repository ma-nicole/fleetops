"use client";

import { formatPhp } from "@/lib/appLocale";
import type { FreightLineDetail, LiveCostQuote } from "./wizardTypes";

type Props = {
  cost: LiveCostQuote;
  freightLines: FreightLineDetail | null;
};

/** Summary cost lines from backend route-quote response — no frontend recalculation. */
export default function BookingCostBreakdown({ cost, freightLines }: Props) {
  const laborCost = cost.driver_share_php + cost.helper_share_php;

  return (
    <div className="booking-cost-breakdown">
      <h3 className="booking-cost-breakdown__title">Cost estimate breakdown</h3>
      <dl className="booking-cost-breakdown__list">
        <div className="booking-cost-breakdown__row">
          <dt>Distance</dt>
          <dd>{cost.distance_km} km</dd>
        </div>
        {freightLines ? (
          <div className="booking-cost-breakdown__row">
            <dt>Cargo weight</dt>
            <dd>
              {freightLines.booking_weight_tons.toFixed(2)} t ({freightLines.total_trucks} truck
              {freightLines.total_trucks === 1 ? "" : "s"})
            </dd>
          </div>
        ) : null}
        <div className="booking-cost-breakdown__row">
          <dt>Cargo gross (truck charge)</dt>
          <dd>{formatPhp(cost.cargo_gross_php)}</dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Fuel cost</dt>
          <dd>{formatPhp(cost.diesel_cost_php)}</dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Toll cost</dt>
          <dd>{formatPhp(cost.toll_fees_php)}</dd>
        </div>
        <div className="booking-cost-breakdown__row">
          <dt>Labor cost (driver + helper)</dt>
          <dd>{formatPhp(laborCost)}</dd>
        </div>
        <div className="booking-cost-breakdown__row booking-cost-breakdown__row--total">
          <dt>Total estimated cost</dt>
          <dd>{formatPhp(cost.quoted_total)}</dd>
        </div>
      </dl>
    </div>
  );
}
