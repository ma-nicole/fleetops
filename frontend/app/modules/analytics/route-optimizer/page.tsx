"use client";

import { useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AnalyticsApi, type RouteOptimizeResponse } from "@/lib/analyticsApi";

const SAMPLE_NODES = [
  "Warehouse-Tarlac",
  "Hub-Pampanga",
  "SMC-Plant-Bulacan",
  "Hub-Manila-North",
  "Hub-Cabanatuan",
  "Hub-Baguio",
  "Customer-Pasig",
  "Customer-QC",
  "Customer-Makati",
  "Customer-Manila",
  "Customer-Caloocan",
];

export default function RouteOptimizerPage() {
  useRoleGuard(["manager", "admin", "dispatcher"]);

  const [origin, setOrigin] = useState(SAMPLE_NODES[0]);
  const [destination, setDestination] = useState(SAMPLE_NODES[7]);
  const [weight, setWeight] = useState<"cost" | "distance" | "time">("cost");
  const [cargo, setCargo] = useState(10);
  const [departureHour, setDepartureHour] = useState(8);
  const [result, setResult] = useState<RouteOptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await AnalyticsApi.optimizeRoute({
        origin,
        destination,
        weight,
        cargo_weight_tons: cargo,
        departure_hour: departureHour,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setLoading(false);
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
          <h1 style={{ margin: 0 }}>Route Optimization (A*)</h1>
          <p style={{ marginTop: 6, color: "#6B7280" }}>
            Paper §3.2.9 / Fig 26 — A* search with edge cost g(n) = Fuel + Toll + Time + Maintenance penalties, plus active truck-ban constraints.
          </p>
        </header>

        <section style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <Field label="Origin">
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6, width: "100%" }}
              >
                {SAMPLE_NODES.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Destination">
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6, width: "100%" }}
              >
                {SAMPLE_NODES.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Optimize for">
              <select
                value={weight}
                onChange={(e) => setWeight(e.target.value as "cost" | "distance" | "time")}
                style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6, width: "100%" }}
              >
                <option value="cost">Lowest cost</option>
                <option value="distance">Shortest distance</option>
                <option value="time">Fastest time</option>
              </select>
            </Field>
            <Field label="Cargo (tons)">
              <input
                type="number"
                value={cargo}
                onChange={(e) => setCargo(Number(e.target.value))}
                style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6, width: "100%" }}
              />
            </Field>
            <Field label="Departure hour (24h)">
              <input
                type="number"
                min={0}
                max={23}
                value={departureHour}
                onChange={(e) => setDepartureHour(Number(e.target.value))}
                style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6, width: "100%" }}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                onClick={run}
                disabled={loading}
                style={{
                  padding: "10px 16px",
                  background: "#10B981",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  width: "100%",
                }}
              >
                {loading ? "Searching…" : "Find optimal route"}
              </button>
            </div>
          </div>
          {error && <p style={{ color: "#B91C1C", marginTop: 12 }}>{error}</p>}
        </section>

        {result && (
          <>
            {result.constraints_applied?.length > 0 && (
              <section style={{ ...card, background: "#FFFBEB" }}>
                <h3 style={{ margin: "0 0 8px" }}>Constraints applied</h3>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {result.constraints_applied.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </section>
            )}

            <section style={{ display: "grid", gap: 12 }}>
              {result.candidates.map((candidate) => (
                <div
                  key={candidate.rank}
                  style={{
                    ...card,
                    borderLeft: `4px solid ${
                      candidate.rank === result.selected_rank ? "#10B981" : "#9CA3AF"
                    }`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0 }}>
                      Candidate #{candidate.rank}
                      {candidate.rank === result.selected_rank && (
                        <span
                          style={{
                            marginLeft: 8,
                            background: "#D1FAE5",
                            color: "#047857",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        >
                          SELECTED
                        </span>
                      )}
                    </h3>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                      ₱{candidate.total_cost.toLocaleString()}
                    </p>
                  </div>
                  <p style={{ marginTop: 8, color: "#374151" }}>
                    {candidate.path.join(" → ")}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 12 }}>
                    <Stat label="Distance" value={`${candidate.distance_km} km`} />
                    <Stat label="Fuel" value={`₱${candidate.fuel_cost}`} />
                    <Stat label="Toll" value={`₱${candidate.toll_cost}`} />
                    <Stat label="Time penalty" value={`₱${candidate.time_penalty}`} />
                    <Stat label="Maintenance" value={`₱${candidate.maintenance_penalty}`} />
                  </div>
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: "pointer", color: "#0EA5E9" }}>Edge breakdown</summary>
                    <table style={{ width: "100%", marginTop: 8, fontSize: 13, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                          <th style={tdStyle}>From</th>
                          <th style={tdStyle}>To</th>
                          <th style={tdStyle}>km</th>
                          <th style={tdStyle}>Fuel</th>
                          <th style={tdStyle}>Toll</th>
                          <th style={tdStyle}>Time</th>
                          <th style={tdStyle}>Maintenance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidate.edges.map((e, i) => (
                          <tr key={i}>
                            <td style={tdStyle}>{e.from_node}</td>
                            <td style={tdStyle}>{e.to_node}</td>
                            <td style={tdStyle}>{e.distance_km}</td>
                            <td style={tdStyle}>₱{e.fuel_cost}</td>
                            <td style={tdStyle}>₱{e.toll_cost}</td>
                            <td style={tdStyle}>₱{e.time_penalty}</td>
                            <td style={tdStyle}>₱{e.maintenance_penalty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const tdStyle: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #E5E7EB", textAlign: "left" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#F9FAFB", borderRadius: 8, padding: 8 }}>
      <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}
