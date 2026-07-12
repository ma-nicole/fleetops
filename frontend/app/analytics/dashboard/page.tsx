import { redirect } from "next/navigation";

/** The historical client-side demo is retired in favor of live role analytics. */
export default function AnalyticsDashboardRedirectPage() {
  redirect("/manager/analytics");
}
