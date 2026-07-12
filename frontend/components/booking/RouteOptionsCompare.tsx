"use client";

import { formatPhp } from "@/lib/appLocale";
import type { RouteOptionQuote } from "./wizardTypes";

type Props = {
  options: RouteOptionQuote[];
  selectedOptionId: string | null;
  recommendedOptionId: string | null;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
};

/** Compare multiple road options before confirming a booking route. */
export default function RouteOptionsCompare({
  options,
  selectedOptionId,
  recommendedOptionId,
  onSelect,
  disabled = false,
}: Props) {
  if (!options.length) return null;

  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
          Compare route options
        </p>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          Recommended uses the routing engine&apos;s preferred path. Select another option to compare before you continue.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "0.75rem",
        }}
      >
        {options.map((opt) => {
          const selected = opt.id === selectedOptionId;
          const recommended = opt.is_recommended || opt.id === recommendedOptionId;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt.id)}
              aria-pressed={selected}
              style={{
                textAlign: "left",
                border: selected ? "2px solid #B45309" : "1px solid #E5E7EB",
                borderRadius: 12,
                padding: "0.85rem 0.9rem",
                background: selected ? "rgba(245, 158, 11, 0.1)" : "#fff",
                cursor: disabled ? "wait" : "pointer",
                display: "grid",
                gap: "0.45rem",
                boxShadow: recommended ? "0 0 0 1px rgba(5, 150, 105, 0.25)" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "start" }}>
                <strong style={{ fontSize: "0.88rem", color: "#111827" }}>{opt.label}</strong>
                {recommended ? (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: "#047857",
                      background: "rgba(5, 150, 105, 0.12)",
                      borderRadius: 999,
                      padding: "0.15rem 0.45rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Recommended
                  </span>
                ) : null}
              </div>
              <dl
                style={{
                  margin: 0,
                  display: "grid",
                  gap: "0.28rem",
                  fontSize: "0.8rem",
                  color: "#374151",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <dt style={{ color: "#6B7280" }}>Distance</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{opt.distance_km.toFixed(1)} km</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <dt style={{ color: "#6B7280" }}>Travel time</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{opt.travel_time_label}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <dt style={{ color: "#6B7280" }}>Fuel cost</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{formatPhp(opt.estimated_fuel_cost_php)}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <dt style={{ color: "#6B7280" }}>Toll cost</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{formatPhp(opt.estimated_toll_cost_php)}</dd>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    marginTop: "0.2rem",
                    paddingTop: "0.35rem",
                    borderTop: "1px solid #F3F4F6",
                  }}
                >
                  <dt style={{ color: "#6B7280" }}>Est. total</dt>
                  <dd style={{ margin: 0, fontWeight: 700 }}>{formatPhp(opt.quoted_total_php)}</dd>
                </div>
              </dl>
              <span style={{ fontSize: "0.75rem", color: selected ? "#B45309" : "#6B7280", fontWeight: 600 }}>
                {selected ? "Selected for this booking" : "Select this route"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
