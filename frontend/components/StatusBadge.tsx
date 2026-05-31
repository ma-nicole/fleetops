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

const statusConfig: Record<StatusKey, { className: string; label: string }> = {
  pending: { className: "status-pill--amber", label: "Pending" },
  confirmed: { className: "status-pill--teal", label: "Confirmed" },
  "in-transit": { className: "status-pill--indigo", label: "In Transit" },
  delivered: { className: "status-pill--green", label: "Delivered" },
  completed: { className: "status-pill--green", label: "Completed" },
  cancelled: { className: "status-pill--slate", label: "Cancelled" },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <span
      role="status"
      aria-label={`Status: ${displayLabel}`}
      className={`status-pill ${config.className}`}
      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", border: "1px solid transparent" }}
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
    <section className="panel-card" aria-labelledby="empty-state-title" style={{ textAlign: "center" }}>
      <div>
        <h2 id="empty-state-title" className="panel-card__title">
          {title}
        </h2>
        <p className="panel-card__subtitle">{description}</p>
      </div>
      {action &&
        (action.href ? (
          <Link href={action.href} className="quick-action-btn quick-action-btn--primary">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="button">
            {action.label}
          </button>
        ))}
    </section>
  );
}
