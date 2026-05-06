"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatPhp } from "@/lib/appLocale";
import { estimateBookingCost } from "@/lib/bookingRouteEstimate";
import { MIN_BOOKING_SITES, getCustomerSites, subscribeSitesChanged, type CustomerSite } from "@/lib/customerSites";

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

const DEFAULT_SERVICE_TYPE = "fixed";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const suggestedSlots = date ? ["08:00", "11:30", "14:00", "17:30"] : ["Select a date to see nearby slots"];

  const hasEnoughSites = sites.length >= MIN_BOOKING_SITES;

  const pickup = useMemo(() => sites.find((s) => s.id === pickupId)?.address ?? "", [sites, pickupId]);
  const dropoff = useMemo(() => sites.find((s) => s.id === dropoffId)?.address ?? "", [sites, dropoffId]);

  useEffect(() => {
    setSites(getCustomerSites());
    return subscribeSitesChanged(() => setSites(getCustomerSites()));
  }, []);

  useEffect(() => {
    const ids = new Set(sites.map((s) => s.id));
    setPickupId((id) => (id && ids.has(id) ? id : ""));
    setDropoffId((id) => (id && ids.has(id) ? id : ""));
  }, [sites]);

  useEffect(() => {
    if (!hasEnoughSites) {
      setCost(null);
      setLoading(false);
      return;
    }

    const p = pickup.trim();
    const d = dropoff.trim();
    const w = parseFloat(weight);

    if (!pickupId || !dropoffId || pickupId === dropoffId || p.length < 3 || d.length < 3 || p.toLowerCase() === d.toLowerCase()) {
      setCost(null);
      setLoading(false);
      return;
    }

    const effW = Number.isFinite(w) && w > 0 ? Math.min(50, w) : 1;

    setLoading(true);
    const timer = window.setTimeout(() => {
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
        onEstimate?.({
          estimated_fuel: live.estimated_fuel,
          estimated_toll: live.estimated_toll,
          estimated_labor: live.estimated_labor,
          estimated_total: live.estimated_total,
        });
      } else {
        setCost(null);
      }
      setLoading(false);
    }, 300);

    return () => {
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
    }
    if (!dropoffId) {
      newErrors.dropoff_location = "Select a dropoff address from your saved sites.";
    } else if (!dropoff || dropoff.length < 3) {
      newErrors.dropoff_location = "Invalid dropoff selection.";
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
    }
    const selectedDate = new Date(date);
    if (selectedDate < new Date(today)) {
      newErrors.scheduled_date = "Cannot book past dates";
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
      setCost(null);
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
    : "Choose pickup and dropoff from your saved sites to see a live estimate.";

  const canSubmit = hasEnoughSites && !!cost && !isSubmitting;

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
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
              <span> Weight (tons)</span>
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
              onChange={(e) => setDate(e.target.value)}
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

        <div className="booking-slot-strip" aria-label="Suggested booking slots">
          {suggestedSlots.map((slot) => (
            <span key={slot} className="booking-slot-pill">
              {slot}
            </span>
          ))}
        </div>

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
              (reference map + analytics model)
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Fuel & distance</p>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
                  {formatPhp(cost.estimated_fuel)}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Driver (10%)</p>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
                  {formatPhp(cost.estimated_labor)}
                </p>
              </div>
              <div style={{ borderLeft: "2px solid rgba(76, 175, 80, 0.3)", paddingLeft: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total estimate</p>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.4rem", fontWeight: 800, color: "#4CAF50" }}>
                  {formatPhp(cost.estimated_total)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="booking-placeholder">{estimateHint}</div>
        )}

        {loading && hasEnoughSites && (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            ⏳ Calculating cost...
          </div>
        )}

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
