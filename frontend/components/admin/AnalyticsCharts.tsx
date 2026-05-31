"use client";

import { formatPhp } from "@/lib/appLocale";
import { EMPTY_ANALYTICS } from "@/lib/loadingMessages";

const PIE_COLORS = ["#F59E0B", "#059669", "#D97706", "#DC2626", "#6366F1", "#64748B", "#EC4899"];

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
}: {
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
}) {
  const total = items.reduce((s, x) => s + (Number(x[valueKey]) || 0), 0);
  if (total <= 0) return <EmptyChart />;
  let acc = 0;
  const slices = items.map((item, i) => {
    const val = Number(item[valueKey]) || 0;
    const pct = (val / total) * 100;
    const start = acc;
    acc += pct;
    return { item, pct, start, color: PIE_COLORS[i % PIE_COLORS.length] };
  });
  const gradient = slices.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `conic-gradient(${gradient})`,
          flexShrink: 0,
          boxShadow: "var(--shadow-sm)",
        }}
        aria-hidden
      />
      <div style={{ display: "grid", gap: "0.35rem", flex: 1, minWidth: 160 }}>
        {slices.map((s) => (
          <div key={String(s.item[labelKey])} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--font-size-sm)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--text)" }}>{String(s.item[labelKey])}</span>
            <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChartVisual({
  items,
  xKey,
  yKey,
}: {
  items: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
}) {
  if (items.length === 0) return <EmptyChart />;
  const values = items.map((x) => Number(x[yKey]) || 0);
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", minHeight: 140, paddingTop: 8 }}>
      {items.map((row) => {
        const val = Number(row[yKey]) || 0;
        const h = Math.max(6, Math.round((val / max) * 120));
        return (
          <div key={String(row[xKey])} style={{ flex: 1, minWidth: 36, textAlign: "center" }}>
            <div
              title={`${row[xKey]}: ${val}`}
              style={{
                height: h,
                margin: "0 auto",
                width: "100%",
                maxWidth: 48,
                borderRadius: "6px 6px 2px 2px",
                background: "linear-gradient(180deg, #FBBF24 0%, #F59E0B 100%)",
              }}
            />
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 6, wordBreak: "break-all" }}>
              {String(row[xKey]).slice(5)}
            </div>
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
}: {
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
}) {
  if (items.length === 0) return <EmptyChart />;
  const max = Math.max(...items.map((x) => Number(x[valueKey]) || 0), 1);
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {items.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = Math.max(4, Math.round((val / max) * 100));
        return (
          <div key={`${item[labelKey]}-${i}`}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{String(item[labelKey])}</span>
              <span style={{ color: "var(--text-secondary)" }}>{formatPhp(val)}</span>
            </div>
            <div style={{ height: 8, background: "var(--bg-dark)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 999 }} />
            </div>
          </div>
        );
      })}
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
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, idx) => (
            <tr key={idx}>
              {columns.map((c) => (
                <td key={c.key}>{row[c.key] != null ? String(row[c.key]) : "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
