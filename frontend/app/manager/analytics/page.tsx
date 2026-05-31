"use client";

import Link from "next/link";
import AdminAnalyticsDashboard from "@/components/admin/AdminAnalyticsDashboard";
import PageShell from "@/components/ui/PageShell";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function AnalyticsPage() {
  useRoleGuard(["manager", "admin"]);

  return (
    <PageShell>
      <Link href="/manager/dashboard" className="quick-action-btn" style={{ width: "fit-content" }}>
        ← Back to dashboard
      </Link>
      <AdminAnalyticsDashboard showFinancial />
    </PageShell>
  );
}
