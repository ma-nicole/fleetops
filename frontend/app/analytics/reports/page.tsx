import { redirect } from "next/navigation";

/** Reporting now uses the database-backed analytics dashboard and drilldowns. */
export default function AnalyticsReportsRedirectPage() {
  redirect("/manager/analytics");
}
