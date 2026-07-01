import type { StatisticsSummary } from "@/lib/analyticsApi";
import type { PanelFilters } from "@/lib/analyticsStatistics";
import type { DrillDownModalContext } from "@/lib/drilldownReportTypes";
import type { ChartSelection } from "@/lib/chartDrilldownUtils";
import {
  formatPanelFiltersForReport,
  getReportExportContext,
  inferReportPeriod,
} from "./reportExportContext";
import { downloadProfessionalReportPdf, type ProfessionalReportPayload, type ReportIndicator } from "./professionalReportPdf";

type BuildArgs = {
  context: DrillDownModalContext;
  selection: ChartSelection;
  panelFilters: PanelFilters;
  panelFiltered: Record<string, unknown>[];
  chartFiltered: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  statistics: StatisticsSummary | null;
  indicators: ReportIndicator[];
  interpretation: string | null;
  moduleName?: string;
};

function buildExecutiveSummary(
  panelFiltered: Record<string, unknown>[],
  statistics: StatisticsSummary | null,
  indicators: ReportIndicator[],
): ReportIndicator[] {
  const summary: ReportIndicator[] = [
    { label: "Total records", value: panelFiltered.length },
  ];
  if (statistics) {
    summary.push(
      { label: "Numeric observations", value: statistics.count },
      { label: "Subtotal / Sum", value: statistics.subtotal },
      { label: "Average", value: statistics.average },
      { label: "Median", value: statistics.median },
    );
    if (statistics.standard_deviation != null) {
      summary.push({ label: "Standard deviation", value: statistics.standard_deviation });
    }
  }
  const growth = indicators.find((i) => i.label === "Growth Rate");
  if (growth) summary.push(growth);
  const pctIndicator = indicators.find((i) => String(i.label).toLowerCase().includes("percent"));
  if (pctIndicator) summary.push(pctIndicator);
  return summary;
}

function buildPredictiveBlock(context: DrillDownModalContext, interpretation: string | null) {
  if (context.analyticsType !== "Predictive") return null;
  return {
    modelUsed: context.analyticsMethod ?? "Regression / forecasting model",
    forecastingMethod: context.analyticsMethod ?? "Time-series projection",
    confidenceLevel: "Based on historical operational data",
    rSquared: "See backend model metrics when available",
    prediction: interpretation ? interpretation.split(".")[0] : undefined,
    interpretation: interpretation ?? undefined,
  };
}

export function buildDrilldownReportPayload(args: BuildArgs): ProfessionalReportPayload {
  const {
    context,
    selection,
    panelFilters,
    panelFiltered,
    chartFiltered,
    columns,
    statistics,
    indicators,
    interpretation,
    moduleName = "Analytics Center",
  } = args;

  const reportName = `${context.sectionTitle} — ${selection.displayLabel}`;
  const exportContext = getReportExportContext(moduleName, reportName);
  const filtersUsed = formatPanelFiltersForReport(panelFilters, selection.displayLabel, [
    `Analytics type: ${context.analyticsType ?? "Descriptive"}`,
    `Method: ${context.analyticsMethod ?? "Comparative aggregation"}`,
    `Chart type: ${context.chartType}`,
    `Records from chart selection: ${chartFiltered.length}`,
    `Records after panel filters: ${panelFiltered.length}`,
  ]);

  return {
    context: exportContext,
    reportPeriod: inferReportPeriod(panelFilters),
    filtersUsed,
    executiveSummary: buildExecutiveSummary(panelFiltered, statistics, indicators),
    tableColumns: columns,
    tableRows: panelFiltered,
    statistics,
    indicators,
    chartSnapshot: {
      chartType: context.chartType,
      title: context.sectionTitle,
      items: context.chartItems,
      valueField: context.valueField,
      xAxisLabel: context.xAxisLabel,
      yAxisLabel: context.yAxisLabel,
    },
    interpretation,
    predictive: buildPredictiveBlock(context, interpretation),
    analyticsType: context.analyticsType ?? "Descriptive",
    filenameStem: `${context.sectionTitle}_${selection.displayLabel}`.replace(/\s+/g, "_").toLowerCase(),
  };
}

export function downloadDrilldownReportPdf(args: BuildArgs): void {
  if (!args.panelFiltered.length) return;
  downloadProfessionalReportPdf(buildDrilldownReportPayload(args));
}
