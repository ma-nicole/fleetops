import type { AdminAnalyticsPayload } from "@/lib/analyticsApi";
import { downloadProfessionalReportPdf } from "./professionalReportPdf";
import { getReportExportContext } from "./reportExportContext";

type TollAnalytics = NonNullable<AdminAnalyticsPayload["toll_analytics"]>;
type TollAnalyticsData = Extract<TollAnalytics, { summary: unknown }>;

export function downloadTollAnalyticsReportPdf(data: TollAnalytics): void {
  if ("empty" in data && data.empty) return;
  const { summary, statistics, most_expensive_routes, route_trends, drilldown } = data as TollAnalyticsData;
  const context = getReportExportContext("Fleet Analytics", "Toll Analytics Report");

  downloadProfessionalReportPdf({
    context,
    reportPeriod: "Historical completed trips",
    filtersUsed: ["Toll matrix and actual toll records", "Completed trips only"],
    executiveSummary: [
      { label: "Historical records", value: summary.record_count },
      { label: "Estimated toll total", value: summary.estimated_toll_total_php },
      { label: "Actual toll total", value: summary.actual_toll_total_php },
      { label: "Toll variance", value: summary.toll_variance_total_php },
    ],
    tableColumns: [
      { key: "trip_id", label: "Trip" },
      { key: "route", label: "Route" },
      { key: "vehicle_class", label: "Class" },
      { key: "estimated_toll", label: "Estimated" },
      { key: "actual_toll", label: "Actual" },
      { key: "variance", label: "Variance" },
    ],
    tableRows: drilldown as unknown as Record<string, unknown>[],
    statistics,
    chartSnapshot: {
      chartType: "bar",
      title: "Most expensive routes",
      items: most_expensive_routes.map((r) => ({
        label: r.route,
        value: r.actual_toll_php,
      })),
      valueField: "value",
      yAxisLabel: "Actual toll (PHP)",
    },
    interpretation: `Toll variance totals ${summary.toll_variance_total_php} PHP across ${summary.record_count} records. Review route trends and expensive corridors for cost control.`,
    analyticsType: "Descriptive",
    filenameStem: "toll_analytics_report",
    indicators: route_trends.slice(0, 5).map((t) => ({
      label: `${t.period ?? t.month ?? "Period"}`,
      value: t.variance_php,
    })),
  });
}
