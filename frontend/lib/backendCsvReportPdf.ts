import { apiFullUrl } from "./api";
import { computeRowStatistics } from "./analyticsStatistics";
import { downloadProfessionalReportPdf } from "./professionalReportPdf";
import { getReportExportContext } from "./reportExportContext";

function parseCsv(text: string): { columns: { key: string; label: string }[]; rows: Record<string, unknown>[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { columns: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const columns = headers.map((h) => ({ key: h, label: h }));
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const raw = (cells[i] ?? "").trim();
      const num = Number(raw);
      row[h] = raw !== "" && Number.isFinite(num) ? num : raw;
    });
    return row;
  });
  return { columns, rows };
}

/** Fetch a backend CSV endpoint and export as a professional PDF report. */
export async function downloadBackendCsvReportPdf(opts: {
  csvPath: string;
  moduleName: string;
  reportName: string;
  reportPeriod?: string;
  filtersUsed?: string[];
  filenameStem: string;
}): Promise<void> {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("token") || window.localStorage.getItem("authToken")
      : null;
  const res = await fetch(apiFullUrl(opts.csvPath), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not load report data (${res.status})`);
  const text = await res.text();
  const { columns, rows } = parseCsv(text);
  const statistics = computeRowStatistics(rows);
  const context = getReportExportContext(opts.moduleName, opts.reportName);

  downloadProfessionalReportPdf({
    context,
    reportPeriod: opts.reportPeriod ?? "All available data",
    filtersUsed: opts.filtersUsed ?? ["Backend CSV export — no additional filters"],
    executiveSummary: [
      { label: "Total records", value: rows.length },
      ...(statistics
        ? [
            { label: "Numeric sum", value: statistics.subtotal },
            { label: "Average", value: statistics.average },
          ]
        : []),
    ],
    tableColumns: columns,
    tableRows: rows,
    statistics,
    interpretation: `Operational export from ${opts.reportName}. Review tabular and statistical sections for panel evaluation.`,
    analyticsType: "Descriptive",
    filenameStem: opts.filenameStem,
  });
}
