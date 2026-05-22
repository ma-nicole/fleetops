"use client";

import CrewAssignedBookingsScreen from "@/components/CrewAssignedBookingsScreen";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function HelperDesignatedSchedulePage() {
  useRoleGuard(["helper"]);

  return (
    <CrewAssignedBookingsScreen
      variant="helper"
      dashboardHref="/driver/dashboard"
      pageTitle="Designated schedule"
      pageSubtitle="Your assigned legs — schedule, driver, cargo, and task progress. Update milestones and proof photos from each booking."
    />
  );
}
