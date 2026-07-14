"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TimeGranularityPicker, type TimeGranularity } from "@/components/admin/TimeGranularityPicker";
import {
  AnalyticsApi,
  type CostRegressionSummary,
  type MaintenancePredictResponse,
  type OperationalForecastResponse,
  type OperationalForecastSeries,
  type TripCostPredictResponse,
} from "@/lib/analyticsApi";
import { formatPhp, formatPhpWhole } from "@/lib/appLocale";
import { useRoleGuard } from "@/lib/useRoleGuard";

const card: CSSProperties = { background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 };
const inputStyle: CSSProperties = { padding: 8, border: "1px solid #D1D5DB", borderRadius: 6, width: "100%" };
type CostInput = { distance_km: number; cargo_weight_tons: number; avg_speed_kmh: number; road_condition: "highway" | "urban" | "rough"; fuel_price_per_liter: number; labor_rate_per_hour: number; helper_rate_per_hour: number; toll_rate_per_km: number };
type MaintenanceInput = { mileage_km: number; age_years: number; engine_hours: number; has_recurring_issue: boolean };

export default function PredictionsPage() {
  useRoleGuard(["dispatcher", "manager", "admin"]);
  const [costInput, setCostInput] = useState({
    distance_km: 120,
    cargo_weight_tons: 8,
    avg_speed_kmh: 50,
    road_condition: "highway" as "highway" | "urban" | "rough",
    fuel_price_per_liter: 65,
    labor_rate_per_hour: 100,
    helper_rate_per_hour: 60,
    toll_rate_per_km: 1.5,
  });
  const [costResult, setCostResult] = useState<TripCostPredictResponse | null>(null);
  const [model, setModel] = useState<CostRegressionSummary | null>(null);
  const [maint, setMaint] = useState({ mileage_km: 60000, age_years: 4, engine_hours: 1200, has_recurring_issue: false });
  const [maintResult, setMaintResult] = useState<MaintenancePredictResponse | null>(null);
  const [granularity, setGranularity] = useState<TimeGranularity>("monthly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [horizon, setHorizon] = useState(3);
  const [forecasts, setForecasts] = useState<OperationalForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forecastBusy, setForecastBusy] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setForecastBusy(true);
    setError(null);
    try {
      const [forecastResponse, modelResponse] = await Promise.all([
        AnalyticsApi.forecastOperations({ granularity, horizon, date_from: dateFrom || undefined, date_to: dateTo || undefined }),
        AnalyticsApi.costRegression(),
      ]);
      setForecasts(forecastResponse);
      setModel(modelResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Predictive analytics failed to load");
    } finally {
      setForecastBusy(false);
    }
  }, [dateFrom, dateTo, granularity, horizon]);

  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);

  const runCost = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await AnalyticsApi.predictTripCost(costInput);
      setCostResult(result);
      setModel(result.regression);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cost prediction failed");
    } finally { setBusy(false); }
  };

  const runMaintenance = async () => {
    setBusy(true);
    setError(null);
    try { setMaintResult(await AnalyticsApi.predictMaintenance(maint)); }
    catch (err) { setError(err instanceof Error ? err.message : "Maintenance prediction failed"); }
    finally { setBusy(false); }
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 20 }}>
        <header>
          <h1 style={{ margin: 0 }}>Predictive Analytics &amp; Decision Support</h1>
          <p style={{ marginTop: 6, color: "#6B7280" }}>
            Auditable regression cost estimates, operational forecasts, statistical evidence, interpretations, and recommended actions.
          </p>
        </header>
        {error && <div role="alert" style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div>}

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Forecast filters and drilldown</h2>
          <p style={{ color: "#6B7280", marginTop: -4 }}>Change the rollup to drill Year → Quarter → Month → Week → Day.</p>
          <TimeGranularityPicker value={granularity} onChange={setGranularity} disabled={forecastBusy} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12, marginTop: 14 }}>
            <Field label="Historical date from"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} /></Field>
            <Field label="Historical date to"><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} /></Field>
            <Field label="Forecast periods"><input type="number" min={1} max={12} value={horizon} onChange={(e) => setHorizon(Math.max(1, Math.min(12, Number(e.target.value))))} style={inputStyle} /></Field>
            <div style={{ display: "flex", alignItems: "flex-end" }}><button type="button" onClick={() => void loadAnalytics()} disabled={forecastBusy} style={buttonStyle("#2563EB")}>{forecastBusy ? "Refreshing…" : "Apply filters"}</button></div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 20 }}>
          <CostPredictionCard
            input={costInput}
            setInput={setCostInput}
            result={costResult}
            model={model}
            run={runCost}
            busy={busy}
          />
          <MaintenanceCard input={maint} setInput={setMaint} result={maintResult} run={runMaintenance} busy={busy} />
        </section>

        <section style={{ display: "grid", gap: 20 }} aria-busy={forecastBusy}>
          {forecasts?.series.map((series) => <ForecastPanel key={series.key} series={series} />)}
          {!forecastBusy && !forecasts?.series.length ? <div style={card}>No forecast modules are available.</div> : null}
        </section>
      </div>
    </main>
  );
}

function CostPredictionCard({ input, setInput, result, model, run, busy }: {
  input: CostInput;
  setInput: Dispatch<SetStateAction<CostInput>>;
  result: TripCostPredictResponse | null;
  model: CostRegressionSummary | null;
  run: () => Promise<void>;
  busy: boolean;
}) {
  const fields = [
    ["distance_km", "Distance (km)"], ["cargo_weight_tons", "Cargo (tons)"], ["avg_speed_kmh", "Average speed (km/h)"],
    ["fuel_price_per_liter", "Fuel price (₱/L)"], ["labor_rate_per_hour", "Driver rate (₱/h)"],
    ["helper_rate_per_hour", "Helper rate (₱/h)"], ["toll_rate_per_km", "Toll rate (₱/km)"],
  ] as const;
  return (
    <article style={card}>
      <h2 style={{ marginTop: 0 }}>Regression-based cost estimation</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
        {fields.map(([key, label]) => <NumberField key={key} label={label} value={input[key]} onChange={(value) => setInput((prev) => ({ ...prev, [key]: value }))} />)}
        <Field label="Road condition"><select value={input.road_condition} onChange={(e) => setInput((prev) => ({ ...prev, road_condition: e.target.value as typeof prev.road_condition }))} style={inputStyle}><option value="highway">Highway</option><option value="urban">Urban</option><option value="rough">Rough</option></select></Field>
      </div>
      <button type="button" onClick={() => void run()} disabled={busy} style={{ ...buttonStyle("#0EA5E9"), marginTop: 12 }}>{busy ? "Computing…" : "Predict operational cost"}</button>
      {result && <>
        <div style={{ ...kpiGridStyle, marginTop: 16 }}>
          <Kpi label="Fuel Cost" value={formatPhp(result.fuel_cost)} /><Kpi label="Toll Cost" value={formatPhp(result.toll_cost)} />
          <Kpi label="Driver Cost" value={formatPhp(result.driver_cost)} /><Kpi label="Helper Cost" value={formatPhp(result.helper_cost)} />
          <Kpi label="Operational Cost" value={formatPhpWhole(result.total_operational_cost)} /><Kpi label="Total + Risk" value={formatPhpWhole(result.total_cost)} />
        </div>
        <h3>Prediction results</h3>
        <ul>{result.explanation.map((line) => <li key={line}>{line}</li>)}</ul>
      </>}
      <RegressionEvidence model={model} />
    </article>
  );
}

function RegressionEvidence({ model }: { model: CostRegressionSummary | null }) {
  if (!model) return null;
  return <section style={{ marginTop: 18, borderTop: "1px solid #E5E7EB", paddingTop: 14 }}>
    <h3 style={{ marginTop: 0 }}>Regression model and R² evidence</h3>
    <p><strong>Model:</strong> {model.method}</p>
    <p><strong>Status:</strong> {model.trained ? `Trained on ${model.sample_size} completed trips` : `Formula fallback (${model.sample_size}/${model.minimum_samples} required samples)`}</p>
    <div style={{ overflowX: "auto" }}><table style={tableStyle}><thead><tr><th style={cellStyle}>Target</th><th style={cellStyle}>Prediction</th><th style={cellStyle}>R²</th><th style={cellStyle}>Coefficients</th></tr></thead><tbody>
      {model.targets.map((target) => <tr key={target.target}><td style={cellStyle}>{target.label}</td><td style={cellStyle}>{target.prediction == null ? "Run prediction" : formatPhp(target.prediction)}</td><td style={cellStyle}>{target.r_squared == null ? "N/A" : target.r_squared.toFixed(4)}</td><td style={cellStyle}>{Object.entries(target.coefficients).map(([key, value]) => `${key}: ${value}`).join(" · ") || "N/A"}</td></tr>)}
    </tbody></table></div>
    <DecisionBlock title="Interpretation" text={model.interpretation} color="#EFF6FF" />
    <DecisionBlock title="Recommendation" text={model.recommendation} color="#ECFDF5" />
  </section>;
}

function MaintenanceCard({ input, setInput, result, run, busy }: {
  input: MaintenanceInput;
  setInput: Dispatch<SetStateAction<MaintenanceInput>>;
  result: MaintenancePredictResponse | null;
  run: () => Promise<void>;
  busy: boolean;
}) {
  return <article style={card}>
    <h2 style={{ marginTop: 0 }}>Vehicle maintenance decision support</h2>
    <NumberField label="Mileage (km)" value={input.mileage_km} onChange={(value) => setInput((p) => ({ ...p, mileage_km: value }))} />
    <NumberField label="Vehicle age (years)" value={input.age_years} onChange={(value) => setInput((p) => ({ ...p, age_years: value }))} />
    <NumberField label="Engine hours" value={input.engine_hours} onChange={(value) => setInput((p) => ({ ...p, engine_hours: value }))} />
    <label style={{ display: "flex", gap: 8, marginTop: 10 }}><input type="checkbox" checked={input.has_recurring_issue} onChange={(e) => setInput((p) => ({ ...p, has_recurring_issue: e.target.checked }))} />Recurring issue recorded</label>
    <button type="button" onClick={() => void run()} disabled={busy} style={{ ...buttonStyle("#7C3AED"), marginTop: 12 }}>{busy ? "Computing…" : "Predict maintenance need"}</button>
    {result && <>
      <div style={{ ...kpiGridStyle, marginTop: 16 }}><Kpi label="Risk Score" value={result.risk_score.toFixed(3)} /><Kpi label="Priority" value={result.priority_level.replaceAll("_", " ").toUpperCase()} /><Kpi label="Next Service" value={`${result.next_service_in_days} days`} /><Kpi label="Projected Cost" value={formatPhpWhole(result.estimated_cost)} /></div>
      <DecisionBlock title="System interpretation" text={`The vehicle is ${result.priority_level.replaceAll("_", " ")} and is predicted to require service within ${result.next_service_in_days} days.`} color="#F5F3FF" />
      <DecisionBlock title="Actionable recommendation" text={result.next_service_in_days <= 14 ? "Reserve a maintenance slot within the next two weeks and avoid assigning this vehicle to long-haul work until inspected." : "Keep the vehicle in the preventive-maintenance schedule and monitor recurring issues before dispatch."} color="#ECFDF5" />
    </>}
  </article>;
}

function ForecastPanel({ series }: { series: OperationalForecastSeries }) {
  const chartData = useMemo(() => [
    ...series.historical.map((point) => ({ period: point.period, historical: point.value, forecast: null as number | null })),
    ...series.forecast.map((point) => ({ period: point.period, historical: null as number | null, forecast: point.value })),
  ], [series]);
  const next = series.forecast[0]?.value;
  return <article style={card}>
    <header><h2 style={{ margin: 0 }}>{series.title} Forecast</h2><p style={{ color: "#6B7280" }}>Decision-support time series · {series.unit}</p></header>
    <div style={kpiGridStyle}><Kpi label="Historical Periods" value={series.historical.length} /><Kpi label="Next Forecast" value={next == null ? "Insufficient data" : `${next.toFixed(2)} ${series.unit}`} /><Kpi label="Historical Average" value={series.statistics ? `${series.statistics.average.toFixed(2)} ${series.unit}` : "Insufficient data"} /><Kpi label="Historical Total" value={series.statistics ? `${series.statistics.total.toFixed(2)} ${series.unit}` : "Insufficient data"} /></div>
    <FlowHeading index={1} title="Historical Data" /><p>{series.historical.length ? `${series.historical.length} aggregated historical periods are included below.` : "No historical records match the selected filters."}</p>
    <FlowHeading index={2} title="Forecast Graph" /><ForecastChart type={series.chart_type} data={chartData} />
    <FlowHeading index={3} title="Forecast Values" />
    <div style={{ overflowX: "auto" }}><table style={tableStyle}><thead><tr><th style={cellStyle}>Period</th><th style={cellStyle}>Type</th><th style={cellStyle}>Value ({series.unit})</th></tr></thead><tbody>{chartData.map((row) => <tr key={`${row.period}-${row.forecast == null ? "h" : "f"}`}><td style={cellStyle}>{row.period}</td><td style={cellStyle}>{row.forecast == null ? "Historical" : "Forecast"}</td><td style={cellStyle}>{(row.forecast ?? row.historical ?? 0).toFixed(2)}</td></tr>)}</tbody></table></div>
    <FlowHeading index={4} title="Forecast Method" /><p>{series.method}</p>
    <FlowHeading index={5} title="Interpretation" /><DecisionBlock title="System interpretation" text={series.interpretation} color="#EFF6FF" />
    <FlowHeading index={6} title="Recommendation" /><DecisionBlock title="Actionable recommendation" text={series.recommendation} color="#ECFDF5" />
    <h3>Statistical summary</h3>{series.statistics ? <div style={kpiGridStyle}><Kpi label="Minimum" value={series.statistics.minimum} /><Kpi label="Maximum" value={series.statistics.maximum} /><Kpi label="Mean" value={series.statistics.average} /><Kpi label="Std. deviation" value={series.statistics.standard_deviation ?? "N/A"} /></div> : <p>Insufficient historical data for statistics.</p>}
  </article>;
}

function ForecastChart({ type, data }: { type: OperationalForecastSeries["chart_type"]; data: Array<{ period: string; historical: number | null; forecast: number | null }> }) {
  const common = <><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" minTickGap={24} /><YAxis /><Tooltip /><Legend /></>;
  if (type === "area") return <div style={{ height: 300 }}><ResponsiveContainer><AreaChart data={data}>{common}<Area type="monotone" dataKey="historical" name="Historical" stroke="#2563EB" fill="#BFDBFE" /><Area type="monotone" dataKey="forecast" name="Forecast" stroke="#F59E0B" fill="#FDE68A" strokeDasharray="6 4" /></AreaChart></ResponsiveContainer></div>;
  if (type === "bar") return <div style={{ height: 300 }}><ResponsiveContainer><BarChart data={data}>{common}<Bar dataKey="historical" name="Historical" fill="#7C3AED" /><Bar dataKey="forecast" name="Forecast" fill="#F59E0B" /></BarChart></ResponsiveContainer></div>;
  return <div style={{ height: 300 }}><ResponsiveContainer><LineChart data={data}>{common}<Line type="monotone" dataKey="historical" name="Historical" stroke="#2563EB" strokeWidth={3} connectNulls={false} /><Line type="monotone" dataKey="forecast" name="Forecast" stroke="#F59E0B" strokeWidth={3} strokeDasharray="6 4" connectNulls={false} /></LineChart></ResponsiveContainer></div>;
}

function FlowHeading({ index, title }: { index: number; title: string }) { return <h3 style={{ marginTop: 22, marginBottom: 8 }}><span style={{ color: "#9CA3AF", marginRight: 8 }}>{index} ↓</span>{title}</h3>; }
function DecisionBlock({ title, text, color }: { title: string; text: string; color: string }) { return <div style={{ background: color, borderRadius: 8, padding: 12, marginTop: 10 }}><strong>{title}</strong><p style={{ margin: "6px 0 0" }}>{text}</p></div>; }
function Kpi({ label, value }: { label: string; value: string | number }) { return <div style={{ background: "#F9FAFB", borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase" }}>{label}</div><div style={{ fontWeight: 800, marginTop: 3 }}>{value}</div></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label style={{ display: "grid", gap: 4 }}><span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{label}</span>{children}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} style={inputStyle} /></Field>; }
function buttonStyle(color: string): CSSProperties { return { padding: "10px 16px", background: color, color: "white", border: 0, borderRadius: 8, fontWeight: 700, cursor: "pointer", width: "100%" }; }
const kpiGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 8 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const cellStyle: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #E5E7EB", textAlign: "left", verticalAlign: "top" };
