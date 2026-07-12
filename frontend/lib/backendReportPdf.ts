import { apiFullUrl } from "./api";
import { computeRowStatistics } from "./analyticsStatistics";
import { downloadProfessionalReportPdf } from "./professionalReportPdf";
import { getReportExportContext } from "./reportExportContext";

export type BackendReportPayload = {
  report_name: string;
  module_name: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  record_count?: number;
};

/** Fetch a backend JSON report endpoint and export as a professional PDF. */
export async function downloadBackendReportPdf(opts: {
  apiPath: string;
  moduleName?: string;
  reportName?: string;
  reportPeriod?: string;
  filtersUsed?: string[];
  filenameStem: string;
}): Promise<void> {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("token") || window.localStorage.getItem("authToken")
      : null;
  const res = await fetch(apiFullUrl(opts.apiPath), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not load report data (${res.status})`);
  const data = (await res.json()) as BackendReportPayload;
  const columns = data.columns ?? [];
  const rows = data.rows ?? [];
  const statistics = computeRowStatistics(rows);
  const context = getReportExportContext(
    opts.moduleName ?? data.module_name ?? "Operations Reports",
    opts.reportName ?? data.report_name ?? "Operational Report",
  );

  downloadProfessionalReportPdf({
    context,
    reportPeriod: opts.reportPeriod ?? "All available data",
    filtersUsed: opts.filtersUsed ?? ["No additional filters applied."],
    executiveSummary: [
      { label: "Total records", value: data.record_count ?? rows.length },
      ...(statistics
        ? [
            { label: "Numeric sum", value: statistics.subtotal },
            { label: "Average", value: statistics.average },
            { label: "Maximum", value: statistics.maximum },
            { label: "Minimum", value: statistics.minimum },
          ]
        : []),
    ],
    tableColumns: columns,
    tableRows: rows,
    statistics,
    interpretation: `Operational PDF export from ${context.reportName}. Review the executive summary, statistical summary, and data table for documentation and presentation use.`,
    analyticsType: "Descriptive",
    filenameStem: opts.filenameStem,
  });
}

/** @deprecated Use downloadBackendReportPdf */
export const downloadBackendCsvReportPdf = downloadBackendReportPdf;
