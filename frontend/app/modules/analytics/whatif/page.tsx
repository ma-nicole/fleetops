"use client";

import { useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AnalyticsApi, type WhatIfResponse } from "@/lib/analyticsApi";

export default function WhatIfPage() {
  useRoleGuard(["manager", "admin", "dispatcher"]);

  const [base, setBase] = useState({
    distance_km: 120,
    cargo_weight_tons: 8,
    avg_speed_kmh: 50,
    road_condition: "highway" as "highway" | "urban" | "rough",
    fuel_price_per_liter: 65,
    labor_rate_per_hour: 100,
    toll_rate_per_km: 1.5,
  });
  const [delta, setDelta] = useState({
    fuel_price_delta_pct: 0,
    distance_delta_pct: 0,
    cargo_delta_pct: 0,
    road_condition_override: "" as "" | "highway" | "urban" | "rough",
  });
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await AnalyticsApi.whatIf({
        base,
        fuel_price_delta_pct: delta.fuel_price_delta_pct,
        distance_delta_pct: delta.distance_delta_pct,
        cargo_delta_pct: delta.cargo_delta_pct,
        road_condition_override: delta.road_condition_override || null,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <header>
          <h1 style={{ margin: 0 }}>What-If Cost Simulator</h1>
          <p style={{ marginTop: 6, color: "#6B7280" }}>
            Paper §3.2.8 (Fig 24): adjust fuel price, distance, cargo, or road conditions to see how the predicted trip cost shifts.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Base scenario</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {(
                [
                  ["distance_km", "Distance (km)"],
                  ["cargo_weight_tons", "Cargo weight (tons)"],
                  ["avg_speed_kmh", "Average speed (km/h)"],
                  ["fuel_price_per_liter", "Fuel price (₱/L)"],
                  ["labor_rate_per_hour", "Labor rate (₱/h)"],
                  ["toll_rate_per_km", "Toll rate (₱/km)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
                  <input
                    type="number"
                    value={base[key]}
                    onChange={(e) => setBase((b) => ({ ...b, [key]: Number(e.target.value) }))}
                    style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
                  />
                </label>
              ))}
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>Road condition</span>
                <select
                  value={base.road_condition}
                  onChange={(e) =>
                    setBase((b) => ({ ...b, road_condition: e.target.value as typeof base.road_condition }))
                  }
                  style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
                >
                  <option value="highway">Highway</option>
                  <option value="urban">Urban</option>
                  <option value="rough">Rough</option>
                </select>
              </label>
            </div>
          </div>

          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Adjustments</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {(
                [
                  ["fuel_price_delta_pct", "Fuel price Δ%", -50, 100],
                  ["distance_delta_pct", "Distance Δ%", -50, 100],
                  ["cargo_delta_pct", "Cargo Δ%", -50, 100],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 13, color: "#374151" }}>
                    {label} ({delta[key]}%)
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={delta[key]}
                    onChange={(e) => setDelta((d) => ({ ...d, [key]: Number(e.target.value) }))}
                  />
                </label>
              ))}
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>Override road condition</span>
                <select
                  value={delta.road_condition_override}
                  onChange={(e) =>
                    setDelta((d) => ({
                      ...d,
                      road_condition_override: e.target.value as typeof delta.road_condition_override,
                    }))
                  }
                  style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
                >
                  <option value="">— keep base —</option>
                  <option value="highway">Highway</option>
                  <option value="urban">Urban</option>
                  <option value="rough">Rough</option>
                </select>
              </label>
              <button
                onClick={run}
                disabled={loading}
                style={{
                  marginTop: 8,
                  padding: "10px 16px",
                  background: "#0EA5E9",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {loading ? "Simulating…" : "Run simulation"}
              </button>
              {error && <p style={{ color: "#B91C1C" }}>{error}</p>}
            </div>
          </div>
        </section>

        {result && (
          <section style={card}>
            <h2 style={{ marginTop: 0 }}>Comparison</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <ScenarioCard title="Base" data={result.base} />
              <ScenarioCard title="Simulated" data={result.simulated} />
              <div
                style={{
                  background: result.delta_total >= 0 ? "#FEF3C7" : "#D1FAE5",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <h3 style={{ margin: "0 0 8px" }}>Delta</h3>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
                  {result.delta_total >= 0 ? "+" : ""}
                  ₱{result.delta_total.toLocaleString()}
                </p>
                <p style={{ marginTop: 4 }}>
                  {result.delta_pct >= 0 ? "+" : ""}
                  {result.delta_pct}% vs baseline
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ScenarioCard({
  title,
  data,
}: {
  title: string;
  data: WhatIfResponse["base"];
}) {
  return (
    <div style={{ background: "#F9FAFB", borderRadius: 10, padding: 16 }}>
      <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
        ₱{data.total_cost.toLocaleString()}
      </p>
      <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", fontSize: 13, color: "#374151" }}>
        <li>Fuel: ₱{data.fuel_cost} ({data.fuel_liters}L)</li>
        <li>Toll: ₱{data.toll_cost}</li>
        <li>Labor: ₱{data.labor_cost}</li>
        <li>Maintenance risk: ₱{data.maintenance_risk_cost}</li>
      </ul>
    </div>
  );
}
