"use client";

const STATUS_MAP: Record<string, { className: string; label: string }> = {
  assigned: { className: "status-pill--blue", label: "Assigned" },
  for_pickup: { className: "status-pill--blue", label: "For pickup" },
  picked_up: { className: "status-pill--amber", label: "Picked up" },
  en_route: { className: "status-pill--indigo", label: "En route" },
  dropped_off: { className: "status-pill--teal", label: "Dropped off" },
  completed: { className: "status-pill--green", label: "Completed" },
  delivered: { className: "status-pill--green", label: "Delivered" },
  delayed: { className: "status-pill--red", label: "Delayed" },
  pending: { className: "status-pill--slate", label: "Pending" },
  cancelled: { className: "status-pill--slate", label: "Cancelled" },
  in_transit: { className: "status-pill--indigo", label: "In transit" },
  confirmed: { className: "status-pill--teal", label: "Confirmed" },
};

type StatusPillProps = {
  status: string;
  label?: string;
};

export default function StatusPill({ status, label }: StatusPillProps) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const config = STATUS_MAP[key] ?? { className: "status-pill--slate", label: status || "—" };
  return (
    <span className={`status-pill ${config.className}`} role="status">
      {label ?? config.label}
    </span>
  );
}
