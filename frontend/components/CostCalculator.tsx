"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatPhp } from "@/lib/appLocale";
import { BOOKING_TIME_SLOTS } from "@/lib/bookingSlots";
import { estimateBookingCost, estimateUsesGeocodedBoth, type BookingEstimateBreakdown } from "@/lib/bookingRouteEstimate";
import { validateCustomerSiteAddress } from "@/lib/formValidation";
import { MIN_BOOKING_SITES, loadCustomerSites, subscribeSitesChanged, type CustomerSite } from "@/lib/customerSites";
import { WorkflowApi } from "@/lib/workflowApi";

type CostEstimate = {
  estimated_fuel: number;
  estimated_toll: number;
  estimated_labor: number;
  estimated_total: number;
};

type LiveCostEstimate = CostEstimate & { distance_km: number };

type BookingResponse = {
  id: number;
  estimated_cost: number;
  status: string;
};

type FormErrors = {
  [key: string]: string;
};

type RouteEstimateApiResponse = {
  distance_km: number;
  diesel_liters: number;
  diesel_cost_php: number;
  wear_misc_php: number;
  depreciation_php: number;
  helper_pay_php: number;
  freight_base_php: number;
  fuel_route_charge: number;
  driver_fee: number;
  estimated_total: number;
  diesel_price_per_liter: number;
  driver_commission_pct: number;
  pickup_resolution: string;
  dropoff_resolution: string;
  estimate_tier: string;
};

/** Line items mirrored from backend / browser fallback breakdown. */
type FreightLineDetail = {
  diesel_liters: number;
  diesel_cost_php: number;
  wear_misc_php: number;
  depreciation_php: number;
  helper_pay_php: number;
  freight_base_php: number;
  diesel_price_per_liter: number;
  driver_commission_pct: number;
};

function freightLinesFromPayload(data: RouteEstimateApiResponse): FreightLineDetail {
  return {
    diesel_liters: data.diesel_liters,
    diesel_cost_php: data.diesel_cost_php,
    wear_misc_php: data.wear_misc_php,
    depreciation_php: data.depreciation_php,
    helper_pay_php: data.helper_pay_php,
    freight_base_php: data.freight_base_php,
    diesel_price_per_liter: data.diesel_price_per_liter,
    driver_commission_pct: data.driver_commission_pct,
  };
}

function freightLinesFromBreakdown(b: BookingEstimateBreakdown): FreightLineDetail {
  return {
    diesel_liters: b.dieselLiters,
    diesel_cost_php: b.dieselCostPhp,
    wear_misc_php: b.wearMiscPhp,
    depreciation_php: b.depreciationPhp,
    helper_pay_php: b.helperPayPhp,
    freight_base_php: b.freightBasePhp,
    diesel_price_per_liter: b.dieselPricePerLiter,
    driver_commission_pct: b.driverCommissionPct,
  };
}

type EstimateGeoMeta = Pick<
  RouteEstimateApiResponse,
  "pickup_resolution" | "dropoff_resolution" | "estimate_tier"
>;

const DEFAULT_SERVICE_TYPE = "fixed";

function geocodeProviderNote(geo: EstimateGeoMeta | null): string | null {
  if (!geo) return null;
  const google = geo.pickup_resolution === "google" || geo.dropoff_resolution === "google";
  const nom = geo.pickup_resolution === "nominatim" || geo.dropoff_resolution === "nominatim";
  if (google) return "Pins: Google Geocoding API.";
  if (nom) return "Pins: OpenStreetMap (Nominatim).";
  return null;
}

function siteMenuLabel(s: CustomerSite): string {
  if (s.label) return `${s.label} — ${s.address}`;
  return s.address;
}

export default function CostCalculator({
  onEstimate,
}: {
  onEstimate?: (estimate: CostEstimate) => void;
}) {
  const [pickupId, setPickupId] = useState("");
  const [dropoffId, setDropoffId] = useState("");
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [weight, setWeight] = useState("1");
  const [cost, setCost] = useState<LiveCostEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [date, setDate] = useState("");
  const [pickedSlot, setPickedSlot] = useState<string>("");
  const [slotAvailability, setSlotAvailability] = useState<Record<string, boolean>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsFetchError, setSlotsFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimateGeo, setEstimateGeo] = useState<EstimateGeoMeta | null>(null);
  const [freightLines, setFreightLines] = useState<FreightLineDetail | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const hasEnoughSites = sites.length >= MIN_BOOKING_SITES;

  const pickup = useMemo(() => sites.find((s) => s.id === pickupId)?.address ?? "", [sites, pickupId]);
  const dropoff = useMemo(() => sites.find((s) => s.id === dropoffId)?.address ?? "", [sites, dropoffId]);

  const showApproximateEstimateWarning = useMemo(() => {
    if (estimateGeo) {
      const { pickup_resolution: pr, dropoff_resolution: dr, estimate_tier: t } = estimateGeo;
      if (pr === "none" || dr === "none") return true;
      if (t !== "geocoded") return true;
      return false;
    }
    return !estimateUsesGeocodedBoth(pickup, dropoff);
  }, [estimateGeo, pickup, dropoff]);

  const providerNote = useMemo(() => geocodeProviderNote(estimateGeo), [estimateGeo]);

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
      setPickedSlot("");
      setSlotsFetchError(null);
      setSlotsLoading(false);
      return;
    }
    if (!date) {
      setSlotAvailability({});
      setPickedSlot("");
      setSlotsFetchError(null);
      setSlotsLoading(false);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsFetchError(null);
    setPickedSlot("");

    void WorkflowApi.bookingPickupSlotAvailability(date)
      .then((res) => {
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        for (const s of BOOKING_TIME_SLOTS) {
          // Only explicit `false` from the API blocks a slot; missing/unknown → still clickable.
          next[s] = res.slots?.[s] !== false;
        }
        setSlotAvailability(next);
      })
      .catch((e) => {
        if (!cancelled) {
          const next: Record<string, boolean> = {};
          for (const s of BOOKING_TIME_SLOTS) next[s] = true;
          setSlotAvailability(next);
          setSlotsFetchError(e instanceof Error ? e.message : "Could not load pickup windows.");
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, hasEnoughSites]);

  useEffect(() => {
    if (!hasEnoughSites) {
      setCost(null);
      setEstimateGeo(null);
      setFreightLines(null);
      setLoading(false);
      return;
    }

    const p = pickup.trim();
    const d = dropoff.trim();
    const w = parseFloat(weight);

    if (!pickupId || !dropoffId || pickupId === dropoffId || p.length < 3 || d.length < 3 || p.toLowerCase() === d.toLowerCase()) {
      setCost(null);
      setEstimateGeo(null);
      setFreightLines(null);
      setLoading(false);
      return;
    }

    const effW = Number.isFinite(w) && w > 0 ? Math.min(50, w) : 1;

    let cancelled = false;
    const ac = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await apiFetch<RouteEstimateApiResponse>("/customer/route-estimate", {
            method: "POST",
            body: JSON.stringify({
              pickup_location: pickup,
              dropoff_location: dropoff,
              weight_tons: effW,
            }),
            signal: ac.signal,
          });
          if (cancelled) return;
          const live: LiveCostEstimate = {
            distance_km: data.distance_km,
            estimated_fuel: data.fuel_route_charge,
            estimated_toll: 0,
            estimated_labor: data.driver_fee,
            estimated_total: data.estimated_total,
          };
          setCost(live);
          setEstimateGeo({
            pickup_resolution: data.pickup_resolution,
            dropoff_resolution: data.dropoff_resolution,
            estimate_tier: data.estimate_tier,
          });
          setFreightLines(freightLinesFromPayload(data));
          onEstimate?.({
            estimated_fuel: live.estimated_fuel,
            estimated_toll: live.estimated_toll,
            estimated_labor: live.estimated_labor,
            estimated_total: live.estimated_total,
          });
        } catch (e: unknown) {
          if (cancelled) return;
          if (e instanceof DOMException && e.name === "AbortError") return;
          const breakdown = estimateBookingCost(pickup, dropoff, effW);
          if (breakdown) {
            const live: LiveCostEstimate = {
              distance_km: breakdown.distanceKm,
              estimated_fuel: breakdown.fuelRouteCharge,
              estimated_toll: 0,
              estimated_labor: breakdown.driverFee,
              estimated_total: breakdown.total,
            };
            setCost(live);
            setEstimateGeo(null);
            setFreightLines(freightLinesFromBreakdown(breakdown));
            onEstimate?.({
              estimated_fuel: live.estimated_fuel,
              estimated_toll: live.estimated_toll,
              estimated_labor: live.estimated_labor,
              estimated_total: live.estimated_total,
            });
          } else {
            setCost(null);
            setEstimateGeo(null);
            setFreightLines(null);
          }
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
  }, [pickup, dropoff, weight, onEstimate, hasEnoughSites, pickupId, dropoffId]);

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
    if (parseFloat(weight) <= 0 || parseFloat(weight) > 50) {
      newErrors.cargo_weight_tons = "Weight must be 0.1–50 tons";
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
        newErrors.scheduled_date = "This date has no open pickup windows — all four slots are already booked.";
      }
    }
    if (date && !slotsLoading) {
      if (!pickedSlot) {
        newErrors.scheduled_time_slot = "Choose a pickup time window.";
      } else if (slotAvailability[pickedSlot] === false) {
        newErrors.scheduled_time_slot = "That time is no longer available — choose another slot.";
      }
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
      const payload = {
        pickup_location: pickup,
        dropoff_location: dropoff,
        service_type: DEFAULT_SERVICE_TYPE,
        scheduled_date: date,
        scheduled_time_slot: pickedSlot,
        cargo_weight_tons: parseFloat(weight),
      };

      const data = await apiFetch<BookingResponse>("/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMessage(`✓ Booking #${data.id} created! Cost: ${formatPhp(data.estimated_cost)}`);
      setMessageType("success");
      setPickupId("");
      setDropoffId("");
      setWeight("1");
      setDate("");
      setPickedSlot("");
      setCost(null);
      setEstimateGeo(null);
      setFreightLines(null);
    } catch (error) {
      const err = error as Error;
      setMessage(` Error: ${err.message}`);
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimateHint = !hasEnoughSites
    ? `Save at least ${MIN_BOOKING_SITES} sites on your dashboard — booking is disabled until then.`
    : "Select pickup and dropoff — server geocoding runs when you save (needs backend online).";

  const canSubmit =
    hasEnoughSites &&
    !!cost &&
    !isSubmitting &&
    !!pickedSlot &&
    slotAvailability[pickedSlot] !== false &&
    !slotsLoading;

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
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Calculating estimate…
          </div>
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
              Estimated road distance: <strong style={{ color: "var(--text-primary)" }}>{cost.distance_km} km</strong>{" "}
              (geocoded straight-line × road factor; fuel uses DOE-style diesel ₱/L from server config)
            </p>
            {providerNote ? (
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", opacity: 0.92 }}>
                {providerNote}{" "}
                <span title="Driving distance/tolls may differ.">Not door-to-door driving km.</span>
              </p>
            ) : !estimateGeo ? (
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#b45309" }}>
                Browser-only estimate — start the FleetOpt API to use Google/OSM geocoding on the server.
              </p>
            ) : null}
            {freightLines ? (
              <>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Update retail diesel <strong>₱{freightLines.diesel_price_per_liter.toFixed(2)}/L</strong> weekly (after DOE bulletin,
                  usually Tuesdays) in <code style={{ fontSize: "0.74rem" }}>backend/.env</code> —
                  <span style={{ marginLeft: "0.25rem" }}>optional public fallbacks: </span>
                  <code style={{ fontSize: "0.74rem" }}>NEXT_PUBLIC_DIESEL_PRICE_PHP_PER_LITER</code>.
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
                  <li>Diesel {freightLines.diesel_liters.toFixed(2)} L → {formatPhp(freightLines.diesel_cost_php)}</li>
                  <li>Wear / misc (per km) → {formatPhp(freightLines.wear_misc_php)}</li>
                  <li>Depreciation surcharge (10% of diesel + wear stack) → {formatPhp(freightLines.depreciation_php)}</li>
                  <li>Helper allowance → {formatPhp(freightLines.helper_pay_php)}</li>
                </ul>
              </>
            ) : null}
            {showApproximateEstimateWarning && (
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
                Rough distance / pins — improve site addresses for tighter geocoding (this does not replace DOE diesel
                postings; update fuel price in .env when advisories move).
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
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Freight base</p>
                <p style={{ margin: "0.08rem 0 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  diesel + wear + depreciation + helper
                </p>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
                  {formatPhp(cost.estimated_fuel)}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Driver ({freightLines ? `${freightLines.driver_commission_pct}%` : "15%"} of freight base)
                </p>
                <p style={{ margin: "0.08rem 0 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  commission on gross freight row
                </p>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
                  {formatPhp(cost.estimated_labor)}
                </p>
              </div>
              <div style={{ borderLeft: "2px solid rgba(76, 175, 80, 0.3)", paddingLeft: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total estimate</p>
                <p style={{ margin: "0.08rem 0 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  freight base + driver commission
                </p>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.4rem", fontWeight: 800, color: "#4CAF50" }}>
                  {formatPhp(cost.estimated_total)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          !loading && <div className="booking-placeholder">{estimateHint}</div>
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
              <span>Weight (tons)</span>
              <span className="field-help" title="Estimated cargo weight. Used for pricing and truck allocation.">
                ?
              </span>
              {parseFloat(weight) > 0 && !errors.cargo_weight_tons && <span className="field-valid">✓</span>}
            </label>
            <input
              className="input"
              type="number"
              min="0.1"
              step="0.1"
              max="50"
              placeholder="1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              disabled={!hasEnoughSites}
              style={errors.cargo_weight_tons ? { borderColor: "#F44336" } : {}}
            />
            {errors.cargo_weight_tons && (
              <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                {errors.cargo_weight_tons}
              </p>
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
            <span className="field-help" title="Four shared slots per day. Another customer’s active booking blocks a slot.">
              ?
            </span>
            {pickedSlot && !errors.scheduled_time_slot && <span className="field-valid">✓</span>}
          </span>
          {!date ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Choose a schedule date to see which pickup windows are still open.
            </p>
          ) : slotsLoading ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Checking open slots…</p>
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
                    {taken ? " (full)" : ""}
                  </button>
                );
              })}
            </div>
          )}
          {errors.scheduled_time_slot && (
            <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.35rem 0 0 0" }}>{errors.scheduled_time_slot}</p>
          )}
        </div>

        <button
          className="button"
          type="submit"
          disabled={!canSubmit}
          style={{
            opacity: !canSubmit ? 0.5 : 1,
            cursor: !canSubmit ? "not-allowed" : "pointer",
            padding: "1rem",
            fontSize: "1rem",
          }}
        >
          {isSubmitting ? " Processing..." : "✓ Confirm & Book"}
        </button>

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
