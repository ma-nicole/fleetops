"use client";

import ActivityRatingsScreen from "@/components/ActivityRatingsScreen";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function HelperActivityRatingsPage() {
  useRoleGuard(["helper"]);
  return <ActivityRatingsScreen dashboardHref="/driver/dashboard" />;
}
