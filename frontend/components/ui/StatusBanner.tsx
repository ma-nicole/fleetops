"use client";

import type { CSSProperties, ReactNode } from "react";

export type StatusBannerTone = "info" | "success" | "warning" | "error";

const TONE: Record<
  StatusBannerTone,
  { bg: string; border: string; color: string; icon: string; label: string }
> = {
  info: { bg: "#EFF6FF", border: "#BFDBFE", color: "#1E40AF", icon: "ℹ", label: "Info" },
  success: { bg: "#ECFDF5", border: "#A7F3D0", color: "#047857", icon: "✓", label: "Success" },
  warning: { bg: "#FFFBEB", border: "#FDE68A", color: "#92400E", icon: "!", label: "Warning" },
  error: { bg: "#FEF2F2", border: "#FECACA", color: "#991B1B", icon: "✕", label: "Error" },
};

export default function StatusBanner({
  tone = "info",
  title,
  children,
  style,
}: {
  tone?: StatusBannerTone;
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const t = TONE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
        padding: "0.85rem 1rem",
        borderRadius: 10,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.color,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: "0.85rem",
          background: "rgba(255,255,255,0.65)",
          border: `1px solid ${t.border}`,
        }}
      >
        {t.icon}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        {(title || tone) && (
          <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 2 }}>
            {title ?? t.label}
          </div>
        )}
        <div style={{ fontSize: "0.9rem", lineHeight: 1.45 }}>{children}</div>
      </div>
    </div>
  );
}
