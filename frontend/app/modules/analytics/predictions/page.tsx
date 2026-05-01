"use client";

import { useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import {
  AnalyticsApi,
  type MaintenancePredictResponse,
  type TripCostPredictResponse,
} from "@/lib/analyticsApi";

export default function PredictionsPage() {
  useRoleGuard(["manager", "admin", "dispatcher", "customer"]);

  const [costInput, setCostInput] = useState({
    distance_km: 120,
    cargo_weight_tons: 8,
    avg_speed_kmh: 50,
    road_condition: "highway" as "highway" | "urban" | "rough",
    fuel_price_per_liter: 65,
    labor_rate_per_hour: 100,
    toll_rate_per_km: 1.5,
  });
  const [costResult, setCostResult] = useState<TripCostPredictResponse | null>(null);

  const [maint, setMaint] = useState({
    mileage_km: 60000,
    age_years: 4,
    engine_hours: 1200,
    has_recurring_issue: false,
  });
  const [maintResult, setMaintResult] = useState<MaintenancePredictResponse | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runCost = async () => {
    setBusy(true);
    setError(null);
    try {
      setCostResult(await AnalyticsApi.predictTripCost(costInput));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cost prediction failed");
    } finally {
      setBusy(false);
    }
  };

  const runMaintenance = async () => {
    setBusy(true);
    setError(null);
    try {
      setMaintResult(await AnalyticsApi.predictMaintenance(maint));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Maintenance prediction failed");
    } finally {
      setBusy(false);
    }
  };

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 20,
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <header>
          <h1 style={{ margin: 0 }}>Predictive Analytics</h1>
          <p style={{ marginTop: 6, color: "#6B7280" }}>
            Paper §3.2.8 — Trip cost (Table 7), monthly forecast, and maintenance risk (Table 8).
          </p>
        </header>
        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 10, borderRadius: 8 }}>{error}</div>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Trip cost predictor</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {(
                [
                  ["distance_km", "Distance (km)"],
                  ["cargo_weight_tons", "Cargo (tons)"],
                  ["avg_speed_kmh", "Avg speed (km/h)"],
                  ["fuel_price_per_liter", "Fuel price (₱/L)"],
                  ["labor_rate_per_hour", "Labor rate (₱/h)"],
                  ["toll_rate_per_km", "Toll rate (₱/km)"],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  value={costInput[key]}
                  onChange={(v) => setCostInput((p) => ({ ...p, [key]: v }))}
                />
              ))}
              <label>
                <span style={{ fontSize: 13 }}>Road condition</span>
                <select
                  value={costInput.road_condition}
                  onChange={(e) =>
                    setCostInput((p) => ({
                      ...p,
                      road_condition: e.target.value as typeof p.road_condition,
                    }))
                  }
                  style={{ display: "block", padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
                >
                  <option value="highway">Highway</option>
                  <option value="urban">Urban</option>
                  <option value="rough">Rough</option>
                </select>
              </label>
              <button
                onClick={runCost}
                disabled={busy}
                style={{
                  marginTop: 6,
                  padding: "8px 14px",
                  background: "#0EA5E9",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Predict cost
              </button>
            </div>
            {costResult && (
              <div style={{ marginTop: 16, background: "#F9FAFB", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  ₱{costResult.total_cost.toLocaleString()}
                </div>
                <div>Fuel ₱{costResult.fuel_cost} ({costResult.fuel_liters}L)</div>
                <div>Toll ₱{costResult.toll_cost}</div>
                <div>Labor ₱{costResult.labor_cost}</div>
                <div>Maintenance risk ₱{costResult.maintenance_risk_cost}</div>
                <details style={{ marginTop: 8 }}>
                  <summary>Why?</summary>
                  <ul>
                    {costResult.explanation.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>

          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Maintenance risk</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <Field
                label="Mileage (km)"
                value={maint.mileage_km}
                onChange={(v) => setMaint((p) => ({ ...p, mileage_km: v }))}
              />
              <Field
                label="Vehicle age (years)"
                value={maint.age_years}
                onChange={(v) => setMaint((p) => ({ ...p, age_years: v }))}
              />
              <Field
                label="Engine hours"
                value={maint.engine_hours}
                onChange={(v) => setMaint((p) => ({ ...p, engine_hours: v }))}
              />
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={maint.has_recurring_issue}
                  onChange={(e) =>
                    setMaint((p) => ({ ...p, has_recurring_issue: e.target.checked }))
                  }
                />
                Has recurring issue
              </label>
              <button
                onClick={runMaintenance}
                disabled={busy}
                style={{
                  marginTop: 6,
                  padding: "8px 14px",
                  background: "#7C3AED",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Predict maintenance
              </button>
            </div>
            {maintResult && (
              <div style={{ marginTop: 16, background: "#F9FAFB", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  Priority: {maintResult.priority_level.replace("_", " ").toUpperCase()}
                </div>
                <div>Risk score: {maintResult.risk_score}</div>
                <div>Estimated cost: ₱{maintResult.estimated_cost.toLocaleString()}</div>
                <div>Next service in: {maintResult.next_service_in_days} days</div>
                <details style={{ marginTop: 8 }}>
                  <summary>Why?</summary>
                  <ul>
                    {maintResult.explanation.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
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
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
      />
    </label>
  );
}
