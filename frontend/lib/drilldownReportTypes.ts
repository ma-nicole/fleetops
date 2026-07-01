export type DrillDownModalContext = {
  sectionTitle: string;
  chartType: string;
  chartItems: Array<Record<string, string | number>>;
  valueField?: string;
  analyticsType?: "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive";
  analyticsMethod?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
};
