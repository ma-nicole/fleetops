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
      pageSubtitle="Assigned trips with operational status, payments, crew, location progress, and updates — same layout as the driver schedule view."
    />
  );
}
