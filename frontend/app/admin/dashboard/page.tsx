"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import AdminAnalyticsDashboard from "@/components/admin/AdminAnalyticsDashboard";
import PageShell from "@/components/ui/PageShell";

export default function AdminDashboardPage() {
  useRoleGuard(["admin", "manager"]);
  return (
    <PageShell>
      <AdminAnalyticsDashboard showFinancial />
    </PageShell>
  );
}
