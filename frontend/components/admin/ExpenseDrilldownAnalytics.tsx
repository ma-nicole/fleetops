"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { EmptyChart } from "@/components/admin/AnalyticsCharts";
import { ChartDrilldownPanel } from "@/components/admin/ChartDrilldownPanel";
import { AnalyticsApi, type ExpenseInterpretationRequest } from "@/lib/analyticsApi";

export type ExpenseDrilldownRecord = {
  expense_date: string;
  category: string;
  amount_php: number;
  source_type: string;
  source_id?: number | null;
  trip_id?: number | null;
  booking_id?: number | null;
  truck_id?: number | null;
  truck_code?: string | null;
  label?: string | null;
};

export type ExpenseDrilldownPayload = {
  context_year: number;
  categories: { key: string; label: string }[];
  records: ExpenseDrilldownRecord[];
};

type DrillLevel = "high" | "mid" | "low";

type StatKey = "minimum" | "maximum" | "median" | "standard_deviation";

const PIE_COLORS = ["#F59E0B", "#059669", "#D97706", "#DC2626", "#6366F1"];

const QUARTER_LABELS: Record<number, string> = {
  1: "1st Quarter",
  2: "2nd Quarter",
  3: "3rd Quarter",
  4: "4th Quarter",
};

const QUARTER_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function categoryLabel(categories: { key: string; label: string }[], key: string): string {
  return categories.find((c) => c.key === key)?.label ?? key;
}

function recordInQuarter(rec: ExpenseDrilldownRecord, year: number, quarter: number): boolean {
  const d = new Date(`${rec.expense_date}T00:00:00`);
  return d.getFullYear() === year && QUARTER_MONTHS[quarter].includes(d.getMonth() + 1);
}

function monthKey(year: number, monthNum: number): string {
  return `${year}-${String(monthNum).padStart(2, "0")}`;
}

function computeStat(values: number[], stat: StatKey): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  switch (stat) {
    case "minimum":
      return sorted[0];
    case "maximum":
      return sorted[n - 1];
    case "median":
      return n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    case "standard_deviation": {
      if (n < 2) return null;
      const avg = sorted.reduce((s, v) => s + v, 0) / n;
      const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
      return Math.sqrt(variance);
    }
    default:
      return null;
  }
}

function statLabel(stat: StatKey): string {
  switch (stat) {
    case "minimum":
      return "Minimum";
    case "maximum":
      return "Maximum";
    case "median":
      return "Median";
    case "standard_deviation":
      return "Standard Deviation";
  }
}

function ClickablePieChart({
  items,
  onSliceClick,
}: {
  items: { key: string; label: string; amount_php: number }[];
  onSliceClick: (key: string) => void;
}) {
  const total = items.reduce((s, x) => s + x.amount_php, 0);
  if (total <= 0) return null;

  let acc = 0;
  const slices = items.map((item, i) => {
    const pct = (item.amount_php / total) * 100;
    const start = acc;
    acc += pct;
    return { ...item, pct, start, color: PIE_COLORS[i % PIE_COLORS.length] };
  });
  const gradient = slices.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `conic-gradient(${gradient})`,
          flexShrink: 0,
          boxShadow: "var(--shadow-sm)",
        }}
        aria-hidden
      />
      <div style={{ display: "grid", gap: "0.5rem", flex: 1, minWidth: 200 }}>
        {slices.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSliceClick(s.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "var(--font-size-sm)",
              padding: "0.45rem 0.65rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
            className="expense-pie-legend-btn"
          >
            <span style={{ width: 12, height: 12, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 600, color: "var(--text)" }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>{formatPhp(s.amount_php)}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.pct.toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthlyBarChart({
  items,
  onBarClick,
}: {
  items: { month: string; monthLabel: string; total: number }[];
  onBarClick: (month: string) => void;
}) {
  if (items.length === 0) return <EmptyChart message="No monthly data available." />;
  const max = Math.max(...items.map((x) => x.total), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", minHeight: 160, paddingTop: 8 }}>
      {items.map((row) => {
        const h = Math.max(8, Math.round((row.total / max) * 140));
        return (
          <button
            key={row.month}
            type="button"
            onClick={() => onBarClick(row.month)}
            title={`${row.monthLabel}: ${formatPhp(row.total)}`}
            style={{
              flex: 1,
              minWidth: 56,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  height: h,
                  margin: "0 auto",
                  width: "100%",
                  maxWidth: 56,
                  borderRadius: "6px 6px 2px 2px",
                  background: "linear-gradient(180deg, #FBBF24 0%, #F59E0B 100%)",
                  transition: "opacity 0.15s ease",
                }}
              />
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text)", marginTop: 8 }}>
                {row.monthLabel}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 2 }}>
                {formatPhp(row.total)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function ExpenseDrilldownAnalytics({ drilldown }: { drilldown: ExpenseDrilldownPayload }) {
  const { context_year, categories, records } = drilldown;
  const [level, setLevel] = useState<DrillLevel>("high");
  const [quarter, setQuarter] = useState<number>(1);
  const [category, setCategory] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [stat, setStat] = useState<StatKey>("median");
  const [tableCategoryFilter, setTableCategoryFilter] = useState<string | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<string>("No data available yet.");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const quarterRecords = useMemo(
    () => records.filter((r) => recordInQuarter(r, context_year, quarter)),
    [records, context_year, quarter],
  );

  const pieData = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const cat of categories) {
      totals[cat.key] = 0;
    }
    for (const rec of quarterRecords) {
      totals[rec.category] = (totals[rec.category] ?? 0) + rec.amount_php;
    }
    return categories
      .map((cat) => ({ key: cat.key, label: cat.label, amount_php: round2(totals[cat.key] ?? 0) }))
      .filter((x) => x.amount_php > 0);
  }, [categories, quarterRecords]);

  const quarterTotal = pieData.reduce((s, x) => s + x.amount_php, 0);
  const highTableRows = useMemo(() => {
    if (!tableCategoryFilter) return quarterRecords;
    return quarterRecords.filter((r) => r.category === tableCategoryFilter);
  }, [quarterRecords, tableCategoryFilter]);
  const aiInput = useMemo<ExpenseInterpretationRequest | null>(() => {
    if (pieData.length === 0 || quarterTotal <= 0) return null;
    const ranked = [...pieData].sort((a, b) => b.amount_php - a.amount_php);
    const largest = ranked[0];
    const smallest = ranked[ranked.length - 1];
    const topTwoShare = ((ranked[0]?.amount_php ?? 0) + (ranked[1]?.amount_php ?? 0)) / quarterTotal * 100;
    const largestPct = (largest.amount_php / quarterTotal) * 100;
    const concentration: ExpenseInterpretationRequest["concentration"] =
      largestPct >= 55 || topTwoShare >= 80
        ? "highly concentrated"
        : largestPct >= 40 || topTwoShare >= 65
          ? "moderately concentrated"
          : "balanced";

    return {
      context_year,
      quarter,
      quarter_label: QUARTER_LABELS[quarter],
      total_php: round2(quarterTotal),
      categories: ranked.map((x) => ({
        key: x.key,
        label: x.label,
        amount_php: round2(x.amount_php),
        percentage: round2((x.amount_php / quarterTotal) * 100),
      })),
      largest: {
        key: largest.key,
        label: largest.label,
        amount_php: round2(largest.amount_php),
        percentage: round2((largest.amount_php / quarterTotal) * 100),
      },
      smallest: {
        key: smallest.key,
        label: smallest.label,
        amount_php: round2(smallest.amount_php),
        percentage: round2((smallest.amount_php / quarterTotal) * 100),
      },
      concentration,
    };
  }, [context_year, quarter, pieData, quarterTotal]);

  useEffect(() => {
    let cancelled = false;
    if (!aiInput) {
      setAiInterpretation("No data available yet.");
      setAiError(null);
      setAiLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setAiLoading(true);
    setAiError(null);
    void AnalyticsApi.expenseInterpretation(aiInput)
      .then((res) => {
        if (cancelled) return;
        setAiInterpretation(res.interpretation || "No data available yet.");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "AI interpretation unavailable.";
        setAiError(msg);
      })
      .finally(() => {
        if (cancelled) return;
        setAiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aiInput]);

  const categoryRecords = useMemo(() => {
    if (!category) return [];
    return quarterRecords.filter((r) => r.category === category);
  }, [quarterRecords, category]);

  const monthlyData = useMemo(() => {
    if (!category) return [];
    const monthNums = QUARTER_MONTHS[quarter];
    return monthNums.map((m) => {
      const key = monthKey(context_year, m);
      const total = categoryRecords
        .filter((r) => r.expense_date.startsWith(key))
        .reduce((s, r) => s + r.amount_php, 0);
      return { month: key, monthLabel: MONTH_NAMES[m - 1], total: round2(total) };
    });
  }, [category, categoryRecords, context_year, quarter]);

  const monthRecords = useMemo(() => {
    if (!category || !month) return [];
    return records.filter((r) => r.category === category && r.expense_date.startsWith(month));
  }, [records, category, month]);

  const statValue = useMemo(() => {
    const values = monthRecords.map((r) => r.amount_php);
    return computeStat(values, stat);
  }, [monthRecords, stat]);

  const breadcrumb = useMemo(() => {
    const parts = [QUARTER_LABELS[quarter]];
    if (category) parts.push(categoryLabel(categories, category));
    if (month && level === "low") {
      const m = parseInt(month.split("-")[1], 10);
      parts.push(MONTH_NAMES[m - 1] ?? month);
    }
    return parts;
  }, [quarter, category, month, level, categories]);

  const goHigh = () => {
    setLevel("high");
    setCategory(null);
    setMonth(null);
    setTableCategoryFilter(null);
  };

  const goMid = () => {
    setLevel("mid");
    setMonth(null);
  };

  const onSliceClick = (key: string) => {
    setTableCategoryFilter(key);
  };

  const openMonthlyBreakdown = () => {
    if (!tableCategoryFilter) return;
    setCategory(tableCategoryFilter);
    setLevel("mid");
    setMonth(null);
  };

  const onMonthClick = (monthKeyVal: string) => {
    setMonth(monthKeyVal);
    setLevel("low");
  };

  const onQuarterChange = (q: number) => {
    setQuarter(q);
    goHigh();
  };

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <nav aria-label="Expense drill-down breadcrumb" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        {level !== "high" ? (
          <button type="button" className="quick-action-btn" onClick={level === "low" ? goMid : goHigh}>
            ← Back
          </button>
        ) : null}
        <ol
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            listStyle: "none",
            margin: 0,
            padding: 0,
            fontSize: "var(--font-size-sm)",
            color: "var(--text-secondary)",
          }}
        >
          {breadcrumb.map((part, i) => (
            <li key={part} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              {i > 0 ? <span aria-hidden="true">›</span> : null}
              <span style={{ fontWeight: i === breadcrumb.length - 1 ? 700 : 500, color: i === breadcrumb.length - 1 ? "var(--text)" : undefined }}>
                {part}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {level === "high" && (
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-size-sm)", fontWeight: 600 }}>
              Quarter
              <select
                className="input"
                value={quarter}
                onChange={(e) => onQuarterChange(Number(e.target.value))}
                style={{ minWidth: 140 }}
                aria-label="Select quarter"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    {QUARTER_LABELS[q]}
                  </option>
                ))}
              </select>
            </label>
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
              {context_year} · Click a category to drill down
            </span>
          </div>

          {quarterTotal <= 0 ? (
            <EmptyChart message="No expense data available for this quarter." />
          ) : (
            <>
              <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                Total operational expenses: <strong style={{ color: "var(--text)" }}>{formatPhp(quarterTotal)}</strong>
              </p>
              <ClickablePieChart items={pieData} onSliceClick={onSliceClick} />
              {tableCategoryFilter ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
                  <button type="button" className="quick-action-btn" onClick={openMonthlyBreakdown}>
                    Monthly breakdown →
                  </button>
                </div>
              ) : null}
              <ChartDrilldownPanel
                filterLabel={
                  tableCategoryFilter ? categoryLabel(categories, tableCategoryFilter) : null
                }
                onClear={() => setTableCategoryFilter(null)}
                columns={[
                  { key: "expense_date", label: "Date" },
                  { key: "category", label: "Category" },
                  { key: "amount_php", label: "Amount" },
                  { key: "source_type", label: "Source" },
                  { key: "trip_id", label: "Trip" },
                  { key: "booking_id", label: "Booking" },
                  { key: "truck_code", label: "Truck" },
                  { key: "label", label: "Description" },
                ]}
                rows={highTableRows.map((r) => ({
                  ...r,
                  amount_php: formatPhp(r.amount_php),
                  trip_id: r.trip_id ?? "—",
                  booking_id: r.booking_id ?? "—",
                  truck_code: r.truck_code ?? "—",
                  label: r.label ?? "—",
                }))}
                totalCount={quarterRecords.length}
              />
              <section className="panel-card" style={{ padding: "1rem" }}>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>📊 AI Interpretation</h4>
                {aiLoading ? (
                  <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                    Generating interpretation from current chart data...
                  </p>
                ) : aiError ? (
                  <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                    {aiError}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                    {aiInterpretation}
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {level === "mid" && category && (
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <div>
            <h4 style={{ margin: "0 0 0.25rem", fontSize: "1rem", fontWeight: 700 }}>
              {categoryLabel(categories, category)} — {QUARTER_LABELS[quarter]} {context_year}
            </h4>
            <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
              Monthly breakdown · Click a month to view date-level records
            </p>
          </div>
          {monthlyData.every((m) => m.total <= 0) ? (
            <EmptyChart message="No monthly data available." />
          ) : (
            <MonthlyBarChart items={monthlyData} onBarClick={onMonthClick} />
          )}
        </div>
      )}

      {level === "low" && category && month && (
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <div>
            <h4 style={{ margin: "0 0 0.25rem", fontSize: "1rem", fontWeight: 700 }}>
              {categoryLabel(categories, category)} · {MONTH_NAMES[parseInt(month.split("-")[1], 10) - 1]} {context_year}
            </h4>
            <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
              Date-level expense records from the database
            </p>
          </div>

          {monthRecords.length === 0 ? (
            <EmptyChart message="No monthly data available." />
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--font-size-sm)", fontWeight: 600 }}>
                  Statistic
                  <select
                    className="input"
                    value={stat}
                    onChange={(e) => setStat(e.target.value as StatKey)}
                    aria-label="Select statistic"
                  >
                    <option value="minimum">Minimum</option>
                    <option value="maximum">Maximum</option>
                    <option value="median">Median</option>
                    <option value="standard_deviation">Standard Deviation</option>
                  </select>
                </label>
                <div
                  className="panel-card"
                  style={{ padding: "0.75rem 1rem", display: "inline-flex", gap: "0.5rem", alignItems: "baseline" }}
                >
                  <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>{statLabel(stat)}:</span>
                  <strong style={{ fontSize: "1.1rem" }}>
                    {stat === "standard_deviation" && statValue == null
                      ? "Insufficient data."
                      : statValue != null
                        ? formatPhp(statValue)
                        : "—"}
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>({monthRecords.length} record{monthRecords.length === 1 ? "" : "s"})</span>
                </div>
              </div>

              <ChartDrilldownPanel
                filterLabel={`${categoryLabel(categories, category)} · ${MONTH_NAMES[parseInt(month.split("-")[1], 10) - 1]} ${context_year}`}
                onClear={goHigh}
                columns={[
                  { key: "expense_date", label: "Date" },
                  { key: "amount_php", label: "Amount" },
                  { key: "source_type", label: "Source" },
                  { key: "trip_id", label: "Trip" },
                  { key: "booking_id", label: "Booking" },
                  { key: "truck_code", label: "Truck" },
                  { key: "label", label: "Description" },
                ]}
                rows={monthRecords.map((r) => ({
                  ...r,
                  amount_php: formatPhp(r.amount_php),
                  trip_id: r.trip_id ?? "—",
                  booking_id: r.booking_id ?? "—",
                  truck_code: r.truck_code ?? "—",
                  label: r.label ?? "—",
                }))}
                totalCount={monthRecords.length}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
