import { redirect } from "next/navigation";

/** Legacy overview now resolves to the database-backed predictive workspace. */
export default function PredictiveAnalyticsRedirectPage() {
  redirect("/modules/analytics/predictions");
}
