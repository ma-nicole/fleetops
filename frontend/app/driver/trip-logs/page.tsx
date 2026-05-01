"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Trip } from "@/lib/workflowApi";

export default function TripLogsPage() {
  useRoleGuard(["driver"]);
  const searchParams = useSearchParams();

  const initialTrip = Number(searchParams.get("trip") || 0);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<number>(initialTrip);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [fuel, setFuel] = useState({ liters: 50, cost: 3000, odometer_km: 0 });
  const [toll, setToll] = useState({ location: "NLEX Toll", amount: 200 });

  useEffect(() => {
    WorkflowApi.myTrips()
      .then((t) => {
        setTrips(t);
        if (!tripId && t.length) setTripId(t[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trips"));
  }, []);

  const trip = useMemo(() => trips.find((t) => t.id === tripId), [trips, tripId]);

  const submitFuel = async () => {
    if (!tripId) return;
    setError(null);
    try {
      await WorkflowApi.addFuelLog(tripId, fuel);
      setOkMsg(`Fuel log added for trip #${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fuel log failed");
    }
  };

  const submitToll = async () => {
    if (!tripId) return;
    setError(null);
    try {
      await WorkflowApi.addTollLog(tripId, toll);
      setOkMsg(`Toll log added for trip #${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toll log failed");
    }
  };

  const generateReport = async () => {
    if (!tripId) return;
    setError(null);
    try {
      await WorkflowApi.generateReport(tripId);
      setOkMsg("Completion report submitted to dispatcher");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate report");
    }
  };

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 18,
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Trip Logs</h1>
          <p style={{ color: "#6B7280", marginTop: 4 }}>
            Paper Driver DFD (Fig 13) — capture fuel & toll receipts and trigger the completion report.
          </p>
        </header>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div>
        )}
        {okMsg && (
          <div style={{ background: "#D1FAE5", color: "#047857", padding: 12, borderRadius: 8 }}>{okMsg}</div>
        )}

        <section style={card}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Trip</span>
            <select
              value={tripId}
              onChange={(e) => setTripId(Number(e.target.value))}
              style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
            >
              <option value={0}>— pick a trip —</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} · {t.status} · booking {t.booking_id}
                </option>
              ))}
            </select>
          </label>
          {trip && (
            <p style={{ marginTop: 8, color: "#6B7280" }}>
              Distance {trip.distance_km}km · Fuel ₱{trip.fuel_cost} · Toll ₱{trip.toll_cost}
            </p>
          )}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}> Fuel log</h3>
            <Field
              label="Liters"
              value={fuel.liters}
              onChange={(v) => setFuel((p) => ({ ...p, liters: v }))}
            />
            <Field
              label="Cost (₱)"
              value={fuel.cost}
              onChange={(v) => setFuel((p) => ({ ...p, cost: v }))}
            />
            <Field
              label="Odometer (km)"
              value={fuel.odometer_km}
              onChange={(v) => setFuel((p) => ({ ...p, odometer_km: v }))}
            />
            <button onClick={submitFuel} style={btn("#0EA5E9")}>Save fuel log</button>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}> Toll log</h3>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Location</span>
              <input
                value={toll.location}
                onChange={(e) => setToll((p) => ({ ...p, location: e.target.value }))}
                style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
              />
            </label>
            <Field
              label="Amount (₱)"
              value={toll.amount}
              onChange={(v) => setToll((p) => ({ ...p, amount: v }))}
            />
            <button onClick={submitToll} style={btn("#7C3AED")}>Save toll log</button>
          </div>
        </section>

        <section style={card}>
          <h3 style={{ marginTop: 0 }}> Completion report</h3>
          <p style={{ color: "#6B7280", marginTop: 0 }}>
            Submits the consolidated report to the dispatcher and triggers the predicted-vs-actual feedback loop.
          </p>
          <button onClick={generateReport} style={btn("#10B981")}>
            Generate completion report
          </button>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 4, marginBottom: 8 }}>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
      />
    </label>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    padding: "10px 14px",
    background: color,
    color: "white",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 6,
  };
}
