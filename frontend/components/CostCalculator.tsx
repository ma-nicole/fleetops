"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

type CostEstimate = {
  estimated_fuel: number;
  estimated_toll: number;
  estimated_labor: number;
  estimated_total: number;
};

type BookingResponse = {
  id: number;
  estimated_cost: number;
  status: string;
};

type FormErrors = {
  [key: string]: string;
};

export default function CostCalculator({
  onEstimate,
}: {
  onEstimate?: (estimate: CostEstimate) => void;
}) {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [weight, setWeight] = useState("1");
  const [serviceType, setServiceType] = useState("fixed");
  const [cost, setCost] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("") 
  const [date, setDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const progress = [pickup, dropoff, weight, date].filter(Boolean).length;
  const suggestedSlots = date ? ["08:00", "11:30", "14:00", "17:30"] : ["Select a date to see nearby slots"];

  // Simulate cost calculation based on inputs
  useEffect(() => {
    const calculateCost = async () => {
      if (!pickup || !dropoff || !weight) return;

      setLoading(true);
      try {
        // Simulated distance calculation (in production, use real geo API)
        const pickupCode = pickup.toLowerCase().charCodeAt(0);
        const dropoffCode = dropoff.toLowerCase().charCodeAt(0);
        const distance = Math.abs(pickupCode - dropoffCode) * 10 + 50;

        // Call backend cost prediction API
        const estimate = await apiFetch<CostEstimate>("/analytics/cost-predict", {
          method: "POST",
          body: JSON.stringify({
            distance_km: distance,
            cargo_weight_tons: parseFloat(weight) || 1,
            fuel_price_per_liter: 1.1,
            labor_rate: 18,
            toll_rate: 0.25,
          }),
        });

        setCost(estimate);
        onEstimate?.(estimate);
      } catch (error) {
        console.error("Cost estimation failed:", error);
        setCost(null);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(calculateCost, 500);
    return () => clearTimeout(timer);
  }, [pickup, dropoff, weight, onEstimate]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!pickup || pickup.length < 3) {
      newErrors.pickup_location = "Pickup location required (3+ chars)";
    }
    if (!dropoff || dropoff.length < 3) {
      newErrors.dropoff_location = "Dropoff location required (3+ chars)";
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
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      const payload = {
        pickup_location: pickup,
        dropoff_location: dropoff,
        service_type: serviceType,
        scheduled_date: date,
        cargo_weight_tons: parseFloat(weight),
      };

      const data = await apiFetch<BookingResponse>("/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMessage(`✓ Booking #${data.id} created! Cost: $${data.estimated_cost.toFixed(2)}`);
      setMessageType("success");
      setPickup("");
      setDropoff("");
      setWeight("1");
      setDate("");
      setServiceType("fixed");
      setCost(null);
    } catch (error) {
      const err = error as Error;
      setMessage(`✗ Error: ${err.message}`);
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div className="booking-progress" aria-label="Form completion">
        <div>
          <strong>Booking progress</strong>
          <p>{progress}/4 fields completed</p>
        </div>
        <div className="booking-progress-bar" aria-hidden="true">
          <span style={{ width: `${(progress / 4) * 100}%` }} />
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        {/* Input Fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              <span>📍 Pickup Location</span>
              <span className="field-help" title="Where the shipment starts. Enter a city, warehouse, or dock.">?</span>
              {pickup.length >= 3 && !errors.pickup_location && <span className="field-valid">✓</span>}
            </label>
            <input
              className="input"
              placeholder="e.g., Manhattan"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              style={errors.pickup_location ? { borderColor: "#F44336" } : {}}
            />
            {errors.pickup_location && (
              <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                ⚠️ {errors.pickup_location}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              <span>🎯 Dropoff Location</span>
              <span className="field-help" title="Where the shipment should arrive.">?</span>
              {dropoff.length >= 3 && !errors.dropoff_location && <span className="field-valid">✓</span>}
            </label>
            <input
              className="input"
              placeholder="e.g., Newark"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              style={errors.dropoff_location ? { borderColor: "#F44336" } : {}}
            />
            {errors.dropoff_location && (
              <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                ⚠️ {errors.dropoff_location}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              <span>⚖️ Weight (tons)</span>
              <span className="field-help" title="Estimated cargo weight. Used for pricing and truck allocation.">?</span>
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
              style={errors.cargo_weight_tons ? { borderColor: "#F44336" } : {}}
            />
            {errors.cargo_weight_tons && (
              <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                ⚠️ {errors.cargo_weight_tons}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              <span>📦 Service Type</span>
              <span className="field-help" title="Choose a fixed rate or a custom quote if the shipment needs special handling.">?</span>
            </label>
            <select
              className="select"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            >
              <option value="fixed">Fixed Rate</option>
              <option value="customized">Custom Quote</option>
            </select>
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              <span>📅 Schedule Date</span>
              <span className="field-help" title="Past dates are disabled. Pick the earliest realistic delivery date.">?</span>
              {date && !errors.scheduled_date && <span className="field-valid">✓</span>}
            </label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={today}
              style={errors.scheduled_date ? { borderColor: "#F44336" } : {}}
            />
            {errors.scheduled_date && (
              <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
                ⚠️ {errors.scheduled_date}
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

        {/* Cost Summary Card */}
        {cost ? (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(82, 183, 136, 0.1), rgba(82, 183, 136, 0.05))",
              border: "1px solid rgba(82, 183, 136, 0.3)",
              borderRadius: "12px",
              padding: "1rem",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1rem",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Fuel</p>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
                ${cost.estimated_fuel.toFixed(2)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Toll</p>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
                ${cost.estimated_toll.toFixed(2)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Labor</p>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.2rem", fontWeight: 600, color: "#4CAF50" }}>
                ${cost.estimated_labor.toFixed(2)}
              </p>
            </div>
            <div style={{ borderLeft: "2px solid rgba(76, 175, 80, 0.3)", paddingLeft: "1rem" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total</p>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.4rem", fontWeight: 800, color: "#4CAF50" }}>
                ${cost.estimated_total.toFixed(2)}
              </p>
            </div>
          </div>
        ) : (
          <div className="booking-placeholder">Enter shipment details to see a live estimate.</div>
        )}

        {loading && (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            ⏳ Calculating cost...
          </div>
        )}

        {/* Submit Button */}
        <button
          className="button"
          type="submit"
          disabled={isSubmitting || !cost}
          style={{
            opacity: isSubmitting || !cost ? 0.5 : 1,
            cursor: isSubmitting || !cost ? "not-allowed" : "pointer",
            padding: "1rem",
            fontSize: "1rem",
          }}
        >
          {isSubmitting ? "🔄 Processing..." : "✓ Confirm & Book"}
        </button>

        {/* Message */}
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
