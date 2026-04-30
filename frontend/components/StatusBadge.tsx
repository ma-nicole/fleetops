"use client";

type StatusBadgeProps = {
  status: "pending" | "confirmed" | "in-transit" | "delivered" | "completed" | "cancelled";
  label?: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const statusConfig = {
    pending: { icon: "⏳", color: "#FF9800", bg: "rgba(255, 152, 0, 0.1)", label: "Pending" },
    confirmed: { icon: "✓", color: "#4CAF50", bg: "rgba(76, 175, 80, 0.1)", label: "Confirmed" },
    "in-transit": { icon: "🚚", color: "#FF9800", bg: "rgba(255, 152, 0, 0.1)", label: "In Transit" },
    delivered: { icon: "📍", color: "#4CAF50", bg: "rgba(76, 175, 80, 0.1)", label: "Delivered" },
    completed: { icon: "✅", color: "#4CAF50", bg: "rgba(76, 175, 80, 0.1)", label: "Completed" },
    cancelled: { icon: "✗", color: "#F44336", bg: "rgba(244, 67, 54, 0.1)", label: "Cancelled" },
  };

  const config = statusConfig[status];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 1rem",
        background: config.bg,
        border: `1px solid ${config.color}`,
        borderRadius: "20px",
        color: config.color,
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      <span style={{ fontSize: "1rem" }}>{config.icon}</span>
      {label || config.label}
    </div>
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

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "3rem 1rem",
        background: "#FAFAFA",
        border: "2px dashed #E8E8E8",
        borderRadius: "8px",
        display: "grid",
        gap: "1rem",
      }}
    >
      <div style={{ fontSize: "4rem" }}>{icon}</div>
      <div>
        <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.3rem" }}>{title}</h2>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>{description}</p>
      </div>
      {action && (
        action.href ? (
          <a
            href={action.href}
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              background: "#FF9800",
              color: "white",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: 600,
              marginTop: "0.5rem",
            }}
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "0.5rem",
            }}
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
