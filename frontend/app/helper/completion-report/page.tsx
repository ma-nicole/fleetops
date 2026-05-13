"use client";

import Link from "next/link";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function HelperCompletionReportPage() {
  useRoleGuard(["helper"]);

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.25rem", maxWidth: 720 }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: "1rem 0 0.25rem", color: "#1A1A1A" }}>Completion report</h1>
        <p style={{ color: "#666", margin: 0, lineHeight: 1.55 }}>
          Trip completion and general operational reports are submitted by the <strong>assigned driver</strong> in this
          product (driver general form / completion flow). Helpers track milestones and locations under{" "}
          <strong>Bookings</strong>.
        </p>
      </div>

      <div style={{ padding: "1.25rem", border: "1px solid #E8E8E8", borderRadius: 10, background: "#FAFAFA" }}>
        <p style={{ margin: "0 0 0.75rem", fontWeight: 700, color: "#1e293b" }}>What you can do here</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#475569", lineHeight: 1.6 }}>
          <li>Review trip progress and proofs under Bookings.</li>
          <li>Coordinate with your driver if formal completion paperwork is required.</li>
        </ul>
      </div>

      <Link
        href="/helper/bookings"
        style={{
          display: "inline-block",
          padding: "0.65rem 1rem",
          borderRadius: 8,
          background: "#FF9800",
          color: "#fff",
          fontWeight: 700,
          textDecoration: "none",
          width: "fit-content",
        }}
      >
        Open bookings
      </Link>
    </div>
  );
}
