"use client";

export type TimeGranularity = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export const TIME_GRANULARITY_OPTIONS: { id: TimeGranularity; label: string }[] = [
  { id: "yearly", label: "Y" },
  { id: "quarterly", label: "Q" },
  { id: "monthly", label: "M" },
  { id: "weekly", label: "W" },
  { id: "daily", label: "D" },
];

type Props = {
  value: TimeGranularity;
  onChange: (value: TimeGranularity) => void;
  disabled?: boolean;
  className?: string;
};

export function TimeGranularityPicker({ value, onChange, disabled, className }: Props) {
  return (
    <div className={className ?? "filter-panel__granularity"}>
      <span className="filter-panel__granularity-label">Time rollup</span>
      <div className="tab-pill-row" role="group" aria-label="Time granularity">
        {TIME_GRANULARITY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            className={`tab-pill${value === opt.id ? " tab-pill--active" : ""}`}
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
