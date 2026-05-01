type KpiTone = "neutral" | "success" | "warning" | "danger";

type KpiCardProps = {
  label: string;
  value: string | number;
  /** Optional change-since-last-period, e.g. "+12.4%". */
  delta?: string;
  /** "up" | "down" | "flat" — drives the delta color and the SR description. */
  trend?: "up" | "down" | "flat";
  /** Locale for `Intl.NumberFormat` when `value` is a number. */
  locale?: string;
  /** Maps to a semantic text color on the value. */
  tone?: KpiTone;
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

export default function KpiCard({
  label,
  value,
  delta,
  trend,
  locale,
  tone = "neutral",
}: KpiCardProps) {
  const formatted =
    typeof value === "number"
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
      : value;

  const trendInfo = trend ? trendIndicator[trend] : null;
  const accessibleDelta = delta && trendInfo
    ? `${trendInfo.description} ${delta}`
    : delta;

  return (
    <article className="card" style={{ display: "grid", gap: "0.4rem" }}>
      <dl style={{ margin: 0, display: "grid", gap: "0.4rem" }}>
        <dt style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{label}</dt>
        <dd
          style={{
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: 700,
            color: toneColor[tone],
            lineHeight: 1.2,
          }}
        >
          {formatted}
        </dd>
      </dl>

      {delta && (
        <p
          style={{
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: trendInfo?.color || "var(--text-secondary)",
          }}
          aria-label={accessibleDelta ? `${label} ${accessibleDelta}` : undefined}
        >
          {trendInfo && (
            <span aria-hidden="true">{trendInfo.glyph}</span>
          )}
          <span>{delta}</span>
        </p>
      )}
    </article>
  );
}
