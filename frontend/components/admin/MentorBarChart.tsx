"use client";

import { formatPhp } from "@/lib/appLocale";
import type { ChartClickPayload } from "@/components/admin/AnalyticsCharts";

const BAR_COLORS = ["#2D6A4F", "#E76F51", "#277DA1", "#40916C", "#F4A261", "#52B788", "#1B4332", "#6366F1"];

function formatAxisValue(value: number, isCurrency: boolean): string {
  if (isCurrency) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return formatPhp(value).replace("₱", "");
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(Math.round(value));
}

function truncateLabel(label: string, max = 14): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function MentorBarChart({
  items,
  labelKey,
  valueKey,
  yAxisLabel,
  legendLabel,
  onItemClick,
  selectedLabel,
  isCurrency = false,
}: {
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
  yAxisLabel?: string;
  legendLabel?: string;
  onItemClick?: (payload: ChartClickPayload) => void;
  selectedLabel?: string | null;
  isCurrency?: boolean;
}) {
  if (!items.length) return null;

  const values = items.map((x) => Number(x[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const chartH = 200;
  const barW = Math.min(48, Math.max(22, 320 / items.length - 8));
  const gap = 10;
  const totalW = items.length * (barW + gap) + 56;

  return (
    <div className="mentor-chart">
      {legendLabel ? (
        <div className="mentor-chart__legend">
          <span className="mentor-chart__legend-swatch" style={{ background: BAR_COLORS[0] }} />
          <span>{legendLabel}</span>
        </div>
      ) : null}
      <div className="mentor-chart__plot-wrap">
        <svg viewBox={`0 0 ${totalW} ${chartH + 48}`} className="mentor-chart__svg" role="img" aria-label="Bar chart">
          {ticks.map((tick) => {
            const y = chartH - (tick / max) * (chartH - 12);
            return (
              <g key={tick}>
                <line x1={44} y1={y} x2={totalW - 8} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                <text x={40} y={y + 4} textAnchor="end" className="mentor-chart__axis-text">
                  {formatAxisValue(tick, isCurrency)}
                </text>
              </g>
            );
          })}
          {items.map((item, i) => {
            const val = Number(item[valueKey]) || 0;
            const h = Math.max(4, ((val / max) * (chartH - 12)));
            const x = 52 + i * (barW + gap);
            const y = chartH - h;
            const label = String(item[labelKey]);
            const active = selectedLabel?.toLowerCase() === label.toLowerCase();
            const color = BAR_COLORS[i % BAR_COLORS.length];
            return (
              <g key={`${label}-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={2}
                  fill={color}
                  opacity={active ? 1 : 0.92}
                  stroke={active ? "#1B4332" : "none"}
                  strokeWidth={active ? 2 : 0}
                  style={{ cursor: onItemClick ? "pointer" : "default" }}
                  onClick={() =>
                    onItemClick?.({ label, raw: item as Record<string, string | number> })
                  }
                />
                <text
                  x={x + barW / 2}
                  y={chartH + 16}
                  textAnchor="end"
                  className="mentor-chart__x-label"
                  transform={`rotate(-35 ${x + barW / 2} ${chartH + 16})`}
                >
                  {truncateLabel(label, 16)}
                </text>
              </g>
            );
          })}
          {yAxisLabel ? (
            <text x={12} y={chartH / 2} className="mentor-chart__y-title" transform={`rotate(-90 12 ${chartH / 2})`}>
              {yAxisLabel}
            </text>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
