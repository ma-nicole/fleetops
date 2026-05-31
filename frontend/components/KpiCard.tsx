import { APP_LOCALE } from "@/lib/appLocale";
import { scrollToSectionById } from "@/lib/scrollToSection";

type KpiTone = "neutral" | "success" | "warning" | "danger";
type KpiAccent = "orange" | "green" | "amber" | "red" | "slate" | "blue";

type KpiCardProps = {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "flat";
  locale?: string;
  tone?: KpiTone;
  accent?: KpiAccent;
  /** When set, clicking the card scrolls to this section id. */
  scrollTargetId?: string;
};

const toneColor: Record<KpiTone, string> = {
  neutral: "var(--text)",
  success: "var(--text-success)",
  warning: "var(--text-warning)",
  danger: "var(--text-error)",
};

const trendIndicator: Record<NonNullable<KpiCardProps["trend"]>, { glyph: string; description: string; color: string }> = {
  up: { glyph: "▲", description: "increased", color: "var(--text-success)" },
  down: { glyph: "▼", description: "decreased", color: "var(--text-error)" },
  flat: { glyph: "▬", description: "unchanged", color: "var(--text-secondary)" },
};

const accentClass: Record<KpiAccent, string> = {
  orange: "kpi-card--accent-orange",
  blue: "kpi-card--accent-orange",
  green: "kpi-card--accent-green",
  amber: "kpi-card--accent-amber",
  red: "kpi-card--accent-red",
  slate: "kpi-card--accent-slate",
};

export default function KpiCard({
  label,
  value,
  delta,
  trend,
  locale,
  tone = "neutral",
  accent = "orange",
  scrollTargetId,
}: KpiCardProps) {
  const resolvedLocale = locale ?? APP_LOCALE;
  const formatted =
    typeof value === "number"
      ? new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 1 }).format(value)
      : value;

  const trendInfo = trend ? trendIndicator[trend] : null;
  const accessibleDelta = delta && trendInfo ? `${trendInfo.description} ${delta}` : delta;

  const jump = scrollTargetId
    ? () => scrollToSectionById(scrollTargetId, { maxAttempts: 10, attemptDelay: 120 })
    : undefined;

  return (
    <article
      className={`kpi-card ${accentClass[accent]}${scrollTargetId ? " kpi-card--clickable scroll-section" : ""}`}
      id={scrollTargetId ? undefined : undefined}
      role={scrollTargetId ? "button" : undefined}
      tabIndex={scrollTargetId ? 0 : undefined}
      onClick={jump}
      onKeyDown={
        scrollTargetId
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                jump?.();
              }
            }
          : undefined
      }
    >
      <dl style={{ margin: 0, display: "grid", gap: "var(--space-1)" }}>
        <dt className="kpi-card__label">{label}</dt>
        <dd className="kpi-card__value" style={{ color: toneColor[tone] }}>
          {formatted}
        </dd>
      </dl>

      {delta && (
        <p
          className="kpi-card__delta"
          style={{ color: trendInfo?.color || "var(--text-secondary)" }}
          aria-label={accessibleDelta ? `${label} ${accessibleDelta}` : undefined}
        >
          {trendInfo && <span aria-hidden="true">{trendInfo.glyph} </span>}
          {delta}
        </p>
      )}
    </article>
  );
}
