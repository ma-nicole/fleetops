"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/useRoleGuard";

/**
 * Legacy `/analytics/predictions` used a client-side mock pipeline.
 * Predictions now live on `/modules/analytics/predictions` (real FastAPI endpoints).
 */
export default function AnalyticsPredictionsRedirectPage() {
  useRoleGuard(["manager", "admin", "dispatcher"]);
  const router = useRouter();

  useEffect(() => {
    router.replace("/modules/analytics/predictions");
  }, [router]);

  return (
    <main style={{ padding: "var(--page-main-padding)", minHeight: "40vh" }}>
      <p style={{ margin: 0, color: "#6B7280" }}>Opening operational predictions…</p>
    </main>
  );
}
