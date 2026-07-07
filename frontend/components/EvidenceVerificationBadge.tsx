"use client";

type Props = {
  label?: string | null;
  reviewRequired?: boolean | null;
  compact?: boolean;
};

export default function EvidenceVerificationBadge({ label, reviewRequired, compact = false }: Props) {
  if (!label) return null;
  const isVerified = label === "Camera Verified" || label.startsWith("Camera Verified");
  const flagged = reviewRequired || label.includes("Flagged") || label.includes("Gallery");
  const bg = flagged ? "#FEF3C7" : isVerified ? "#DCFCE7" : "#EFF6FF";
  const color = flagged ? "#92400E" : isVerified ? "#166534" : "#1E40AF";
  const border = flagged ? "#FCD34D" : isVerified ? "#86EFAC" : "#BFDBFE";

  return (
    <span
      style={{
        display: "inline-block",
        padding: compact ? "0.15rem 0.45rem" : "0.25rem 0.55rem",
        borderRadius: 999,
        fontSize: compact ? "0.68rem" : "0.75rem",
        fontWeight: 700,
        background: bg,
        color,
        border: `1px solid ${border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
