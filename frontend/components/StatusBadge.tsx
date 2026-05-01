"use client";

import Link from "next/link";

type StatusKey =
  | "pending"
  | "confirmed"
  | "in-transit"
  | "delivered"
  | "completed"
  | "cancelled";

type StatusBadgeProps = {
  status: StatusKey;
  label?: string;
};

/**
 * Status is conveyed via three channels — text label, distinct hue,
 * and distinct border style (solid / dashed) — so it is never color-only.
 */
const statusConfig: Record<
  StatusKey,
  { text: string; bg: string; border: string; style: "solid" | "dashed"; label: string }
> = {
  pending:    { text: "#B25900", bg: "#FFF3E0", border: "#B25900", style: "solid",  label: "Pending" },
  confirmed:  { text: "#0F6D6D", bg: "#E0F7F7", border: "#0F6D6D", style: "solid",  label: "Confirmed" },
  "in-transit": { text: "#1D4ED8", bg: "#E0F2FE", border: "#1D4ED8", style: "solid",  label: "In Transit" },
  delivered:  { text: "#2E7D32", bg: "#E8F5E9", border: "#2E7D32", style: "solid",  label: "Delivered" },
  completed:  { text: "#1B5E20", bg: "#C8E6C9", border: "#1B5E20", style: "solid",  label: "Completed" },
  cancelled:  { text: "#B91C1C", bg: "#FFEBEE", border: "#B91C1C", style: "dashed", label: "Cancelled" },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <span
      role="status"
      aria-label={`Status: ${displayLabel}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.35rem 0.85rem",
        background: config.bg,
        border: `1.5px ${config.style} ${config.border}`,
        borderRadius: "999px",
        color: config.text,
        fontSize: "0.82rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
        lineHeight: 1.2,
      }}
    >
      {displayLabel}
    </span>
  );
}

type EmptyStateProps = {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section
      aria-labelledby="empty-state-title"
      style={{
        textAlign: "center",
        padding: "3rem 1rem",
        background: "#FAFAFA",
        border: "2px dashed #C8C8C8",
        borderRadius: "8px",
        display: "grid",
        gap: "1rem",
      }}
    >
      <div>
        <h2 id="empty-state-title" style={{ margin: "0 0 0.5rem 0", fontSize: "1.3rem" }}>
          {title}
        </h2>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>{description}</p>
      </div>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              background: "var(--brand-text)",
              color: "white",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: 600,
              marginTop: "0.5rem",
              minHeight: "44px",
              lineHeight: "1.5",
            }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            style={{
              padding: "0.75rem 1.5rem",
              background: "var(--brand-text)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "0.5rem",
              minHeight: "44px",
            }}
          >
            {action.label}
          </button>
        ))}
    </section>
  );
}
