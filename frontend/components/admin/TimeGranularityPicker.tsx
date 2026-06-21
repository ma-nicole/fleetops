"use client";

export type TimeGranularity = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export const TIME_GRANULARITY_OPTIONS: { id: TimeGranularity; label: string }[] = [
  { id: "yearly", label: "Year" },
  { id: "quarterly", label: "Quarter" },
  { id: "monthly", label: "Month" },
  { id: "weekly", label: "Week" },
  { id: "daily", label: "Day" },
];

type Props = {
  value: TimeGranularity;
  onChange: (value: TimeGranularity) => void;
  disabled?: boolean;
  className?: string;
  variant?: "panel" | "compact";
};

export function TimeGranularityPicker({
  value,
  onChange,
  disabled,
  className,
  variant = "panel",
}: Props) {
  const isCompact = variant === "compact";
  return (
    <div
      className={
        className ??
        (isCompact ? "bi-chart-widget__granularity" : "filter-panel__granularity")
      }
    >
      {!isCompact ? (
        <span className="filter-panel__granularity-label">Time rollup (Year → Quarter → Month → Week → Day)</span>
      ) : (
        <span className="bi-chart-widget__granularity-label">Time rollup</span>
      )}
      <div className="tab-pill-row" role="group" aria-label="Time granularity">
        {TIME_GRANULARITY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            className={`tab-pill${isCompact ? " tab-pill--compact" : ""}${value === opt.id ? " tab-pill--active" : ""}`}
            onClick={() => onChange(opt.id)}
            aria-pressed={value === opt.id}
            title={opt.id.charAt(0).toUpperCase() + opt.id.slice(1)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
