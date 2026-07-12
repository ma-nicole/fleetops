import { redirect } from "next/navigation";

/**
 * Legacy mock report generator (DriverDataFlowService / localStorage) retired.
 * Live reporting lives under analytics + PDF exports.
 */
export default function GenerateReportRedirectPage() {
  redirect("/modules/analytics/reports");
}
