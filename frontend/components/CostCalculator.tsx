"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { formatPhp } from "@/lib/appLocale";
import { BOOKING_TIME_SLOTS } from "@/lib/bookingSlots";
import { routeUsesGeocodedPinsBoth, type BookingPricingBreakdown } from "@/lib/bookingRouteEstimate";
import { validateCustomerSiteAddress } from "@/lib/formValidation";
import { MIN_BOOKING_SITES, loadCustomerSites, subscribeSitesChanged, type CustomerSite } from "@/lib/customerSites";
import { customerBookingPaymentPath } from "@/lib/customerPaymentNavigation";
import { WorkflowApi } from "@/lib/workflowApi";
import BookingCargoWeightField, { isValidBookingWeightTons, bookingWeightValidationMessage } from "@/components/BookingCargoWeightField";
import BookingDocumentUploadFields, { validateBookingDocumentFile } from "@/components/BookingDocumentUploadFields";
import SubmitButton from "@/components/ui/SubmitButton";
import LoadingMessage from "@/components/ui/LoadingMessage";

type QuotedCostBreakdown = {
  cargo_gross_php: number;
  toll_fees_php: number;
  labor_freight_php: number;
  quoted_total_php: number;
};

type TruckLoadApiLine = {
  truck_index: number;
  weight_tons: number;
  distance_km: number;
  cargo_gross_php: number;
  diesel_liters: number;
  diesel_cost_php: number;
  driver_share_php: number;
  helper_share_php: number;
  toll_fees_php: number;
  additives_total_php: number;
  net_profit_php: number;
};

type LiveCostQuote = {
  distance_km: number;
  total_trucks: number;
  cargo_gross_php: number;
  diesel_cost_php: number;
  driver_share_php: number;
  helper_share_php: number;
  toll_fees_php: number;
  additives_total_php: number;
  net_profit_total_php: number;
  quoted_total: number;
  truck_loads: TruckLoadApiLine[];
};

type FormErrors = {
  [key: string]: string;
};

type RouteQuoteApiResponse = {
  distance_km: number;
  weight_tons: number;
  total_trucks: number;
  cargo_rate_php_per_ton: number;
  cargo_gross_php: number;
  diesel_liters: number;
  diesel_cost_php: number;
  driver_share_php: number;
  helper_share_php: number;
  toll_fees_php: number;
  additives_total_php: number;
  net_profit_total_php: number;
  quoted_total: number;
  diesel_price_per_liter: number;
  driver_freight_share_pct: number;
  helper_freight_share_pct: number;
  truck_loads: TruckLoadApiLine[];
  pickup_resolution: string;
  dropoff_resolution: string;
  pricing_tier: string;
  routing_method: string;
  toll_matrix_matched?: boolean;
  toll_estimate_message?: string | null;
  toll_entry_point?: string | null;
  toll_exit_point?: string | null;
  toll_effective_date?: string | null;
  estimated_toll_budget_per_truck?: number | null;
  estimated_toll_budget_total?: number | null;
  toll_plaza_options?: string[];
  suggested_toll_entry_point?: string | null;
  suggested_toll_exit_point?: string | null;
  distance_confirmed?: boolean;
  distance_warning?: string | null;
  quote_status?: string | null;
};

/** Line items mirrored from backend / browser fallback breakdown. */
type FreightLineDetail = {
  booking_weight_tons: number;
  total_trucks: number;
  cargo_rate_php_per_ton: number;
  diesel_liters: number;
  diesel_cost_php: number;
  driver_share_php: number;
  helper_share_php: number;
  toll_fees_php: number;
  additives_total_php: number;
  diesel_price_per_liter: number;
  driver_freight_share_pct: number;
  helper_freight_share_pct: number;
  truck_loads: TruckLoadApiLine[];
};

function freightLinesFromPayload(data: RouteQuoteApiResponse): FreightLineDetail {
  return {
    booking_weight_tons: data.weight_tons,
    total_trucks: data.total_trucks,
    cargo_rate_php_per_ton: data.cargo_rate_php_per_ton,
    diesel_liters: data.diesel_liters,
    diesel_cost_php: data.diesel_cost_php,
    driver_share_php: data.driver_share_php,
    helper_share_php: data.helper_share_php,
    toll_fees_php: data.toll_fees_php,
    additives_total_php: data.additives_total_php,
    diesel_price_per_liter: data.diesel_price_per_liter,
    driver_freight_share_pct: data.driver_freight_share_pct,
    helper_freight_share_pct: data.helper_freight_share_pct,
    truck_loads: data.truck_loads,
  };
}

function freightLinesFromBreakdown(b: BookingPricingBreakdown): FreightLineDetail {
  return {
    booking_weight_tons: b.weightTons,
    total_trucks: b.totalTrucks,
    cargo_rate_php_per_ton: b.cargoRatePhpPerTon,
    diesel_liters: b.dieselLiters,
    diesel_cost_php: b.dieselCostPhp,
    driver_share_php: b.driverSharePhp,
    helper_share_php: b.helperSharePhp,
    toll_fees_php: b.tollFeesPhp,
    additives_total_php: b.additivesTotalPhp,
    diesel_price_per_liter: b.dieselPricePerLiter,
    driver_freight_share_pct: b.driverFreightSharePct,
    helper_freight_share_pct: b.helperFreightSharePct,
    truck_loads: b.truckLoads.map((r) => ({
      truck_index: r.truckIndex,
      weight_tons: r.weightTons,
      distance_km: r.distanceKm,
      cargo_gross_php: r.cargoGrossPhp,
      diesel_liters: r.dieselLiters,
      diesel_cost_php: r.dieselCostPhp,
      driver_share_php: r.driverSharePhp,
      helper_share_php: r.helperSharePhp,
      toll_fees_php: r.tollFeesPhp,
      additives_total_php: r.additivesTotalPhp,
      net_profit_php: r.netProfitPhp,
    })),
  };
}

type QuoteGeoMeta = Pick<
  RouteQuoteApiResponse,
  "pickup_resolution" | "dropoff_resolution" | "pricing_tier" | "routing_method"
>;

const DEFAULT_SERVICE_TYPE = "fixed";

function geocodeProviderNote(geo: QuoteGeoMeta | null): string | null {
  if (!geo) return null;
  const google = geo.pickup_resolution === "google" || geo.dropoff_resolution === "google";
  const nom = geo.pickup_resolution === "nominatim" || geo.dropoff_resolution === "nominatim";
  if (google) return "Pins: Google Geocoding API.";
  if (nom) return "Pins: OpenStreetMap (Nominatim), best match for your full street address.";
  return null;
}

function routingDistanceNote(routing: string | undefined): string {
  if (routing === "google_directions") {
    return "Road distance from Google Directions API (driving), matched to the same map data Google Maps uses for routing. Minor differences vs the app UI can still happen (alternate routes, live traffic, or different start/end pins). Tolls not itemized in distance.";
  }
  if (routing === "osrm") {
    return "Road distance uses the public OSRM “driving” profile (car-oriented on OpenStreetMap). If you expected Google Maps–like km, the backend is not using Google Directions — set GOOGLE_MAPS_GEOCODING_API_KEY with Geocoding + Directions APIs enabled and restrictions that allow your FastAPI server (not HTTP-referrer-only). For truck-legal OSM routing, set OPENROUTESERVICE_API_KEY (HGV). Tolls and live traffic excluded.";
  }
  if (routing === "openrouteservice_hgv") {
    return "Road distance uses OpenRouteService heavy-goods (HGV) routing on OpenStreetMap—avoids many truck restrictions where map data supports it. One computed path vs odometer; tolls and live traffic excluded.";
  }
  if (routing === "openrouteservice_car") {
    return "Road distance uses OpenRouteService car routing on OpenStreetMap (USE_TRUCK_ROUTE_PROFILE=false on server).";
  }
  if (routing === "openrouteservice") {
    return "Road distance from OpenRouteService along OpenStreetMap. Same caveat: one computed path vs actual odometer. Tolls and live traffic excluded.";
  }
  if (routing === "same_location") {
    return "Pickup and dropoff map to the same point — distance is 0 km.";
  }
  if (routing === "haversine_road_factor") {
    return "Approximate straight-line × factor (legacy mode only).";
  }
  return "";
}

function siteMenuLabel(s: CustomerSite): string {
  if (s.label) return `${s.label} — ${s.address}`;
  return s.address;
}

export default function CostCalculator({
  onQuotedBreakdown,
}: {
  onQuotedBreakdown?: (breakdown: QuotedCostBreakdown) => void;
}) {
  const router = useRouter();
  const [pickupId, setPickupId] = useState("");
  const [dropoffId, setDropoffId] = useState("");
  const [sites, setSites] = useState<CustomerSite[]>([]);
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
  const [tollEstimateMeta, setTollEstimateMeta] = useState<{
    matched: boolean;
    message: string | null;
    entryPoint: string | null;
    exitPoint: string | null;
    effectiveDate: string | null;
    budgetPerTruck: number | null;
    budgetTotal: number | null;
    plazaOptions: string[];
    suggestedEntry: string | null;
    suggestedExit: string | null;
  } | null>(null);
  const [manualTollEntry, setManualTollEntry] = useState("");
  const [manualTollExit, setManualTollExit] = useState("");
  const [manualVehicleClass, setManualVehicleClass] = useState("Class 3");
  const [manualDistanceKm, setManualDistanceKm] = useState("");
  const [distanceConfirmed, setDistanceConfirmed] = useState(true);
  const [distanceWarning, setDistanceWarning] = useState<string | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<string | null>(null);
  const [freightLines, setFreightLines] = useState<FreightLineDetail | null>(null);
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

  const providerNote = useMemo(() => geocodeProviderNote(routeQuoteMeta), [routeQuoteMeta]);

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
          // Only explicit `false` from the API blocks a slot; missing/unknown → still clickable.
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
              distance_km_override: manualDistanceKm.trim()
                ? Number(manualDistanceKm)
                : undefined,
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
  }, [pickup, dropoff, weight, onQuotedBreakdown, hasEnoughSites, pickupId, dropoffId, manualTollEntry, manualTollExit, manualVehicleClass, manualDistanceKm]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (sites.length < MIN_BOOKING_SITES) {
      newErrors.sites_min = `You need at least ${MIN_BOOKING_SITES} saved site addresses on your account before you can book.`;
    }
    if (!pickupId) {
      newErrors.pickup_location = "Select a pickup address from your saved sites.";
    } else if (!pickup || pickup.length < 3) {
      newErrors.pickup_location = "Invalid pickup selection.";
    } else {
      const pu = validateCustomerSiteAddress(pickup);
      if (pu) newErrors.pickup_location = `${pu} Update this site under Customer dashboard → Sites.`;
    }
    if (!dropoffId) {
      newErrors.dropoff_location = "Select a dropoff address from your saved sites.";
    } else if (!dropoff || dropoff.length < 3) {
      newErrors.dropoff_location = "Invalid dropoff selection.";
    } else {
      const dr = validateCustomerSiteAddress(dropoff);
      if (dr) newErrors.dropoff_location = `${dr} Update this site under Customer dashboard → Sites.`;
    }
    if (pickupId && dropoffId && pickupId === dropoffId) {
      newErrors.dropoff_location = "Pickup and dropoff must be different sites.";
    }
    if (
      pickup.trim().length >= 3 &&
      dropoff.trim().length >= 3 &&
      pickup.trim().toLowerCase() === dropoff.trim().toLowerCase()
    ) {
      newErrors.dropoff_location = "Pickup and dropoff must be different.";
    }
    const wTons = parseFloat(weight);
    if (!isValidBookingWeightTons(wTons)) {
      newErrors.cargo_weight_tons = bookingWeightValidationMessage();
    }
    if (!date) {
      newErrors.scheduled_date = "Schedule date required";
    } else {
      const selectedDate = new Date(date);
      if (selectedDate < new Date(today)) {
        newErrors.scheduled_date = "Cannot book past dates";
      } else if (
        !slotsLoading &&
        BOOKING_TIME_SLOTS.length > 0 &&
        BOOKING_TIME_SLOTS.every((s) => slotAvailability[s] === false)
      ) {
        newErrors.scheduled_date = "This date has no open pickup windows for this load — all trucks are in use for the overlapping route times.";
      }
    }
    if (date && !slotsLoading) {
      if (!pickedSlot) {
        newErrors.scheduled_time_slot = "Choose a pickup time window.";
      } else if (slotAvailability[pickedSlot] === false) {
        newErrors.scheduled_time_slot = "That time is no longer available — choose another slot.";
      } else if ((slotAvailableTrucks[pickedSlot] ?? 0) < requiredTrucksFromApi) {
        newErrors.scheduled_time_slot = "Not enough trucks available for this schedule. Please choose another date/time.";
      }
    }
    const declErr = validateBookingDocumentFile(cargoDeclaration);
    if (declErr) newErrors.cargo_declaration = declErr;
    const termsFileErr = validateBookingDocumentFile(termsAgreement);
    if (termsFileErr) newErrors.terms_agreement = termsFileErr;
    if (!termsAccepted) {
      newErrors.terms_accepted = "You must accept the Terms & Agreement.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sites.length < MIN_BOOKING_SITES) return;
    if (!validateForm()) return;

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

  const bookingPricingHint = !hasEnoughSites
    ? `Save at least ${MIN_BOOKING_SITES} sites on your dashboard — booking is disabled until then.`
    : "Select pickup and dropoff — server geocoding runs when you save (needs backend online).";

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
  const requiredTrucks = Math.max(1, requiredTrucksFromApi || Math.ceil((parseFloat(weight) || 1) / 42));
  const selectedAvailableTrucks = pickedSlot ? (slotAvailableTrucks[pickedSlot] ?? 0) : 0;

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

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        {errors.sites_min && (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>
            {errors.sites_min}
          </p>
        )}
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
                setPickupId(e.target.value);
                if (errors.pickup_location) setErrors((er) => ({ ...er, pickup_location: "" }));
              }}
              style={errors.pickup_location ? { borderColor: "#F44336" } : {}}
            >
              <option value="">{hasEnoughSites ? "Select pickup address from your sites…" : "Add sites on your dashboard first…"}</option>
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
                setDropoffId(e.target.value);
                if (errors.dropoff_location) setErrors((er) => ({ ...er, dropoff_location: "" }));
              }}
              style={errors.dropoff_location ? { borderColor: "#F44336" } : {}}
            >
              <option value="">{hasEnoughSites ? "Select dropoff address from your sites…" : "Add sites on your dashboard first…"}</option>
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

        {loading && hasEnoughSites && (
          <LoadingMessage label="Calculating road distance & price…" size="sm" />
        )}

        {cost ? (
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
            {!distanceConfirmed && (
              <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", maxWidth: "16rem" }}>
                <span>Confirm estimated distance (km)</span>
                <input
                  type="number"
                  min={1}
                  step={0.1}
                  value={manualDistanceKm}
                  onChange={(e) => setManualDistanceKm(e.target.value)}
                  placeholder="e.g. 95"
                  style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
                />
              </label>
            )}
            {freightLines ? (
              <>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Admin sets only <strong>diesel ₱/L</strong> and <strong>toll per trip</strong> under Calculations. Cargo
                  rate (₱650/t), 4 km/L, and crew percentages are fixed in the app to match your formula.
                  Offline fallbacks: <code style={{ fontSize: "0.74rem" }}>NEXT_PUBLIC_DIESEL_PRICE_PHP_PER_LITER</code>,{" "}
                  <code style={{ fontSize: "0.74rem" }}>NEXT_PUBLIC_TOLL_FEES_PHP_PER_TRIP</code>.
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
                  </li>
                  <li>
                    Driver share ({freightLines.driver_freight_share_pct.toFixed(2)}% of each truck&apos;s gross) →{" "}
                    {formatPhp(freightLines.driver_share_php)}
                  </li>
                  <li>
                    Helper share ({freightLines.helper_freight_share_pct.toFixed(2)}% of each truck&apos;s gross) →{" "}
                    {formatPhp(freightLines.helper_share_php)}
                  </li>
                  <li>Toll (per truck per trip) → {formatPhp(freightLines.toll_fees_php)}</li>
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
                            <div style={{ fontSize: "0.85rem", color: "#6B7280", marginTop: "0.25rem" }}>
                              NLEX-SCTEX toll matrix fee (descriptive lookup, not live gate detection), included in quoted total.
                            </div>
                          </>
                        ) : (
                          <>
                            <strong>Toll estimate</strong>
                            <div style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
                              {tollEstimateMeta.message ||
                                "No toll plaza match found. Please select entry and exit toll manually."}
                            </div>
                          </>
                        )}
                      </div>
                      {!tollEstimateMeta.matched && tollEstimateMeta.plazaOptions.length > 0 && (
                        <div style={{ marginTop: "0.65rem", display: "grid", gap: "0.5rem" }}>
                          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
                            <span>Entry toll plaza (manual)</span>
                            <select
                              value={manualTollEntry}
                              onChange={(e) => setManualTollEntry(e.target.value)}
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
                              onChange={(e) => setManualTollExit(e.target.value)}
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
                          {(tollEstimateMeta.suggestedEntry || tollEstimateMeta.suggestedExit) && (
                            <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280" }}>
                              Suggested: {tollEstimateMeta.suggestedEntry || "?"} → {tollEstimateMeta.suggestedExit || "?"}
                            </p>
                          )}
                          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
                            <span>Vehicle class</span>
                            <input
                              value={manualVehicleClass}
                              onChange={(e) => setManualVehicleClass(e.target.value)}
                              style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
                            />
                          </label>
                        </div>
                      )}
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
        ) : (
          !loading && <div className="booking-placeholder">{bookingPricingHint}</div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
            gap: "1rem",
          }}
        >
          <BookingCargoWeightField
            weight={weight}
            onWeightChange={setWeight}
            disabled={!hasEnoughSites}
            error={errors.cargo_weight_tons}
          />

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
              <span> Schedule Date</span>
              <span className="field-help" title="Past dates are disabled. Pick the earliest realistic delivery date.">
                ?
              </span>
              {date && !errors.scheduled_date && <span className="field-valid">✓</span>}
            </label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setErrors((er) => ({
                  ...er,
                  scheduled_date: "",
                  scheduled_time_slot: "",
                }));
              }}
              min={today}
              disabled={!hasEnoughSites}
              style={errors.scheduled_date ? { borderColor: "#F44336" } : {}}
            />
            {errors.scheduled_date && (
              <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                {errors.scheduled_date}
              </p>
            )}
          </div>
        </div>

        {slotsFetchError && hasEnoughSites && date && (
          <p role="alert" style={{ margin: 0, color: "#b45309", fontSize: "0.85rem" }}>
            {slotsFetchError}
          </p>
        )}

        <div>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              marginBottom: "0.5rem",
            }}
          >
            <span>Pickup time window</span>
            <span className="field-help" title="Four daily windows. Availability depends on how many of our four trucks are still free when your haul would overlap earlier runs.">
              ?
            </span>
            {pickedSlot && !errors.scheduled_time_slot && <span className="field-valid">✓</span>}
          </span>
          {!date ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Choose a schedule date to see which pickup windows are still open.
            </p>
          ) : slotsLoading ? (
            <LoadingMessage label="Checking open slots…" size="sm" />
          ) : (
            <div className="booking-slot-strip" role="radiogroup" aria-label="Pickup time slots">
              {BOOKING_TIME_SLOTS.map((slot) => {
                const taken = slotAvailability[slot] === false;
                const selected = pickedSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!hasEnoughSites || taken}
                    onClick={() => {
                      setPickedSlot(slot);
                      if (errors.scheduled_time_slot) setErrors((er) => ({ ...er, scheduled_time_slot: "" }));
                    }}
                    className={`booking-slot-pill booking-slot-selectable${selected ? " booking-slot-pill--selected" : ""}${taken ? " booking-slot-pill--taken" : ""}`}
                  >
                    {slot}
                    {taken ? " (fleet full)" : ""}
                  </button>
                );
              })}
            </div>
          )}
          {errors.scheduled_time_slot && (
            <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.35rem 0 0 0" }}>{errors.scheduled_time_slot}</p>
          )}
          {date && !slotsLoading && (
            <div
              style={{
                marginTop: "0.55rem",
                padding: "0.65rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(0,0,0,0.02)",
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
              }}
            >
              <div>Required trucks: {requiredTrucks}</div>
              <div>Available trucks{pickedSlot ? ` (${pickedSlot})` : ""}: {selectedAvailableTrucks}</div>
              {pickedSlot && selectedAvailableTrucks < requiredTrucks ? (
                <div style={{ color: "#b91c1c", marginTop: "0.3rem", fontWeight: 600 }}>
                  Not enough trucks available for this time slot.
                </div>
              ) : null}
            </div>
          )}
        </div>

        {cost && (
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
        )}

        <BookingDocumentUploadFields
          cargoDeclaration={cargoDeclaration}
          termsAgreement={termsAgreement}
          termsAccepted={termsAccepted}
          onCargoDeclarationChange={(file) => {
            setCargoDeclaration(file);
            if (errors.cargo_declaration) setErrors((er) => ({ ...er, cargo_declaration: "" }));
          }}
          onTermsAgreementChange={(file) => {
            setTermsAgreement(file);
            if (errors.terms_agreement) setErrors((er) => ({ ...er, terms_agreement: "" }));
          }}
          onTermsAcceptedChange={(accepted) => {
            setTermsAccepted(accepted);
            if (errors.terms_accepted) setErrors((er) => ({ ...er, terms_accepted: "" }));
          }}
          disabled={!hasEnoughSites}
          errors={{
            cargo_declaration: errors.cargo_declaration,
            terms_agreement: errors.terms_agreement,
            terms_accepted: errors.terms_accepted,
          }}
        />

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
        {pickedSlot && selectedAvailableTrucks < requiredTrucks && (
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
