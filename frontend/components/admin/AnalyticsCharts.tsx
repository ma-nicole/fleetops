"use client";

import { formatPhp } from "@/lib/appLocale";
import { EMPTY_ANALYTICS } from "@/lib/loadingMessages";

const PIE_COLORS = ["#F59E0B", "#059669", "#D97706", "#DC2626", "#6366F1", "#64748B", "#EC4899"];

export type ChartClickPayload = {
  label: string;
  raw: Record<string, string | number>;
};

type ChartClickProps = {
  onItemClick?: (payload: ChartClickPayload) => void;
  selectedLabel?: string | null;
};

function isSelected(label: string, selectedLabel?: string | null): boolean {
  if (!selectedLabel) return false;
  return String(label ?? "").trim().toLowerCase() === String(selectedLabel ?? "").trim().toLowerCase();
}

function clickableButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: "var(--font-size-sm)",
    width: "100%",
    textAlign: "left",
    padding: "0.35rem 0.5rem",
    margin: "-0.35rem -0.5rem",
    border: active ? "1px solid var(--accent)" : "1px solid transparent",
    borderRadius: 8,
    background: active ? "rgba(245, 158, 11, 0.12)" : "transparent",
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
  };
}

export function StatGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="stat-grid-inline">
      {items.map((item) => (
        <div key={item.label} className="stat-inline">
          <p className="stat-inline__label">{item.label}</p>
          <p className="stat-inline__value">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function StatisticsTable({
  stats,
}: {
  stats: {
    minimum: number;
    maximum: number;
    average: number;
    median: number;
    subtotal: number;
    standard_deviation: number | null;
    count: number;
    insufficient_for_spread?: boolean;
  } | null;
}) {
  if (!stats) {
    return <EmptyChart message="Insufficient data" />;
  }
  const rows: [string, string | number][] = [
    ["Minimum", stats.minimum],
    ["Maximum", stats.maximum],
    ["Average", stats.average],
    ["Median", stats.median],
    ["Subtotal", stats.subtotal],
    ["Std. deviation", stats.standard_deviation != null ? stats.standard_deviation : "Insufficient data"],
    ["Count", stats.count],
  ];
  return (
    <div className="data-table-wrap" style={{ maxHeight: "none" }}>
      <table className="data-table">
        <tbody>
          {rows.map(([label, val]) => (
            <tr key={String(label)}>
              <td style={{ fontWeight: 600, color: "var(--text-secondary)", width: "50%" }}>{label}</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PieChartVisual({
  items,
  labelKey,
  valueKey,
  onItemClick,
  selectedLabel,
}: {
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
} & ChartClickProps) {
  const total = items.reduce((s, x) => s + (Number(x[valueKey]) || 0), 0);
  if (total <= 0) return <EmptyChart message="No chart data available." />;
  let acc = 0;
  const slices = items.map((item, i) => {
    const val = Number(item[valueKey]) || 0;
    const pct = (val / total) * 100;
    const start = acc;
    acc += pct;
    return { item, pct, start, color: PIE_COLORS[i % PIE_COLORS.length] };
  });
  const interactive = Boolean(onItemClick);

  const polar = (pct: number) => ((pct / 100) * 360 - 90) * (Math.PI / 180);
  const arcPath = (startPct: number, endPct: number) => {
    const start = polar(startPct);
    const end = polar(endPct);
    const large = endPct - startPct > 50 ? 1 : 0;
    const x1 = 60 + 52 * Math.cos(start);
    const y1 = 60 + 52 * Math.sin(start);
    const x2 = 60 + 52 * Math.cos(end);
    const y2 = 60 + 52 * Math.sin(end);
    if (endPct - startPct >= 99.9) {
      return "M 60 8 A 52 52 0 1 1 59.99 8 Z";
    }
    return `M 60 60 L ${x1} ${y1} A 52 52 0 ${large} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="bi-pie-chart">
      <svg viewBox="0 0 120 120" className="bi-pie-chart__svg" role="img" aria-label="Pie chart">
        {slices.map((s, i) => {
          const label = String(s.item[labelKey]);
          const active = isSelected(label, selectedLabel);
          return (
            <path
              key={`${label}-${i}`}
              d={arcPath(s.start, s.start + s.pct)}
              fill={s.color}
              stroke={active ? "#1B4332" : "#fff"}
              strokeWidth={active ? 2 : 1}
              style={{ cursor: interactive ? "pointer" : "default" }}
              onClick={() =>
                interactive &&
                onItemClick?.({ label, raw: s.item as Record<string, string | number> })
              }
            />
          );
        })}
      </svg>
      <div className="bi-pie-chart__legend">
        {slices.map((s) => {
          const label = String(s.item[labelKey]);
          const active = isSelected(label, selectedLabel);
          const content = (
            <>
              <span className="bi-pie-chart__swatch" style={{ backgroundColor: s.color }} />
              <span className="bi-pie-chart__label">{label}</span>
              <span className="bi-pie-chart__pct">{s.pct.toFixed(1)}%</span>
            </>
          );
          if (!interactive) {
            return (
              <div key={label} className="bi-pie-chart__legend-row">
                {content}
              </div>
            );
          }
          return (
            <button
              key={label}
              type="button"
              className={`bi-pie-chart__legend-btn${active ? " bi-pie-chart__legend-btn--active" : ""}`}
              onClick={() => onItemClick?.({ label, raw: s.item as Record<string, string | number> })}
              aria-pressed={active}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LineChartVisual({
  items,
  xKey,
  yKey,
  onItemClick,
  selectedLabel,
}: {
  items: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
} & ChartClickProps) {
  if (items.length === 0) return <EmptyChart />;
  const values = items.map((x) => Number(x[yKey]) || 0);
  const max = Math.max(...values, 1);
  const interactive = Boolean(onItemClick);

  return (
    <div className="bi-line-chart">
      {items.map((row) => {
        const val = Number(row[yKey]) || 0;
        const h = Math.max(6, Math.round((val / max) * 120));
        const xLabel = String(row[xKey]);
        const active = isSelected(xLabel, selectedLabel);
        const bar = (
          <div
            title={`${xLabel}: ${val}`}
            className={`bi-line-chart__bar${active ? " bi-line-chart__bar--active" : ""}`}
            style={{ height: h }}
          />
        );
        return (
          <div key={xLabel} className="bi-line-chart__col">
            {interactive ? (
              <button
                type="button"
                className="bi-line-chart__btn"
                onClick={() => onItemClick?.({ label: xLabel, raw: row as Record<string, string | number> })}
                aria-pressed={active}
              >
                {bar}
              </button>
            ) : (
              bar
            )}
            <div className="bi-line-chart__x-label">{xLabel.length > 7 ? xLabel.slice(5) : xLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

export function BarChartPhp({
  items,
  labelKey,
  valueKey,
  formatValue,
  onItemClick,
  selectedLabel,
}: {
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
  formatValue?: (value: number) => string;
} & ChartClickProps) {
  if (items.length === 0) return <EmptyChart />;
  const max = Math.max(...items.map((x) => Number(x[valueKey]) || 0), 1);
  const format = formatValue ?? formatPhp;
  const interactive = Boolean(onItemClick);

  return (
    <div className="bi-hbar-chart">
      {items.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = Math.max(4, Math.round((val / max) * 100));
        const label = String(item[labelKey]);
        const active = isSelected(label, selectedLabel);
        const row = (
          <>
            <div className="bi-hbar-chart__head">
              <span className="bi-hbar-chart__label">{label}</span>
              <span className="bi-hbar-chart__value">{format(val)}</span>
            </div>
            <div className="bi-hbar-chart__track">
              <div
                className={`bi-hbar-chart__fill${active ? " bi-hbar-chart__fill--active" : ""}`}
                style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
            </div>
          </>
        );
        if (!interactive) {
          return <div key={`${label}-${i}`} className="bi-hbar-chart__row">{row}</div>;
        }
        return (
          <button
            key={`${label}-${i}`}
            type="button"
            className={`bi-hbar-chart__btn${active ? " bi-hbar-chart__btn--active" : ""}`}
            onClick={() => onItemClick?.({ label, raw: item as Record<string, string | number> })}
            aria-pressed={active}
          >
            {row}
          </button>
        );
      })}
    </div>
  );
}

export function FinancialTrendChart({
  items,
  onItemClick,
  selectedMonth,
  selectedMetric,
}: {
  items: Array<{ month: string; revenue_php: number; expense_php: number; profit_php: number }>;
  onItemClick?: (payload: { month: string; metric: "revenue" | "expenses" | "profit" }) => void;
  selectedMonth?: string | null;
  selectedMetric?: "revenue" | "expenses" | "profit" | null;
}) {
  if (items.length === 0) return <EmptyChart />;
  const max = Math.max(
    ...items.flatMap((row) => [row.revenue_php, row.expense_php, Math.abs(row.profit_php)]),
    1,
  );
  const metrics = [
    { key: "revenue" as const, field: "revenue_php" as const, color: "#059669", label: "Rev" },
    { key: "expenses" as const, field: "expense_php" as const, color: "#DC2626", label: "Exp" },
    { key: "profit" as const, field: "profit_php" as const, color: "#6366F1", label: "Pft" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", minHeight: 160, paddingTop: 8, overflowX: "auto" }}>
      {items.map((row) => (
        <div key={row.month} style={{ minWidth: 72, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, minHeight: 120 }}>
            {metrics.map((metric) => {
              const val = Number(row[metric.field]) || 0;
              const h = Math.max(6, Math.round((Math.abs(val) / max) * 100));
              const active = selectedMonth === row.month && selectedMetric === metric.key;
              return (
                <button
                  key={metric.key}
                  type="button"
                  title={`${row.month} ${metric.label}: ${formatPhp(val)}`}
                  onClick={() => onItemClick?.({ month: row.month, metric: metric.key })}
                  style={{
                    border: active ? "2px solid var(--accent)" : "none",
                    borderRadius: 6,
                    padding: 0,
                    width: 16,
                    height: h,
                    background: metric.color,
                    cursor: "pointer",
                    opacity: active ? 1 : 0.85,
                  }}
                  aria-pressed={active}
                />
              );
            })}
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 6 }}>{row.month.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

export function EmptyChart({ message = EMPTY_ANALYTICS }: { message?: string }) {
  return (
    <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--font-size-sm)", padding: "1rem 0" }} role="status">
      {message}
    </p>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  sectionId,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  sectionId?: string;
}) {
  return (
    <section id={sectionId} className={`panel-card scroll-section${sectionId ? "" : ""}`}>
      <div>
        <h3 className="panel-card__title">{title}</h3>
        {subtitle && <p className="panel-card__subtitle">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function DrilldownTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}) {
  if (rows.length === 0) return <EmptyChart />;

  return (
    <div className="drilldown-table-wrap">
      <table className="drilldown-table">
        <thead>
          <tr>
            {columns.map((c) => {
              const kind = drilldownColumnKind(c.key);
              return (
                <th key={c.key} className={drilldownColumnClass(kind)} scope="col">
                  {c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, idx) => (
            <tr key={idx}>
              {columns.map((c) => {
                const kind = drilldownColumnKind(c.key);
                const raw = row[c.key];
                const text = formatDrilldownCell(c.key, raw);
                const title = drilldownCellTitle(kind, text);
                return (
                  <td key={c.key} className={drilldownColumnClass(kind)} title={title}>
                    <span className="drilldown-table__cell">{text}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type DrilldownColumnKind =
  | "booking-id"
  | "trip-id"
  | "driver"
  | "truck"
  | "customer"
  | "route"
  | "date"
  | "status"
  | "amount"
  | "reference-id"
  | "id"
  | "text";

const NUMERIC_KEYS = new Set([
  "amount_php",
  "cost_php",
  "revenue_php",
  "fuel_php",
  "total_cost_php",
  "actual_toll_php",
  "profit_php",
  "expense_php",
  "total",
  "count",
  "completed",
  "deliveries",
  "trip_count",
  "liters",
  "risk_score",
  "value",
  "estimated_toll",
  "actual_toll",
  "variance",
]);

export function drilldownColumnKind(key: string): DrilldownColumnKind {
  const k = key.toLowerCase();
  if (k === "booking_id") return "booking-id";
  if (k === "trip_id") return "trip-id";
  if (k === "reference_id" || k === "ref_id" || k === "reference" || k === "source_id") return "reference-id";
  if (k === "driver" || k === "driver_name") return "driver";
  if (k === "truck" || k === "truck_code" || k === "truck_id") return "truck";
  if (k.includes("client") || k === "customer") return "customer";
  if (k === "route" || k.endsWith("_route")) return "route";
  if (k.includes("date") || k === "month" || k.endsWith("_at") || k === "scheduled_month" || k === "completed_at") {
    return "date";
  }
  if (k.includes("status") || k === "category" || k === "source_type" || k === "record_type" || k === "vehicle_class") {
    return "status";
  }
  if (
    NUMERIC_KEYS.has(k) ||
    k.includes("amount") ||
    k.includes("_php") ||
    k.includes("cost") ||
    k.includes("revenue") ||
    k.includes("profit") ||
    k.includes("fuel") ||
    k.includes("toll") ||
    k.includes("expense")
  ) {
    return "amount";
  }
  if (k === "id" || k.endsWith("_id")) return "id";
  return "text";
}

export function drilldownColumnClass(kind: DrilldownColumnKind): string {
  return `drilldown-table__col drilldown-table__col--${kind}`;
}

function drilldownCellTitle(kind: DrilldownColumnKind, text: string): string | undefined {
  if (!text || text === "—") return undefined;
  if (kind === "route") return text;
  return text;
}

export function formatDrilldownCell(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  const kind = drilldownColumnKind(key);
  if (kind === "amount") {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    const k = key.toLowerCase();
    if (
      k.includes("php") ||
      k.includes("amount") ||
      k.includes("cost") ||
      k.includes("toll") ||
      k.includes("expense") ||
      k.includes("revenue") ||
      k.includes("profit") ||
      k.includes("fuel")
    ) {
      return formatPhp(n);
    }
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (kind === "date") {
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    if (/^\d{4}-\d{2}$/.test(text)) return text;
    return text;
  }
  if (kind === "status") {
    return String(value).replace(/_/g, " ");
  }
  return String(value);
}
