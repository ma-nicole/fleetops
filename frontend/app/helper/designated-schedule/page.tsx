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
      pageSubtitle="Your assigned legs with schedule windows, crew, truck, payment state, and progress — same operational data as Bookings, optimized for schedule review."
    />
  );
}
