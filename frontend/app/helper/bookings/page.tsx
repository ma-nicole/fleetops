"use client";

import CrewAssignedBookingsScreen from "@/components/CrewAssignedBookingsScreen";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function HelperBookingsPage() {
  useRoleGuard(["helper"]);

  return (
    <CrewAssignedBookingsScreen
      variant="helper"
      dashboardHref="/driver/dashboard"
      pageTitle="Bookings"
      pageSubtitle="Assigned trips — pickup/dropoff, schedule, driver, cargo, your milestone tasks, and proof requirements."
    />
  );
}
