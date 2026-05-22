"use client";

import type { CSSProperties } from "react";
import { formatDateTime, formatPhp } from "@/lib/appLocale";
import type { ExpenseAnalyticsPayload } from "@/lib/analyticsApi";

const CARD: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid var(--border, #E5E7EB)",
  borderRadius: 12,
  padding: "1.1rem",
};

const COLORS: Record<string, string> = {
  fuel: "#2563EB",
  toll: "#7C3AED",
  allowance: "#D97706",
  labor: "#059669",
  operational: "#DC2626",
};

type ExpenseAnalyticsSummaryProps = {
  data: ExpenseAnalyticsPayload;
};

function BarChart({
  items,
  valueKey,
  labelKey,
  colorKey,
}: {
  items: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
  colorKey?: string;
}) {
  const max = Math.max(...items.map((x) => Number(x[valueKey]) || 0), 1);
  return (
    <div style={{ display: "grid", gap: "0.55rem" }}>
      {items.map((item) => {
        const val = Number(item[valueKey]) || 0;
        const pct = Math.max(4, Math.round((val / max) * 100));
        const color = colorKey ? COLORS[String(item[colorKey])] || "#64748B" : "#2563EB";
        return (
          <div key={String(item[labelKey])}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: "#334155" }}>{String(item[labelKey])}</span>
              <span style={{ color: "#64748B" }}>{formatPhp(val)}</span>
            </div>
            <div style={{ height: 10, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StackedMonthChart({ rows }: { rows: ExpenseAnalyticsPayload["monthly_trend"] }) {
  if (rows.length === 0) {
    return <p style={{ margin: 0, color: "#64748B", fontSize: "0.88rem" }}>No monthly expense data yet.</p>;
  }
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.65rem", minHeight: 160, paddingTop: 8 }}>
      {rows.map((row) => {
        const h = Math.max(8, Math.round((row.total / max) * 130));
        return (
          <div key={row.month} style={{ flex: 1, minWidth: 44, textAlign: "center" }}>
            <div
              title={`${row.month}: ${formatPhp(row.total)}`}
              style={{
                height: h,
                margin: "0 auto",
                width: "100%",
                maxWidth: 56,
                borderRadius: "6px 6px 2px 2px",
                background: "linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)",
              }}
            />
            <div style={{ fontSize: "0.68rem", color: "#64748B", marginTop: 6, fontWeight: 600 }}>{row.month.slice(5)}</div>
            <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>{formatPhp(row.total)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function ExpenseAnalyticsSummary({ data }: ExpenseAnalyticsSummaryProps) {
  const s = data.summary;
  const breakdownForChart = data.category_breakdown.map((c) => ({
    label: c.label,
    amount_php: c.amount_php,
    key: c.key,
  }));

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748B" }}>
        Generated from trip system costs (fuel, toll, labor, crew allowances, maintenance), dispatcher shoulder
        ledger (fuel, toll, allowance, parking, other), fuel/toll logs, and maintenance records.{" "}
        <strong>{formatDateTime(data.generated_at)}</strong>
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.85rem",
        }}
      >
        <SummaryCard label="Total expenses" value={formatPhp(s.total_expenses_php)} accent="#1D4ED8" />
        <SummaryCard label="Fuel" value={formatPhp(s.fuel_php)} accent="#2563EB" />
        <SummaryCard label="Toll" value={formatPhp(s.toll_php)} accent="#7C3AED" />
        <SummaryCard label="Allowance" value={formatPhp(s.allowance_php)} accent="#D97706" />
        <SummaryCard label="Driver allowance" value={formatPhp(s.driver_allowance_php)} accent="#EA580C" />
        <SummaryCard label="Helper allowance" value={formatPhp(s.helper_allowance_php)} accent="#CA8A04" />
        <SummaryCard label="Labor" value={formatPhp(s.labor_php)} accent="#059669" />
        <SummaryCard label="Operational" value={formatPhp(s.operational_php)} accent="#DC2626" />
        <SummaryCard label="Trips in scope" value={String(s.trip_count)} accent="#475569" />
        <SummaryCard label="Avg / trip" value={formatPhp(s.avg_expense_per_trip_php)} accent="#0F766E" />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "1rem" }}>
        <div style={CARD}>
          <h2 style={{ margin: "0 0 0.85rem", fontSize: "1.05rem" }}>Expense mix by category</h2>
          <BarChart items={breakdownForChart} valueKey="amount_php" labelKey="label" colorKey="key" />
        </div>

        <div style={CARD}>
          <h2 style={{ margin: "0 0 0.85rem", fontSize: "1.05rem" }}>Monthly expense trend</h2>
          <StackedMonthChart rows={data.monthly_trend} />
        </div>
      </div>

      {data.shoulder_breakdown.length > 0 ? (
        <div style={CARD}>
          <h2 style={{ margin: "0 0 0.85rem", fontSize: "1.05rem" }}>Shoulder / out-of-pocket ledger</h2>
          <BarChart
            items={data.shoulder_breakdown.map((x) => ({ label: x.label, amount_php: x.amount_php, key: x.category }))}
            valueKey="amount_php"
            labelKey="label"
            colorKey="key"
          />
        </div>
      ) : null}

      <div style={CARD}>
        <h2 style={{ margin: "0 0 0.65rem", fontSize: "1.05rem" }}>Cost components (detail)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.45rem", fontSize: "0.86rem" }}>
          <ComponentLine label="Trip fuel (system)" value={data.components.system_trip_fuel_php} />
          <ComponentLine label="Shoulder fuel" value={data.components.shoulder_fuel_php} />
          <ComponentLine label="Trip toll (system)" value={data.components.system_trip_toll_php} />
          <ComponentLine label="Shoulder toll" value={data.components.shoulder_toll_php} />
          <ComponentLine label="Trip driver allowance" value={data.components.trip_driver_allowance_php} />
          <ComponentLine label="Trip helper allowance" value={data.components.trip_helper_allowance_php} />
          <ComponentLine label="Trip crew allowance (total)" value={data.components.trip_crew_allowance_php} />
          <ComponentLine label="Shoulder allowance" value={data.components.shoulder_allowance_php} />
          <ComponentLine label="Shoulder parking/other" value={data.components.shoulder_operational_php} />
          <ComponentLine label="Maintenance records" value={data.components.maintenance_records_php} />
          <ComponentLine label="Trip maintenance field" value={data.components.trip_maintenance_field_php} />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ ...CARD, borderTop: `3px solid ${accent}`, padding: "0.85rem" }}>
      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#64748B", fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: "1.12rem", marginTop: 4, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function ComponentLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{label}:</strong> {formatPhp(value)}
    </div>
  );
}
