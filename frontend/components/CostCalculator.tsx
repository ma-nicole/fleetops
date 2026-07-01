"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { BOOKING_TIME_SLOTS } from "@/lib/bookingSlots";
import { routeUsesGeocodedPinsBoth } from "@/lib/bookingRouteEstimate";
import { MIN_BOOKING_SITES, loadCustomerSites, subscribeSitesChanged } from "@/lib/customerSites";
import { customerBookingPaymentPath } from "@/lib/customerPaymentNavigation";
import { WorkflowApi } from "@/lib/workflowApi";
import BookingWizardStepper from "@/components/booking/BookingWizardStepper";
import RouteStep from "@/components/booking/RouteStep";
import ShipmentStep from "@/components/booking/ShipmentStep";
import DocumentsStep from "@/components/booking/DocumentsStep";
import ReviewStep from "@/components/booking/ReviewStep";
import { freightLinesFromPayload } from "@/components/booking/bookingQuoteUtils";
import { isWizardStepComplete, validateWizardStep } from "@/components/booking/bookingWizardValidation";
import {
  BOOKING_WIZARD_STEPS,
  type BookingWizardStep,
  type FormErrors,
  type LiveCostQuote,
  type QuotedCostBreakdown,
  type QuoteGeoMeta,
  type RouteQuoteApiResponse,
  type TollEstimateMeta,
} from "@/components/booking/wizardTypes";

const DEFAULT_SERVICE_TYPE = "fixed";

const STEP_ORDER: BookingWizardStep[] = BOOKING_WIZARD_STEPS.map((s) => s.id);

export default function CostCalculator({
  onQuotedBreakdown,
}: {
  onQuotedBreakdown?: (breakdown: QuotedCostBreakdown) => void;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<BookingWizardStep>("route");
  const [pickupId, setPickupId] = useState("");
  const [dropoffId, setDropoffId] = useState("");
  const [sites, setSites] = useState<Awaited<ReturnType<typeof loadCustomerSites>>>([]);
  const [weight, setWeight] = useState("1");
  const [cost, setCost] = useState<LiveCostQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [date, setDate] = useState("");
  const [pickedSlot, setPickedSlot] = useState<string>("");
  const [slotAvailability, setSlotAvailability] = useState<Record<string, boolean>>({});
  const [slotAvailableTrucks, setSlotAvailableTrucks] = useState<Record<string, number>>({});
  const [requiredTrucksFromApi, setRequiredTrucksFromApi] = useState<number>(1);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsFetchError, setSlotsFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routeQuoteMeta, setRouteQuoteMeta] = useState<QuoteGeoMeta | null>(null);
  const [tollEstimateMeta, setTollEstimateMeta] = useState<TollEstimateMeta | null>(null);
  const [manualTollEntry, setManualTollEntry] = useState("");
  const [manualTollExit, setManualTollExit] = useState("");
  const [manualVehicleClass, setManualVehicleClass] = useState("Class 3");
  const [manualDistanceKm, setManualDistanceKm] = useState("");
  const [distanceConfirmed, setDistanceConfirmed] = useState(true);
  const [distanceWarning, setDistanceWarning] = useState<string | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<string | null>(null);
  const [freightLines, setFreightLines] = useState<Awaited<ReturnType<typeof freightLinesFromPayload>> | null>(null);
  const [cargoDeclaration, setCargoDeclaration] = useState<File | null>(null);
  const [termsAgreement, setTermsAgreement] = useState<File | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const hasEnoughSites = sites.length >= MIN_BOOKING_SITES;

  const pickup = useMemo(() => sites.find((s) => s.id === pickupId)?.address ?? "", [sites, pickupId]);
  const dropoff = useMemo(() => sites.find((s) => s.id === dropoffId)?.address ?? "", [sites, dropoffId]);

  const showApproximateRoutingWarning = useMemo(() => {
    if (routeQuoteMeta) {
      const { pickup_resolution: pr, dropoff_resolution: dr, pricing_tier: t, routing_method: rm } = routeQuoteMeta;
      if (pr === "none" || dr === "none") return true;
      if (t !== "geocoded") return true;
      if (rm === "haversine_road_factor") return true;
      return false;
    }
    return !routeUsesGeocodedPinsBoth(pickup, dropoff);
  }, [routeQuoteMeta, pickup, dropoff]);

  const validationContext = useMemo(
    () => ({
      sitesCount: sites.length,
      pickupId,
      dropoffId,
      pickup,
      dropoff,
      weight,
      date,
      today,
      pickedSlot,
      slotsLoading,
      slotAvailability,
      slotAvailableTrucks,
      requiredTrucksFromApi,
      cargoDeclaration,
      termsAgreement,
      termsAccepted,
    }),
    [
      sites.length,
      pickupId,
      dropoffId,
      pickup,
      dropoff,
      weight,
      date,
      today,
      pickedSlot,
      slotsLoading,
      slotAvailability,
      slotAvailableTrucks,
      requiredTrucksFromApi,
      cargoDeclaration,
      termsAgreement,
      termsAccepted,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      loadCustomerSites()
        .then((list) => {
          if (!cancelled) setSites(list);
        })
        .catch(() => undefined);
    };
    refresh();
    return subscribeSitesChanged(refresh);
  }, []);

  useEffect(() => {
    const ids = new Set(sites.map((s) => s.id));
    setPickupId((id) => (id && ids.has(id) ? id : ""));
    setDropoffId((id) => (id && ids.has(id) ? id : ""));
  }, [sites]);

  useEffect(() => {
    if (!hasEnoughSites) {
      setSlotAvailability({});
      setSlotAvailableTrucks({});
      setRequiredTrucksFromApi(1);
      setPickedSlot("");
      setSlotsFetchError(null);
      setSlotsLoading(false);
      return;
    }
    if (!date) {
      setSlotAvailability({});
      setSlotAvailableTrucks({});
      setRequiredTrucksFromApi(1);
      setPickedSlot("");
      setSlotsFetchError(null);
      setSlotsLoading(false);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsFetchError(null);
    setPickedSlot("");

    void WorkflowApi.bookingPickupSlotAvailability(date, {
      cargo_weight_tons: Number.isFinite(parseFloat(weight)) ? parseFloat(weight) : 1,
      pickup_location: pickup,
      dropoff_location: dropoff,
    })
      .then((res) => {
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        for (const s of BOOKING_TIME_SLOTS) {
          next[s] = res.slots?.[s] !== false;
        }
        setSlotAvailability(next);
        setSlotAvailableTrucks(res.available_trucks_by_slot ?? {});
        setRequiredTrucksFromApi(
          typeof res.required_trucks === "number" && Number.isFinite(res.required_trucks)
            ? Math.max(1, Math.floor(res.required_trucks))
            : 1,
        );
      })
      .catch((e) => {
        if (!cancelled) {
          const next: Record<string, boolean> = {};
          for (const s of BOOKING_TIME_SLOTS) next[s] = true;
          setSlotAvailability(next);
          setSlotAvailableTrucks({});
          setRequiredTrucksFromApi(Math.max(1, Math.ceil((Number.parseFloat(weight) || 1) / 42)));
          setSlotsFetchError(e instanceof Error ? e.message : "Could not load pickup windows.");
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, hasEnoughSites, pickup, dropoff, weight]);

  useEffect(() => {
    if (!hasEnoughSites) {
      setCost(null);
      setRouteQuoteMeta(null);
      setTollEstimateMeta(null);
      setFreightLines(null);
      setLoading(false);
      return;
    }

    const p = pickup.trim();
    const d = dropoff.trim();
    const w = parseFloat(weight);

    if (!pickupId || !dropoffId || pickupId === dropoffId || p.length < 3 || d.length < 3 || p.toLowerCase() === d.toLowerCase()) {
      setCost(null);
      setRouteQuoteMeta(null);
      setTollEstimateMeta(null);
      setFreightLines(null);
      setLoading(false);
      return;
    }

    const effW = Number.isFinite(w) && w > 0 ? Math.min(168, w) : 1;

    let cancelled = false;
    const ac = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await apiFetch<RouteQuoteApiResponse>("/customer/route-quote", {
            method: "POST",
            body: JSON.stringify({
              pickup_location: pickup,
              dropoff_location: dropoff,
              weight_tons: effW,
              toll_entry_point: manualTollEntry.trim() || undefined,
              toll_exit_point: manualTollExit.trim() || undefined,
              vehicle_class: manualVehicleClass.trim() || undefined,
              distance_km_override: manualDistanceKm.trim() ? Number(manualDistanceKm) : undefined,
            }),
            signal: ac.signal,
          });
          if (cancelled) return;
          setMessage("");
          setMessageType("");
          const live: LiveCostQuote = {
            distance_km: data.distance_km,
            total_trucks: data.total_trucks,
            cargo_gross_php: data.cargo_gross_php,
            diesel_cost_php: data.diesel_cost_php,
            driver_share_php: data.driver_share_php,
            helper_share_php: data.helper_share_php,
            toll_fees_php: data.toll_fees_php,
            additives_total_php: data.additives_total_php,
            net_profit_total_php: data.net_profit_total_php,
            quoted_total: data.quoted_total,
            truck_loads: data.truck_loads,
          };
          setCost(live);
          setRouteQuoteMeta({
            pickup_resolution: data.pickup_resolution,
            dropoff_resolution: data.dropoff_resolution,
            pricing_tier: data.pricing_tier,
            routing_method: data.routing_method,
          });
          setTollEstimateMeta({
            matched: Boolean(data.toll_matrix_matched),
            message: data.toll_estimate_message ?? null,
            entryPoint: data.toll_entry_point ?? null,
            exitPoint: data.toll_exit_point ?? null,
            effectiveDate: data.toll_effective_date ?? null,
            budgetPerTruck: data.estimated_toll_budget_per_truck ?? null,
            budgetTotal: data.estimated_toll_budget_total ?? null,
            plazaOptions: data.toll_plaza_options ?? [],
            suggestedEntry: data.suggested_toll_entry_point ?? null,
            suggestedExit: data.suggested_toll_exit_point ?? null,
          });
          setDistanceConfirmed(data.distance_confirmed !== false);
          setDistanceWarning(data.distance_warning ?? null);
          setQuoteStatus(data.quote_status ?? null);
          setFreightLines(freightLinesFromPayload(data));
          onQuotedBreakdown?.({
            cargo_gross_php: live.cargo_gross_php,
            toll_fees_php: live.toll_fees_php,
            labor_freight_php: live.driver_share_php + live.helper_share_php,
            quoted_total_php: live.quoted_total,
          });
        } catch (e: unknown) {
          if (cancelled) return;
          if (e instanceof DOMException && e.name === "AbortError") return;
          setCost(null);
          setRouteQuoteMeta(null);
          setTollEstimateMeta(null);
          setFreightLines(null);
          if (e instanceof ApiError) {
            setMessage(e.message);
            setMessageType("error");
            return;
          }
          setMessage("Could not compute road distance. Check your connection and that the API is running.");
          setMessageType("error");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 220);

    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [
    pickup,
    dropoff,
    weight,
    onQuotedBreakdown,
    hasEnoughSites,
    pickupId,
    dropoffId,
    manualTollEntry,
    manualTollExit,
    manualVehicleClass,
    manualDistanceKm,
  ]);

  const bookingPricingHint = !hasEnoughSites
    ? `Save at least ${MIN_BOOKING_SITES} sites on your dashboard — booking is disabled until then.`
    : "Select pickup and dropoff — server geocoding runs when you save (needs backend online).";

  const requiredTrucks = Math.max(1, requiredTrucksFromApi || Math.ceil((parseFloat(weight) || 1) / 42));
  const selectedAvailableTrucks = pickedSlot ? (slotAvailableTrucks[pickedSlot] ?? 0) : 0;

  const canSubmit =
    hasEnoughSites &&
    !!cost &&
    !isSubmitting &&
    !!pickedSlot &&
    slotAvailability[pickedSlot] !== false &&
    (slotAvailableTrucks[pickedSlot] ?? 0) >= requiredTrucksFromApi &&
    !slotsLoading &&
    !!cargoDeclaration &&
    !!termsAgreement &&
    termsAccepted &&
    distanceConfirmed;

  const canGoNext = useMemo(() => {
    if (!isWizardStepComplete(currentStep, validationContext)) return false;
    if (currentStep === "route") {
      return !!cost && !loading && distanceConfirmed;
    }
    return true;
  }, [currentStep, validationContext, cost, loading, distanceConfirmed]);

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEP_ORDER.length - 1;

  const clearError = useCallback((key: string) => {
    setErrors((er) => (er[key] ? { ...er, [key]: "" } : er));
  }, []);

  const clearErrors = useCallback((keys: string[]) => {
    setErrors((er) => {
      const next = { ...er };
      let changed = false;
      for (const key of keys) {
        if (next[key]) {
          next[key] = "";
          changed = true;
        }
      }
      return changed ? next : er;
    });
  }, []);

  const handleNext = () => {
    const stepErrors = validateWizardStep(currentStep, validationContext);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    if (currentStep === "route" && (!cost || loading || !distanceConfirmed)) return;
    if (!isLastStep) {
      setCurrentStep(STEP_ORDER[currentStepIndex + 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(STEP_ORDER[currentStepIndex - 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sites.length < MIN_BOOKING_SITES) return;

    const allErrors = validateWizardStep("review", validationContext);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) return;
    if (!canSubmit) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      const data = await WorkflowApi.createBookingWithDocuments({
        pickup_location: pickup,
        dropoff_location: dropoff,
        service_type: DEFAULT_SERVICE_TYPE,
        scheduled_date: date,
        scheduled_time_slot: pickedSlot,
        cargo_weight_tons: parseFloat(weight),
        terms_agreed: termsAccepted,
        cargo_declaration: cargoDeclaration!,
        terms_agreement: termsAgreement!,
        toll_entry_point: manualTollEntry.trim() || undefined,
        toll_exit_point: manualTollExit.trim() || undefined,
        vehicle_class: manualVehicleClass.trim() || undefined,
        distance_km_override: manualDistanceKm.trim() ? Number(manualDistanceKm) : undefined,
      });

      router.push(customerBookingPaymentPath(data.id));
    } catch (error) {
      const err = error as Error;
      setMessage(` Error: ${err.message}`);
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {!hasEnoughSites && (
        <div
          role="alert"
          style={{
            padding: "1rem",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(220, 38, 38, 0.45)",
            color: "#b91c1c",
            fontSize: "0.95rem",
          }}
        >
          <strong>Booking not available yet.</strong> Add at least {MIN_BOOKING_SITES} site addresses under{" "}
          <Link href="/dashboard/customer" style={{ fontWeight: 700, color: "inherit" }}>
            Customer dashboard → Sites
          </Link>{" "}
          before you can place a booking.
        </div>
      )}

      <BookingWizardStepper currentStep={currentStep} />

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1.25rem" }}>
        {errors.sites_min && (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>
            {errors.sites_min}
          </p>
        )}

        {currentStep === "route" && (
          <RouteStep
            sites={sites}
            hasEnoughSites={hasEnoughSites}
            pickupId={pickupId}
            dropoffId={dropoffId}
            pickup={pickup}
            dropoff={dropoff}
            errors={errors}
            cost={cost}
            loading={loading}
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
            onPickupIdChange={setPickupId}
            onDropoffIdChange={setDropoffId}
            onClearError={clearError}
            onManualDistanceKmChange={setManualDistanceKm}
            onManualTollEntryChange={setManualTollEntry}
            onManualTollExitChange={setManualTollExit}
            onManualVehicleClassChange={setManualVehicleClass}
          />
        )}

        {currentStep === "shipment" && (
          <ShipmentStep
            hasEnoughSites={hasEnoughSites}
            weight={weight}
            date={date}
            today={today}
            pickedSlot={pickedSlot}
            slotsLoading={slotsLoading}
            slotsFetchError={slotsFetchError}
            slotAvailability={slotAvailability}
            slotAvailableTrucks={slotAvailableTrucks}
            requiredTrucks={requiredTrucks}
            selectedAvailableTrucks={selectedAvailableTrucks}
            errors={errors}
            onWeightChange={setWeight}
            onDateChange={setDate}
            onPickedSlotChange={setPickedSlot}
            onClearErrors={clearErrors}
          />
        )}

        {currentStep === "documents" && (
          <DocumentsStep
            cargoDeclaration={cargoDeclaration}
            termsAgreement={termsAgreement}
            termsAccepted={termsAccepted}
            disabled={!hasEnoughSites}
            errors={errors}
            onCargoDeclarationChange={setCargoDeclaration}
            onTermsAgreementChange={setTermsAgreement}
            onTermsAcceptedChange={setTermsAccepted}
            onClearError={clearError}
          />
        )}

        {currentStep === "review" && (
          <ReviewStep
            pickup={pickup}
            dropoff={dropoff}
            weight={weight}
            date={date}
            pickedSlot={pickedSlot}
            cargoDeclaration={cargoDeclaration}
            termsAgreement={termsAgreement}
            termsAccepted={termsAccepted}
            cost={cost}
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
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            errors={errors}
          />
        )}

        {!isLastStep && (
          <div className="booking-wizard-nav">
            <button
              type="button"
              className="button button--secondary booking-wizard-nav__prev"
              onClick={handlePrev}
              disabled={isFirstStep}
            >
              Previous
            </button>
            <button
              type="button"
              className="button booking-wizard-nav__next"
              onClick={handleNext}
              disabled={!canGoNext}
            >
              Next
            </button>
          </div>
        )}

        {isLastStep && !isFirstStep && (
          <div className="booking-wizard-nav booking-wizard-nav--review">
            <button type="button" className="button button--secondary booking-wizard-nav__prev" onClick={handlePrev}>
              Previous
            </button>
          </div>
        )}

        {pickedSlot && selectedAvailableTrucks < requiredTrucks && currentStep === "review" && (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>
            Not enough trucks available for this schedule. Please choose another date/time.
          </p>
        )}

        {message && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "8px",
              background: messageType === "success" ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)",
              border: `1px solid ${messageType === "success" ? "#4CAF50" : "#F44336"}`,
              color: messageType === "success" ? "#4CAF50" : "#F44336",
              fontSize: "0.95rem",
            }}
          >
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
