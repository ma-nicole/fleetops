"use client";

type StatusBadgeProps = {
  status: "pending" | "confirmed" | "in-transit" | "delivered" | "completed" | "cancelled";
  label?: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const statusConfig = {
    pending: { icon: "⏳", color: "#ffd60a", bg: "rgba(255, 214, 10, 0.1)", label: "Pending" },
    confirmed: { icon: "✓", color: "#52b788", bg: "rgba(82, 183, 136, 0.1)", label: "Confirmed" },
    "in-transit": { icon: "🚚", color: "#00b4d8", bg: "rgba(0, 180, 216, 0.1)", label: "In Transit" },
    delivered: { icon: "📍", color: "#52b788", bg: "rgba(82, 183, 136, 0.1)", label: "Delivered" },
    completed: { icon: "✅", color: "#52b788", bg: "rgba(82, 183, 136, 0.1)", label: "Completed" },
    cancelled: { icon: "✗", color: "#ef476f", bg: "rgba(239, 71, 111, 0.1)", label: "Cancelled" },
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
        background: "rgba(26, 35, 50, 0.4)",
        border: "2px dashed rgba(0, 180, 216, 0.2)",
        borderRadius: "12px",
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
              background: "linear-gradient(135deg, #00b4d8 0%, #0096c7 100%)",
              color: "white",
              borderRadius: "8px",
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
              background: "linear-gradient(135deg, #00b4d8 0%, #0096c7 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
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
