import { jsPDF } from "jspdf";
import type { StatisticsSummary } from "@/lib/analyticsApi";
import type { ReportExportContext } from "./reportExportContext";

export type ReportTableColumn = { key: string; label: string };

export type ReportIndicator = {
  label: string;
  value: string | number;
  interpretation?: string;
};

export type ChartSnapshotItem = Record<string, string | number>;

export type ChartSnapshot = {
  chartType: string;
  title: string;
  items: ChartSnapshotItem[];
  valueField?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  /** PNG/JPEG data URL from live chart capture (preferred over redraw). */
  imageDataUrl?: string | null;
};

export type PredictiveAnalyticsBlock = {
  modelUsed?: string;
  regressionEquation?: string;
  forecastingMethod?: string;
  confidenceLevel?: string;
  rSquared?: string | number;
  mae?: string | number;
  rmse?: string | number;
  mape?: string | number;
  prediction?: string;
  interpretation?: string;
  trend?: string;
};

export type ProfessionalReportPayload = {
  context: ReportExportContext;
  reportPeriod?: string;
  filtersUsed: string[];
  executiveSummary: ReportIndicator[];
  tableColumns: ReportTableColumn[];
  tableRows: Record<string, unknown>[];
  statistics?: StatisticsSummary | null;
  indicators?: ReportIndicator[];
  /** @deprecated Prefer `charts` — kept for callers that still pass a single snapshot. */
  chartSnapshot?: ChartSnapshot;
  charts?: ChartSnapshot[];
  interpretation?: string | null;
  predictive?: PredictiveAnalyticsBlock | null;
  analyticsType?: string;
  chartType?: string;
  filenameStem: string;
};

/** A4 portrait; ~20mm margins. */
const MARGIN = 20;
const PAGE_BOTTOM = 277;
const FOOTER_Y = 287;

type MutableY = { y: number };

type PdfWriter = {
  doc: jsPDF;
  state: MutableY;
  pageW: number;
  contentW: number;
  ensureSpace: (mm: number) => void;
  heading: (text: string) => void;
  subheading: (text: string) => void;
  paragraph: (text: string, size?: number) => void;
  bulletList: (items: string[]) => void;
  keyValue: (label: string, value: string) => void;
};

function createWriter(doc: jsPDF): PdfWriter {
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;
  const state: MutableY = { y: MARGIN + 2 };

  const ensureSpace = (neededMm: number) => {
    if (state.y + neededMm > PAGE_BOTTOM) {
      doc.addPage();
      state.y = MARGIN + 2;
    }
  };

  const heading = (text: string) => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(25, 25, 25);
    doc.text(text, MARGIN, state.y);
    state.y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, state.y - 4, pageW - MARGIN, state.y - 4);
    state.y += 2;
  };

  const subheading = (text: string) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(text, MARGIN, state.y);
    state.y += 7;
  };

  const paragraph = (text: string, size = 9) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    ensureSpace(lines.length * 4.4 + 4);
    doc.text(lines, MARGIN, state.y);
    state.y += lines.length * 4.4 + 3;
  };

  const bulletList = (items: string[]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    for (const item of items) {
      const lines = doc.splitTextToSize(`• ${item}`, contentW - 3) as string[];
      ensureSpace(lines.length * 4.3 + 2);
      doc.text(lines, MARGIN + 2, state.y);
      state.y += lines.length * 4.3 + 1.5;
    }
    state.y += 2;
  };

  const keyValue = (label: string, value: string) => {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(35, 35, 35);
    const labelText = `${label}:`;
    doc.text(labelText, MARGIN, state.y);
    const labelW = doc.getTextWidth(labelText);
    doc.setFont("helvetica", "normal");
    const valueLines = doc.splitTextToSize(value || "—", contentW - labelW - 4) as string[];
    doc.text(valueLines, MARGIN + labelW + 3, state.y);
    state.y += Math.max(valueLines.length * 4.5, 5) + 1.5;
  };

  return { doc, state, pageW, contentW, ensureSpace, heading, subheading, paragraph, bulletList, keyValue };
}

function formatPhpCell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value) && Math.abs(value) < 1000) return String(value);
    return value.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  const s = String(value);
  const n = Number(s.replace(/,/g, ""));
  if (s !== "" && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(s.replace(/,/g, ""))) {
    return n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return s;
}

function formatCell(value: unknown, key: string): string {
  if (value == null || value === "") return "—";
  const k = key.toLowerCase();
  if (k.includes("date") || k.includes("_at") || k.endsWith("at")) {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
    }
  }
  if (
    k.includes("cost") ||
    k.includes("amount") ||
    k.includes("php") ||
    k.includes("revenue") ||
    k.includes("price") ||
    k.includes("toll") ||
    k.includes("fee")
  ) {
    return formatPhpCell(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function writeStandardHeader(w: PdfWriter, payload: ProfessionalReportPayload) {
  const { context, reportPeriod, filtersUsed } = payload;
  const generated = context.generatedAt;
  const dateStr = generated.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = generated.toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  w.doc.setFont("helvetica", "bold");
  w.doc.setFontSize(15);
  w.doc.setTextColor(15, 15, 15);
  w.doc.text(context.systemName, MARGIN, w.state.y);

  // Brand mark (company logo placeholder when no image asset is bundled)
  const markW = 28;
  const markH = 10;
  const markX = w.pageW - MARGIN - markW;
  const markY = w.state.y - 6;
  w.doc.setFillColor(30, 64, 55);
  w.doc.roundedRect(markX, markY, markW, markH, 1.5, 1.5, "F");
  w.doc.setFont("helvetica", "bold");
  w.doc.setFontSize(7);
  w.doc.setTextColor(255, 255, 255);
  w.doc.text("FleetOpt", markX + markW / 2, markY + 6.2, { align: "center" });
  w.state.y += 7;

  w.doc.setFont("helvetica", "bold");
  w.doc.setFontSize(12);
  w.doc.setTextColor(30, 30, 30);
  const titleLines = w.doc.splitTextToSize(context.reportName, w.contentW) as string[];
  w.doc.text(titleLines, MARGIN, w.state.y);
  w.state.y += titleLines.length * 5.5 + 3;

  w.doc.setDrawColor(60, 60, 60);
  w.doc.setLineWidth(0.5);
  w.doc.line(MARGIN, w.state.y, w.pageW - MARGIN, w.state.y);
  w.state.y += 7;

  w.keyValue("Module", context.moduleName);
  w.keyValue("Generated by", context.generatedBy);
  w.keyValue("Role", context.userRole);
  w.keyValue("Generated date", dateStr);
  w.keyValue("Generated time", timeStr);
  w.keyValue("Report period", reportPeriod ?? "All available data");
  w.keyValue("System version", context.systemVersion);
  if (payload.analyticsType) w.keyValue("Analytics type", payload.analyticsType);
  if (payload.chartType) w.keyValue("Primary chart type", payload.chartType);
  const filterPreview = (filtersUsed ?? []).slice(0, 6).join("; ") || "No additional filters applied.";
  w.keyValue("Filters used", filterPreview);

  w.state.y += 2;
  w.doc.setDrawColor(210, 210, 210);
  w.doc.setLineWidth(0.3);
  w.doc.line(MARGIN, w.state.y, w.pageW - MARGIN, w.state.y);
  w.state.y += 8;
}

function writeExecutiveSummary(w: PdfWriter, items: ReportIndicator[], payload: ProfessionalReportPayload) {
  w.heading("Section 1 — Executive Summary");
  if (!items.length) {
    w.paragraph("No summary metrics available for this export.");
    return;
  }
  for (const item of items) {
    w.keyValue(item.label, String(item.value));
    if (item.interpretation) w.paragraph(item.interpretation, 8);
  }
  if (payload.predictive?.rSquared != null) {
    w.keyValue("R² value", String(payload.predictive.rSquared));
  }
  if (payload.predictive?.forecastingMethod) {
    w.keyValue("Forecast method", payload.predictive.forecastingMethod);
  }
  if (payload.chartType || payload.charts?.[0]?.chartType || payload.chartSnapshot?.chartType) {
    w.keyValue(
      "Chart type",
      payload.chartType ||
        payload.charts?.[0]?.chartType ||
        payload.chartSnapshot?.chartType ||
        "—",
    );
  }
  if (payload.analyticsType) w.keyValue("Analytics type", payload.analyticsType);
  w.state.y += 2;
}

function writeFiltersSection(w: PdfWriter, filters: string[]) {
  w.heading("Section 2 — Filters Used");
  w.bulletList(filters.length ? filters : ["No additional filters applied."]);
}

function numericFromItem(item: ChartSnapshotItem, valueField?: string): number {
  const keys = valueField
    ? [valueField]
    : ["value", "amount_php", "count", "revenue_php", "total_cost_php", "actual_toll_php"];
  for (const k of keys) {
    const n = Number(item[k]);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function labelFromItem(item: ChartSnapshotItem): string {
  const keys = ["label", "status", "client_name", "truck_code", "driver_name", "route", "month", "period"];
  for (const k of keys) {
    if (item[k] != null && String(item[k]).trim()) return String(item[k]).slice(0, 28);
  }
  return "Item";
}

function writeChartPage(w: PdfWriter, snapshot: ChartSnapshot, index: number, total: number) {
  w.doc.addPage();
  w.state.y = MARGIN + 2;
  w.heading(`Section 3 — Chart${total > 1 ? ` ${index + 1} of ${total}` : ""}`);
  w.paragraph(`${snapshot.title} (${snapshot.chartType.toUpperCase()})`);
  if (snapshot.xAxisLabel) w.keyValue("X-axis", snapshot.xAxisLabel);
  if (snapshot.yAxisLabel) w.keyValue("Y-axis", snapshot.yAxisLabel);

  if (snapshot.imageDataUrl) {
    try {
      const imgW = Math.min(w.contentW, 160);
      const imgH = imgW * 0.55;
      w.ensureSpace(imgH + 10);
      const x = MARGIN + (w.contentW - imgW) / 2;
      w.doc.setFillColor(255, 255, 255);
      w.doc.rect(x - 2, w.state.y - 2, imgW + 4, imgH + 4, "F");
      const format = snapshot.imageDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
      w.doc.addImage(snapshot.imageDataUrl, format, x, w.state.y, imgW, imgH);
      w.state.y += imgH + 8;
      return;
    } catch {
      w.paragraph("Chart image could not be embedded; drawing data bars instead.", 8);
    }
  }

  const items = snapshot.items.slice(0, 16);
  if (!items.length) {
    w.paragraph("No chart data points available.");
    return;
  }

  const values = items.map((it) => numericFromItem(it, snapshot.valueField));
  const maxVal = Math.max(...values, 1);
  const chartLeft = MARGIN + 48;
  const barMaxW = w.pageW - chartLeft - MARGIN - 28;
  const barH = 5;
  const blockH = items.length * (barH + 3.5) + 12;
  w.ensureSpace(blockH);

  // White chart background
  w.doc.setFillColor(255, 255, 255);
  w.doc.setDrawColor(220, 220, 220);
  w.doc.rect(MARGIN, w.state.y - 4, w.contentW, blockH, "FD");

  items.forEach((item, idx) => {
    const label = labelFromItem(item);
    const val = values[idx];
    const barW = Math.max(1, (val / maxVal) * barMaxW);
    w.doc.setFont("helvetica", "normal");
    w.doc.setFontSize(7.5);
    w.doc.setTextColor(40, 40, 40);
    w.doc.text(label, MARGIN + 3, w.state.y + 2);
    const barY = w.state.y - 2.5;
    w.doc.setFillColor(46, 125, 90);
    w.doc.rect(chartLeft, barY, barW, barH, "F");
    w.doc.setTextColor(50, 50, 50);
    w.doc.text(formatPhpCell(val), chartLeft + barW + 2, w.state.y + 2);
    w.state.y += barH + 3.5;
  });
  w.state.y += 6;
}

function writeAllCharts(w: PdfWriter, charts: ChartSnapshot[]) {
  if (!charts.length) {
    w.heading("Section 3 — Charts");
    w.paragraph("No chart data was available for this export.");
    return;
  }
  charts.forEach((c, i) => writeChartPage(w, c, i, charts.length));
}

function writeStatistics(w: PdfWriter, stats: StatisticsSummary | null | undefined, predictive?: PredictiveAnalyticsBlock | null) {
  w.heading("Section 4 — Statistical Summary");
  if (!stats && !predictive) {
    w.paragraph("Insufficient numeric data for statistical analysis.");
    return;
  }

  // Simple 2-column table
  const rows: [string, string][] = [];
  if (stats) {
    rows.push(
      ["Count", String(stats.count)],
      ["Minimum", formatPhpCell(stats.minimum)],
      ["Maximum", formatPhpCell(stats.maximum)],
      ["Average", formatPhpCell(stats.average)],
      ["Median", formatPhpCell(stats.median)],
      ["Total / Sum", formatPhpCell(stats.subtotal)],
    );
    if (stats.standard_deviation != null) {
      rows.push(
        ["Standard deviation", formatPhpCell(stats.standard_deviation)],
        ["Variance", formatPhpCell(stats.standard_deviation ** 2)],
      );
    }
    if (stats.insufficient_for_spread) {
      rows.push(["Note", "Spread metrics require at least two numeric observations."]);
    }
  }
  if (predictive) {
    if (predictive.rSquared != null) rows.push(["R²", String(predictive.rSquared)]);
    if (predictive.mae != null) rows.push(["MAE", String(predictive.mae)]);
    if (predictive.rmse != null) rows.push(["RMSE", String(predictive.rmse)]);
    if (predictive.mape != null) rows.push(["MAPE", String(predictive.mape)]);
    if (predictive.confidenceLevel) rows.push(["Confidence", predictive.confidenceLevel]);
    if (predictive.trend) rows.push(["Trend", predictive.trend]);
    if (predictive.forecastingMethod) rows.push(["Forecast method", predictive.forecastingMethod]);
    if (predictive.modelUsed) rows.push(["Model", predictive.modelUsed]);
  }

  const col1 = 55;
  const col2 = w.contentW - col1;
  for (let i = 0; i < rows.length; i++) {
    w.ensureSpace(8);
    const [label, value] = rows[i];
    if (i % 2 === 0) {
      w.doc.setFillColor(245, 247, 250);
      w.doc.rect(MARGIN, w.state.y - 3.5, w.contentW, 7, "F");
    }
    w.doc.setDrawColor(220, 220, 220);
    w.doc.rect(MARGIN, w.state.y - 3.5, w.contentW, 7, "S");
    w.doc.setFont("helvetica", "bold");
    w.doc.setFontSize(8);
    w.doc.setTextColor(40, 40, 40);
    w.doc.text(label, MARGIN + 2, w.state.y);
    w.doc.setFont("helvetica", "normal");
    const vLines = w.doc.splitTextToSize(value, col2 - 4) as string[];
    w.doc.text(vLines[0] ?? "—", MARGIN + col1 + 2, w.state.y);
    w.state.y += 7;
  }
  w.state.y += 4;
}

function writeDataTable(w: PdfWriter, columns: ReportTableColumn[], rows: Record<string, unknown>[]) {
  w.heading("Section 5 — Data Table");
  w.paragraph(`Total records: ${rows.length}`);

  if (!rows.length || !columns.length) {
    w.paragraph("No tabular data available for this report.");
    return;
  }

  const maxCols = Math.min(columns.length, 7);
  const usableCols = columns.slice(0, maxCols);
  const colW = w.contentW / usableCols.length;
  const fontSize = usableCols.length > 5 ? 6.5 : 7.5;
  const rowMinH = 6;

  const drawHeader = () => {
    w.ensureSpace(10);
    w.doc.setFillColor(35, 55, 70);
    w.doc.rect(MARGIN, w.state.y - 4, w.contentW, 8, "F");
    w.doc.setFont("helvetica", "bold");
    w.doc.setFontSize(fontSize);
    w.doc.setTextColor(255, 255, 255);
    usableCols.forEach((col, i) => {
      const cell = w.doc.splitTextToSize(col.label, colW - 2) as string[];
      w.doc.text(cell[0] ?? col.label, MARGIN + i * colW + 1, w.state.y);
    });
    w.state.y += 7;
  };

  drawHeader();

  for (let ri = 0; ri < rows.length; ri++) {
    const cellLines = usableCols.map((col) => {
      const raw = formatCell(rows[ri][col.key], col.key);
      return w.doc.splitTextToSize(raw, colW - 2) as string[];
    });
    const lineCount = Math.max(1, ...cellLines.map((l) => l.length));
    const rowH = Math.max(rowMinH, lineCount * 3.6 + 2);

    if (w.state.y + rowH > PAGE_BOTTOM) {
      w.doc.addPage();
      w.state.y = MARGIN + 2;
      drawHeader();
    }

    if (ri % 2 === 0) {
      w.doc.setFillColor(248, 250, 252);
      w.doc.rect(MARGIN, w.state.y - 3.5, w.contentW, rowH, "F");
    }
    w.doc.setDrawColor(225, 225, 225);
    w.doc.rect(MARGIN, w.state.y - 3.5, w.contentW, rowH, "S");

    w.doc.setFont("helvetica", "normal");
    w.doc.setFontSize(fontSize);
    w.doc.setTextColor(35, 35, 35);
    usableCols.forEach((_, i) => {
      const lines = cellLines[i];
      w.doc.text(lines, MARGIN + i * colW + 1, w.state.y);
    });
    w.state.y += rowH;
  }

  if (columns.length > maxCols) {
    w.paragraph(
      `Note: ${columns.length - maxCols} additional column(s) are summarized in prior sections; PDF layout shows the primary ${maxCols} columns for readability.`,
      7.5,
    );
  }
  w.state.y += 3;
}

function writeAiInterpretation(
  w: PdfWriter,
  interpretation: string | null | undefined,
  analyticsType?: string,
  indicators?: ReportIndicator[],
  predictive?: PredictiveAnalyticsBlock | null,
) {
  w.heading("Section 6 — AI Interpretation");
  if (analyticsType) w.keyValue("Analytics type", analyticsType);

  if (indicators?.length) {
    w.subheading("Indicators");
    for (const ind of indicators) {
      w.keyValue(ind.label, String(ind.value));
      if (ind.interpretation) w.paragraph(ind.interpretation, 8);
    }
  }

  if (predictive) {
    w.subheading("Regression and forecast results");
    if (predictive.modelUsed) w.keyValue("Model", predictive.modelUsed);
    if (predictive.regressionEquation) w.keyValue("Regression equation", predictive.regressionEquation);
    if (predictive.forecastingMethod) w.keyValue("Forecast method", predictive.forecastingMethod);
    if (predictive.rSquared != null) w.keyValue("R²", String(predictive.rSquared));
    if (predictive.prediction) w.keyValue("Prediction", predictive.prediction);
    if (predictive.confidenceLevel) w.keyValue("Confidence", predictive.confidenceLevel);
    if (predictive.trend) w.keyValue("Trend", predictive.trend);
    if (predictive.interpretation) w.paragraph(predictive.interpretation);
  }

  w.subheading("Interpretation and recommendations");
  if (interpretation?.trim()) {
    w.paragraph(interpretation);
  } else {
    w.paragraph(
      "No AI interpretation was generated for this export. Use the executive summary, statistical summary, and data table for operational review.",
    );
  }
}

function writeFooters(doc: jsPDF, context: ReportExportContext) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, FOOTER_Y - 4, doc.internal.pageSize.getWidth() - MARGIN, FOOTER_Y - 4);
    const left = `${context.systemName} · v${context.systemVersion}`;
    const right = `Page ${p} of ${pages}`;
    doc.text(left, MARGIN, FOOTER_Y);
    doc.text(right, doc.internal.pageSize.getWidth() - MARGIN, FOOTER_Y, { align: "right" });
  }
}

function collectCharts(payload: ProfessionalReportPayload): ChartSnapshot[] {
  if (payload.charts?.length) return payload.charts.filter((c) => c && (c.items?.length || c.imageDataUrl));
  if (payload.chartSnapshot) return [payload.chartSnapshot];
  return [];
}

export function downloadProfessionalReportPdf(payload: ProfessionalReportPayload): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const w = createWriter(doc);
  const charts = collectCharts(payload);

  writeStandardHeader(w, payload);
  writeExecutiveSummary(w, payload.executiveSummary, payload);
  writeFiltersSection(w, payload.filtersUsed);
  writeAllCharts(w, charts);

  // Stats and table continue on a fresh flow after charts (charts already used new pages)
  if (charts.length) {
    w.doc.addPage();
    w.state.y = MARGIN + 2;
  }
  writeStatistics(w, payload.statistics, payload.predictive);
  writeDataTable(w, payload.tableColumns, payload.tableRows);
  writeAiInterpretation(w, payload.interpretation, payload.analyticsType, payload.indicators, payload.predictive);

  writeFooters(doc, payload.context);

  const stem = payload.filenameStem.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  doc.save(`fleetopt-${stem}.pdf`);
}
