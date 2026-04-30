import React from "react";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
}

const statusColors: Record<string, { bg: string; text: string }> = {
  // Booking statuses
  pending_approval: { bg: "#FEF3C7", text: "#92400E" },
  approved: { bg: "#D1FAE5", text: "#065F46" },
  rejected: { bg: "#FEE2E2", text: "#7F1D1D" },
  assigned: { bg: "#E0E7FF", text: "#3730A3" },
  accepted: { bg: "#F3E8FF", text: "#5B21B6" },
  enroute: { bg: "#DBEAFE", text: "#0C2D48" },
  loading: { bg: "#FED7AA", text: "#92400E" },
  out_for_delivery: { bg: "#BFDBFE", text: "#1E3A8A" },
  completed: { bg: "#D1FAE5", text: "#065F46" },
  cancelled: { bg: "#F3F4F6", text: "#4B5563" },

  // Trip statuses
  pending: { bg: "#FEF3C7", text: "#92400E" },
  departed: { bg: "#DBEAFE", text: "#0C2D48" },
  in_delivery: { bg: "#BFDBFE", text: "#1E3A8A" },
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending_approval: "Pending Approval",
    approved: "Approved",
    rejected: "Rejected",
    assigned: "Assigned",
    accepted: "Accepted",
    enroute: "Enroute",
    loading: "Loading",
    out_for_delivery: "Out for Delivery",
    completed: "Completed",
    cancelled: "Cancelled",
    pending: "Pending",
    departed: "Departed",
    in_delivery: "In Delivery",
  };
  return labels[status] || status;
};

export default function WorkflowStatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const colors = statusColors[status] || statusColors.pending;
  const label = getStatusLabel(status);

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <span
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: "6px",
        fontWeight: 500,
        display: "inline-block",
      }}
      className={sizeClasses[size]}
    >
      {label}
    </span>
  );
}
