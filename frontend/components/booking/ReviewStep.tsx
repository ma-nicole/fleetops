"use client";

import { formatPhp } from "@/lib/appLocale";
import SubmitButton from "@/components/ui/SubmitButton";
import LoadingMessage from "@/components/ui/LoadingMessage";
import BookingQuoteCard from "./BookingQuoteCard";
import BookingCostBreakdown from "./BookingCostBreakdown";
import type {
  FormErrors,
  FreightLineDetail,
  LiveCostQuote,
  QuoteGeoMeta,
  TollEstimateMeta,
} from "./wizardTypes";

type Props = {
  pickup: string;
  dropoff: string;
  weight: string;
  date: string;
  pickedSlot: string;
  cargoDeclaration: File | null;
  termsAgreement: File | null;
  termsAccepted: boolean;
  cost: LiveCostQuote | null;
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
  quoteLoading: boolean;
  quoteReady: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
  errors: FormErrors;
  hasEnoughSites: boolean;
  bookingPricingHint: string;
  onManualDistanceKmChange: (value: string) => void;
  onManualTollEntryChange: (value: string) => void;
  onManualTollExitChange: (value: string) => void;
  onManualVehicleClassChange: (value: string) => void;
};

function documentStatus(file: File | null): { label: string; ok: boolean } {
  if (!file) return { label: "Not uploaded", ok: false };
  return { label: file.name, ok: true };
}

export default function ReviewStep({
  pickup,
  dropoff,
  weight,
  date,
  pickedSlot,
  cargoDeclaration,
  termsAgreement,
  termsAccepted,
  cost,
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
  quoteLoading,
  quoteReady,
  canSubmit,
  isSubmitting,
  errors,
  hasEnoughSites,
  bookingPricingHint,
  onManualDistanceKmChange,
  onManualTollEntryChange,
  onManualTollExitChange,
  onManualVehicleClassChange,
}: Props) {
  const decl = documentStatus(cargoDeclaration);
  const terms = documentStatus(termsAgreement);

  return (
    <div className="booking-wizard-step" style={{ display: "grid", gap: "1.25rem" }}>
      <div className="booking-summary-card">
        <h3 className="booking-summary-card__title">Booking summary</h3>
        <dl className="booking-summary-card__list">
          <div className="booking-summary-card__row">
            <dt>Pickup</dt>
            <dd>{pickup || "—"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Dropoff</dt>
            <dd>{dropoff || "—"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Cargo weight</dt>
            <dd>{weight ? `${weight} metric tons` : "—"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Schedule date</dt>
            <dd>{date || "—"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Pickup window</dt>
            <dd>{pickedSlot || "—"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Cargo declaration</dt>
            <dd>
              <span className={decl.ok ? "booking-doc-status booking-doc-status--ok" : "booking-doc-status booking-doc-status--missing"}>
                {decl.ok ? "✓ " : ""}
                {decl.label}
              </span>
            </dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Terms &amp; Agreement</dt>
            <dd>
              <span className={terms.ok ? "booking-doc-status booking-doc-status--ok" : "booking-doc-status booking-doc-status--missing"}>
                {terms.ok ? "✓ " : ""}
                {terms.label}
              </span>
            </dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Terms accepted</dt>
            <dd>
              <span
                className={
                  termsAccepted
                    ? "booking-doc-status booking-doc-status--ok"
                    : "booking-doc-status booking-doc-status--missing"
                }
              >
                {termsAccepted ? "✓ Yes" : "Not accepted"}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {quoteLoading ? (
        <LoadingMessage label="Calculating final quote for your shipment…" size="sm" />
      ) : quoteReady && cost ? (
        <>
          <BookingCostBreakdown cost={cost} freightLines={freightLines} />
          <BookingQuoteCard
            cost={cost}
            loading={false}
            hasEnoughSites={hasEnoughSites}
            bookingPricingHint={bookingPricingHint}
            freightLines={freightLines}
            routeQuoteMeta={routeQuoteMeta}
            tollEstimateMeta={tollEstimateMeta}
            distanceWarning={distanceWarning}
            distanceConfirmed={distanceConfirmed}
            manualDistanceKm={manualDistanceKm}
            manualTollEntry={manualTollEntry}
            manualTollExit={manualTollExit}
            manualVehicleClass={manualVehicleClass}
            quoteStatus={quoteStatus}
            showApproximateRoutingWarning={showApproximateRoutingWarning}
            readOnly
            allowTollEdit
            onManualDistanceKmChange={onManualDistanceKmChange}
            onManualTollEntryChange={onManualTollEntryChange}
            onManualTollExitChange={onManualTollExitChange}
            onManualVehicleClassChange={onManualVehicleClassChange}
          />
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: "10px",
              background: "rgba(76, 175, 80, 0.08)",
              border: "1px solid rgba(76, 175, 80, 0.35)",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              Amount to be paid
            </span>
            <span style={{ fontSize: "1.35rem", fontWeight: 700, color: "#2e7d32" }}>{formatPhp(cost.quoted_total)}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
              Total quoted for this booking (before payment verification).
            </span>
          </div>
        </>
      ) : (
        <div className="booking-placeholder" role="alert">
          Could not load a quote for the entered shipment details. Check your connection and return to earlier steps if
          needed.
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div role="alert" className="booking-wizard-errors">
          {Object.values(errors).map((msg) => (
            <p key={msg} style={{ margin: "0.25rem 0", color: "#b91c1c", fontSize: "0.9rem" }}>
              {msg}
            </p>
          ))}
        </div>
      )}

      <SubmitButton
        className="button"
        type="submit"
        busy={isSubmitting}
        busyLabel="Submitting…"
        label="✓ Confirm & Book"
        disabled={!canSubmit}
        style={{
          opacity: !canSubmit ? 0.5 : 1,
          cursor: !canSubmit ? "not-allowed" : "pointer",
          padding: "1rem",
          fontSize: "1rem",
        }}
      />
    </div>
  );
}
