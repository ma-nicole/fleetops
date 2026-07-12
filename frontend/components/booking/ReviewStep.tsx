"use client";

import type { ReactNode } from "react";
import { formatPhp } from "@/lib/appLocale";
import { CARGO_TYPE_CATEGORIES } from "@/lib/cargoTypeCategories";
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
  mode?: "review" | "pricing" | "payment";
  pickup: string;
  dropoff: string;
  weight: string;
  cargoDescription?: string;
  cargoTypeCategory?: string;
  date: string;
  pickedSlot: string;
  cargoDeclaration: File | null;
  termsSignature: File | null;
  termsAccepted: boolean;
  termsScrolled: boolean;
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

function signatureStatus(file: File | null): { label: string; ok: boolean } {
  if (!file) return { label: "Not signed", ok: false };
  return { label: "Electronic signature captured", ok: true };
}

function StatusText({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={ok ? "booking-doc-status booking-doc-status--ok" : "booking-doc-status booking-doc-status--missing"}>
      {children}
    </span>
  );
}

export default function ReviewStep({
  mode = "payment",
  pickup,
  dropoff,
  weight,
  cargoDescription = "",
  cargoTypeCategory = "",
  date,
  pickedSlot,
  cargoDeclaration,
  termsSignature,
  termsAccepted,
  termsScrolled,
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
  const terms = signatureStatus(termsSignature);
  const showPricing = mode === "pricing" || mode === "payment";
  const showPayment = mode === "payment";

  return (
    <div className="booking-wizard-step" style={{ display: "grid", gap: "1.25rem" }}>
      <div className="booking-summary-card">
        <h3 className="booking-summary-card__title">Booking summary</h3>
        <dl className="booking-summary-card__list">
          <div className="booking-summary-card__row">
            <dt>Pickup</dt>
            <dd>{pickup || "-"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Dropoff</dt>
            <dd>{dropoff || "-"}</dd>
          </div>
          {cost ? (
            <div className="booking-summary-card__row">
              <dt>Selected route</dt>
              <dd>
                {cost.distance_km} km
                {routeQuoteMeta?.routing_method ? ` · ${routeQuoteMeta.routing_method.replace(/_/g, " ")}` : ""}
              </dd>
            </div>
          ) : null}
          <div className="booking-summary-card__row">
            <dt>Cargo weight</dt>
            <dd>{weight ? `${weight} metric tons` : "-"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Cargo description</dt>
            <dd>{cargoDescription.trim() || "-"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Cargo type</dt>
            <dd>
              {cargoTypeCategory
                ? CARGO_TYPE_CATEGORIES.find((c) => c.value === cargoTypeCategory)?.label ?? cargoTypeCategory
                : "-"}
            </dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Schedule date</dt>
            <dd>{date || "-"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Pickup window</dt>
            <dd>{pickedSlot || "-"}</dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Cargo declaration</dt>
            <dd>
              <StatusText ok={decl.ok}>{decl.label}</StatusText>
            </dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Terms read</dt>
            <dd>
              <StatusText ok={termsScrolled}>{termsScrolled ? "Yes" : "Scroll required"}</StatusText>
            </dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Electronic signature</dt>
            <dd>
              <StatusText ok={terms.ok}>{terms.label}</StatusText>
            </dd>
          </div>
          <div className="booking-summary-card__row">
            <dt>Terms accepted</dt>
            <dd>
              <StatusText ok={termsAccepted}>{termsAccepted ? "Yes" : "Not accepted"}</StatusText>
            </dd>
          </div>
        </dl>
      </div>

      {!showPricing ? (
        <div className="booking-placeholder">
          Review the route, cargo, schedule, and uploaded documents here. The final quotation appears on the Pricing
          Breakdown step.
        </div>
      ) : quoteLoading ? (
        <LoadingMessage label="Calculating final quote for your shipment..." size="sm" />
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
            allowTollEdit={false}
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
            <span style={{ fontSize: "1.35rem", fontWeight: 700, color: "#2e7d32" }}>
              {formatPhp(cost.quoted_total)}
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
              Total quoted for this booking before payment verification.
            </span>
          </div>
        </>
      ) : (
        <div className="booking-placeholder" role="alert">
          Could not load a quote for the entered shipment details. Check your connection and return to earlier steps if
          needed.
        </div>
      )}

      {Object.keys(errors).length > 0 ? (
        <div role="alert" className="booking-wizard-errors">
          {Object.values(errors).map((msg) => (
            <p key={msg} style={{ margin: "0.25rem 0", color: "#b91c1c", fontSize: "0.9rem" }}>
              {msg}
            </p>
          ))}
        </div>
      ) : null}

      {showPayment ? (
        <>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: "10px",
              background: "rgba(14, 165, 233, 0.08)",
              border: "1px solid rgba(14, 165, 233, 0.25)",
              display: "grid",
              gap: "0.45rem",
            }}
          >
            <strong>Payment progress</strong>
            {[
              "Booking created",
              "Booking reviewed",
              "Proceed to payment",
              "Xendit payment",
              "Payment verification",
              "Cleared for dispatch",
            ].map((label, index) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "inline-grid",
                    placeItems: "center",
                    background: index < 2 ? "#0EA5E9" : "#E0F2FE",
                    color: index < 2 ? "white" : "#0369A1",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>
                <span>{label}</span>
              </div>
            ))}
            <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              After booking creation, FleetOps opens the payment page. Xendit payments verify automatically when
              available; manual proof uploads are only used for non-Xendit methods.
            </p>
          </div>
          <SubmitButton
            className="button"
            type="submit"
            busy={isSubmitting}
            busyLabel="Submitting..."
            label="Proceed to Payment"
            disabled={!canSubmit}
            style={{
              opacity: !canSubmit ? 0.5 : 1,
              cursor: !canSubmit ? "not-allowed" : "pointer",
              padding: "1rem",
              fontSize: "1rem",
            }}
          />
        </>
      ) : null}
    </div>
  );
}
