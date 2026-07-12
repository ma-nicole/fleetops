import { redirect } from "next/navigation";

/**
 * Legacy mock final-report list retired.
 * Use live analytics reporting map and role dashboards instead.
 */
export default function FinalReportRedirectPage() {
  redirect("/modules/analytics/reports");
}
