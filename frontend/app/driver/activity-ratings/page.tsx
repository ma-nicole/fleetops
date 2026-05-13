"use client";

import ActivityRatingsScreen from "@/components/ActivityRatingsScreen";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function ActivityRatingsPage() {
  useRoleGuard(["driver"]);
  return <ActivityRatingsScreen dashboardHref="/driver/dashboard" />;
}
