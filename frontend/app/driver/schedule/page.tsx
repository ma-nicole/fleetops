"use client";

import CrewAssignedBookingsScreen from "@/components/CrewAssignedBookingsScreen";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function DriverScheduleBookingsPage() {
  useRoleGuard(["driver"]);

  return (
    <CrewAssignedBookingsScreen
      variant="driver"
      dashboardHref="/driver/dashboard"
      dashboardLabel="← Back to Dashboard"
      pageTitle="Scheduled Bookings"
      pageSubtitle="Trips assigned to you — full operational table (customer, route, truck, crew, payment, progress, latest location). Open View for timeline, proofs, and reports. View only; your helper submits milestones and locations."
      showSummaryTiles
    />
  );
}
