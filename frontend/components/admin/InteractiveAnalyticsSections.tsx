"use client";

import { useMemo, useState } from "react";
import {
  BarChartPhp,
  FinancialTrendChart,
  LineChartVisual,
  PieChartVisual,
  type ChartClickPayload,
} from "@/components/admin/AnalyticsCharts";
import {
  BiDrillHint,
  ComparativeAnalyticsBlock,
  DrillDownAnalyticsModal,
  PercentageBreakdown,
  type DrillDownModalContext,
} from "@/components/admin/BiAnalyticsComponents";
import { AnalyticsApi, type AdminAnalyticsPayload, type ComparativeMetric } from "@/lib/analyticsApi";
import {
  filterDrilldownRows,
  formatStatusLabel,
  type ChartSelection,
} from "@/lib/chartDrilldownUtils";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatMonthLabel(month: string): string {
  const [, mm] = month.split("-");
  const idx = parseInt(mm, 10) - 1;
  return MONTH_NAMES[idx] ? `${MONTH_NAMES[idx]} ${month.slice(0, 4)}` : month;
}

type FilterOptions = AdminAnalyticsPayload["filter_options"];

function useBiDrillModal(allRows: Record<string, unknown>[]) {
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<DrillDownModalContext | null>(null);

  const openDrill = (sel: ChartSelection, ctx: DrillDownModalContext) => {
    setSelection(sel);
    setModalContext(ctx);
    setModalOpen(true);
  };

  const chartFiltered = useMemo(() => filterDrilldownRows(allRows, selection), [allRows, selection]);

  return {
    selection,
    modalOpen,
    setModalOpen,
    modalContext,
    openDrill,
    chartFiltered,
  };
}

function BiModalShell({
  open,
  onClose,
  selection,
  allRows,
  columns,
  context,
  filterOptions,
}: {
  open: boolean;
  onClose: () => void;
  selection: ChartSelection | null;
  allRows: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  context: DrillDownModalContext | null;
  filterOptions?: FilterOptions;
}) {
  if (!context) return null;
  return (
    <DrillDownAnalyticsModal
      open={open}
      onClose={onClose}
      selection={selection}
      allRows={allRows}
      columns={columns}
      context={context}
      filterOptions={filterOptions}
    />
  );
}

export function ShipmentAnalyticsInteractive({
  data,
  filterOptions,
  comparative,
  percentages,
}: {
  data: {
    status_distribution: { status: string; count: number }[];
    monthly_deliveries: { month: string; count: number }[];
    drilldown: Record<string, unknown>[];
  };
  filterOptions?: FilterOptions;
  comparative?: ComparativeMetric | null;
  percentages?: { label: string; value: number; percentage: number | null }[] | null;
}) {
  const rows = data.drilldown;
  const { selection, modalOpen, setModalOpen, modalContext, openDrill } = useBiDrillModal(rows);
  const [chartSource, setChartSource] = useState<"status" | "month" | null>(null);

  const onStatusClick = (payload: ChartClickPayload) => {
    const status = String(payload.raw.status ?? payload.label);
    setChartSource("status");
    openDrill(
      {
        label: status,
        displayLabel: `${formatStatusLabel(status)} Shipments`,
        fieldKeys: ["delivery_status", "status"],
      },
      {
        sectionTitle: "Shipment / Delivery Analytics",
        chartType: "pie",
        chartItems: data.status_distribution,
        valueField: "count",
      },
    );
  };

  const onMonthClick = (payload: ChartClickPayload) => {
    const month = String(payload.raw.month ?? payload.label);
    setChartSource("month");
    openDrill(
      {
        label: month,
        displayLabel: `Deliveries in ${formatMonthLabel(month)}`,
        fieldKeys: ["scheduled_month"],
        monthKey: month,
      },
      {
        sectionTitle: "Shipment / Delivery Analytics",
        chartType: "line",
        chartItems: data.monthly_deliveries,
        valueField: "count",
      },
    );
  };

  return (
    <>
      <ComparativeAnalyticsBlock title="Delivery volume comparison" metric={comparative} />
      {percentages ? <PercentageBreakdown title="Status share (%)" items={percentages} /> : null}
      <BiDrillHint />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
        <div>
          <p className="chart-block__title">Status distribution</p>
          <PieChartVisual
            items={data.status_distribution}
            labelKey="status"
            valueKey="count"
            onItemClick={onStatusClick}
            selectedLabel={chartSource === "status" ? selection?.label ?? null : null}
          />
        </div>
        <div>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.85rem" }}>Monthly deliveries</p>
          <LineChartVisual
            items={data.monthly_deliveries}
            xKey="month"
            yKey="count"
            onItemClick={onMonthClick}
            selectedLabel={chartSource === "month" ? selection?.label ?? null : null}
          />
        </div>
      </div>
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "booking_id", label: "Booking ID" },
          { key: "trip_id", label: "Trip ID" },
          { key: "date", label: "Date" },
          { key: "customer", label: "Customer" },
          { key: "route", label: "Route" },
          { key: "truck", label: "Truck" },
          { key: "driver", label: "Driver" },
          { key: "helper", label: "Helper" },
          { key: "delivery_status", label: "Status" },
          { key: "revenue_php", label: "Revenue" },
          { key: "expense_php", label: "Expense" },
          { key: "toll_php", label: "Toll" },
          { key: "fuel_php", label: "Fuel" },
          { key: "profit_php", label: "Profit" },
          { key: "delivery_date", label: "Delivery date" },
          { key: "delay_reason", label: "Delay reason" },
        ]}
      />
    </>
  );
}

export function FleetAnalyticsInteractive({
  data,
  filterOptions,
}: {
  data: { truck_usage: Record<string, unknown>[]; drilldown: Record<string, unknown>[] };
  filterOptions?: FilterOptions;
}) {
  const rows = data.drilldown;
  const { selection, modalOpen, setModalOpen, modalContext, openDrill } = useBiDrillModal(rows);

  return (
    <>
      <BiDrillHint />
      <BarChartPhp
        items={data.truck_usage as Array<Record<string, string | number>>}
        labelKey="truck_code"
        valueKey="trip_count"
        formatValue={(v) => String(v)}
        onItemClick={(payload) =>
          openDrill(
            { label: payload.label, displayLabel: `Truck ${payload.label}`, fieldKeys: ["truck_code"] },
            {
              sectionTitle: "Fleet Utilization Analytics",
              chartType: "bar",
              chartItems: data.truck_usage as Array<Record<string, string | number>>,
              valueField: "trip_count",
            },
          )
        }
        selectedLabel={selection?.label ?? null}
      />
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "truck_code", label: "Truck" },
          { key: "trip_count", label: "Trips" },
          { key: "utilization_rate_pct", label: "Utilization %" },
          { key: "fuel_php", label: "Fuel (₱)" },
          { key: "maintenance_events", label: "Maintenance" },
          { key: "assigned_drivers", label: "Drivers" },
        ]}
      />
    </>
  );
}

export function DriverAnalyticsInteractive({
  data,
  filterOptions,
}: {
  data: {
    distribution: { driver_name: string; completed: number; delayed: number }[];
    drilldown: Record<string, unknown>[];
  };
  filterOptions?: FilterOptions;
}) {
  const rows = data.drilldown;
  const { selection, modalOpen, setModalOpen, modalContext, openDrill } = useBiDrillModal(rows);

  return (
    <>
      <BiDrillHint />
      <BarChartPhp
        items={data.distribution}
        labelKey="driver_name"
        valueKey="completed"
        formatValue={(v) => String(v)}
        onItemClick={(payload) =>
          openDrill(
            { label: payload.label, displayLabel: `Driver ${payload.label}`, fieldKeys: ["driver_name", "driver"] },
            {
              sectionTitle: "Driver Performance Analytics",
              chartType: "bar",
              chartItems: data.distribution,
              valueField: "completed",
            },
          )
        }
        selectedLabel={selection?.label ?? null}
      />
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "driver_name", label: "Driver" },
          { key: "deliveries_completed", label: "Completed" },
          { key: "delayed_deliveries", label: "Delayed" },
          { key: "on_time_deliveries", label: "On time" },
          { key: "attendance_records", label: "Attendance" },
          { key: "fuel_php", label: "Fuel (₱)" },
          { key: "total_hours", label: "Hours" },
        ]}
      />
    </>
  );
}

export function RouteAnalyticsInteractive({
  data,
  filterOptions,
}: {
  data: { cost_comparison: Record<string, unknown>[]; drilldown: Record<string, unknown>[] };
  filterOptions?: FilterOptions;
}) {
  const rows = data.drilldown;
  const { selection, modalOpen, setModalOpen, modalContext, openDrill } = useBiDrillModal(rows);

  return (
    <>
      <BiDrillHint />
      <BarChartPhp
        items={data.cost_comparison as Array<Record<string, string | number>>}
        labelKey="route"
        valueKey="total_cost_php"
        onItemClick={(payload) =>
          openDrill(
            {
              label: payload.label,
              displayLabel: `Route ${payload.label.length > 40 ? `${payload.label.slice(0, 40)}…` : payload.label}`,
              fieldKeys: ["route"],
            },
            {
              sectionTitle: "Route Analytics",
              chartType: "bar",
              chartItems: data.cost_comparison as Array<Record<string, string | number>>,
              valueField: "total_cost_php",
            },
          )
        }
        selectedLabel={selection?.label ?? null}
      />
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "route", label: "Route" },
          { key: "deliveries", label: "Deliveries" },
          { key: "delayed_count", label: "Delays" },
          { key: "total_cost_php", label: "Cost (₱)" },
          { key: "fuel_php", label: "Fuel (₱)" },
          { key: "avg_delivery_hours", label: "Avg hrs" },
        ]}
      />
    </>
  );
}

export function ClientAnalyticsInteractive({
  data,
  filterOptions,
}: {
  data: {
    booking_distribution: { client_name: string; bookings: number }[];
    revenue_contribution: { client_name: string; revenue_php: number }[];
    drilldown: Record<string, unknown>[];
  };
  filterOptions?: FilterOptions;
}) {
  const rows = data.drilldown;
  const { selection, modalOpen, setModalOpen, modalContext, openDrill } = useBiDrillModal(rows);
  const [chartSource, setChartSource] = useState<"bookings" | "revenue" | null>(null);

  const onClientClick = (payload: ChartClickPayload, source: "bookings" | "revenue") => {
    setChartSource(source);
    openDrill(
      { label: payload.label, displayLabel: `Client ${payload.label}`, fieldKeys: ["client_name"] },
      {
        sectionTitle: "Client Analytics",
        chartType: "bar",
        chartItems: source === "bookings" ? data.booking_distribution : data.revenue_contribution,
        valueField: source === "bookings" ? "bookings" : "revenue_php",
      },
    );
  };

  return (
    <>
      <BiDrillHint />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
        <div>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.85rem" }}>Booking distribution</p>
          <BarChartPhp
            items={data.booking_distribution}
            labelKey="client_name"
            valueKey="bookings"
            formatValue={(v) => String(v)}
            onItemClick={(p) => onClientClick(p, "bookings")}
            selectedLabel={chartSource === "bookings" ? selection?.label ?? null : null}
          />
        </div>
        <div>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.85rem" }}>Revenue contribution</p>
          <BarChartPhp
            items={data.revenue_contribution}
            labelKey="client_name"
            valueKey="revenue_php"
            onItemClick={(p) => onClientClick(p, "revenue")}
            selectedLabel={chartSource === "revenue" ? selection?.label ?? null : null}
          />
        </div>
      </div>
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "client_name", label: "Client" },
          { key: "total_bookings", label: "Bookings" },
          { key: "deliveries", label: "Deliveries" },
          { key: "revenue_php", label: "Revenue (₱)" },
          { key: "top_destination", label: "Top destination" },
        ]}
      />
    </>
  );
}

export function FinancialAnalyticsInteractive({
  data,
  filterOptions,
  comparative,
  percentages,
}: {
  data: {
    category_summary: { category: string; label: string; amount_php: number }[];
    revenue_trend: { month: string; revenue_php: number; expense_php: number; profit_php: number }[];
    drilldown: Record<string, unknown>[];
  };
  filterOptions?: FilterOptions;
  comparative?: ComparativeMetric | null;
  percentages?: { label: string; value: number; percentage: number | null }[] | null;
}) {
  const rows = data.drilldown;
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<DrillDownModalContext | null>(null);
  const [trendSelection, setTrendSelection] = useState<{
    month: string;
    metric: "revenue" | "expenses" | "profit";
  } | null>(null);

  const openModal = (sel: ChartSelection, ctx: DrillDownModalContext) => {
    setSelection(sel);
    setModalContext(ctx);
    setModalOpen(true);
  };

  return (
    <>
      <ComparativeAnalyticsBlock title="Revenue comparison" metric={comparative} defaultGranularity="yearly" />
      {percentages ? <PercentageBreakdown title="Financial mix (%)" items={percentages} /> : null}
      <BiDrillHint />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
        <div>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.85rem" }}>Summary by category</p>
          <BarChartPhp
            items={data.category_summary}
            labelKey="label"
            valueKey="amount_php"
            onItemClick={(payload) => {
              setTrendSelection(null);
              const category = String(payload.raw.category ?? payload.label).toLowerCase();
              if (category === "profit") {
                openModal(
                  { label: "profit", displayLabel: "Profit (Revenue & Expenses)", fieldKeys: [] },
                  {
                    sectionTitle: "Financial Analytics",
                    chartType: "bar",
                    chartItems: data.category_summary,
                    valueField: "amount_php",
                  },
                );
                return;
              }
              openModal(
                {
                  label: category,
                  displayLabel: category === "revenue" ? "Revenue Records" : "Expense Records",
                  fieldKeys: [],
                  recordType: category === "revenue" ? "revenue" : "expense",
                },
                {
                  sectionTitle: "Financial Analytics",
                  chartType: "bar",
                  chartItems: data.category_summary,
                  valueField: "amount_php",
                },
              );
            }}
            selectedLabel={
              !trendSelection && selection
                ? selection.recordType === "revenue"
                  ? "Revenue"
                  : selection.recordType === "expense"
                    ? "Expenses"
                    : selection.label === "profit"
                      ? "Profit"
                      : selection.label
                : null
            }
          />
        </div>
        <div>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.85rem" }}>Monthly revenue vs expenses</p>
          <FinancialTrendChart
            items={data.revenue_trend}
            selectedMonth={trendSelection?.month ?? null}
            selectedMetric={trendSelection?.metric ?? null}
            onItemClick={({ month, metric }) => {
              setTrendSelection({ month, metric });
              const label =
                metric === "revenue" ? "Revenue" : metric === "expenses" ? "Expenses" : "Profit";
              openModal(
                {
                  label: month,
                  displayLabel: `${label} — ${formatMonthLabel(month)}`,
                  fieldKeys: [],
                  monthKey: month,
                  recordType: metric === "revenue" ? "revenue" : metric === "expenses" ? "expense" : undefined,
                },
                {
                  sectionTitle: "Financial Analytics",
                  chartType: "line",
                  chartItems: data.revenue_trend.map((r) => ({
                    month: r.month,
                    value: metric === "revenue" ? r.revenue_php : metric === "expenses" ? r.expense_php : r.profit_php,
                  })),
                  valueField: "value",
                },
              );
            }}
          />
        </div>
      </div>
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "record_type", label: "Type" },
          { key: "category_label", label: "Category" },
          { key: "date", label: "Date" },
          { key: "amount_php", label: "Amount (₱)" },
          { key: "booking_id", label: "Booking" },
          { key: "trip_id", label: "Trip" },
          { key: "payment_id", label: "Payment" },
          { key: "reference", label: "Reference" },
          { key: "customer", label: "Customer" },
          { key: "client_name", label: "Client" },
          { key: "route", label: "Route" },
          { key: "driver", label: "Driver" },
          { key: "truck", label: "Truck" },
          { key: "status", label: "Status" },
          { key: "revenue_php", label: "Revenue" },
          { key: "expense_php", label: "Expense" },
          { key: "toll_php", label: "Toll" },
          { key: "fuel_php", label: "Fuel" },
          { key: "profit_php", label: "Profit" },
          { key: "expense_date", label: "Expense date" },
          { key: "paid_at", label: "Paid at" },
          { key: "truck_code", label: "Truck" },
          { key: "label", label: "Description" },
        ]}
      />
    </>
  );
}

function useChartInterpretation(
  sectionTitle: string,
  chartType: string,
  chartItems: Array<Record<string, string | number>>,
  selectionLabel: string,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  const explain = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AnalyticsApi.chartInterpretation({
        section_title: sectionTitle,
        selection_label: selectionLabel,
        chart_type: chartType,
        items: chartItems,
        record_count: chartItems.length,
      });
      setText(res.interpretation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Interpretation unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, text, explain };
}

function JobsGranularityControls({
  granularity,
  setGranularity,
}: {
  granularity: "monthly" | "quarterly" | "yearly";
  setGranularity: (v: "monthly" | "quarterly" | "yearly") => void;
}) {
  return (
    <div className="tab-pills" style={{ marginBottom: "0.5rem" }}>
      {(["monthly", "quarterly", "yearly"] as const).map((g) => (
        <button
          key={g}
          type="button"
          className={`tab-pill${granularity === g ? " tab-pill--active" : ""}`}
          onClick={() => setGranularity(g)}
        >
          {g.charAt(0).toUpperCase() + g.slice(1)}
        </button>
      ))}
    </div>
  );
}

export function RevenueTrackingInteractive({
  trend,
  drilldown,
  comparative,
  filterOptions,
}: {
  trend: { month: string; revenue_php: number }[];
  drilldown: Record<string, unknown>[];
  comparative?: ComparativeMetric | null;
  filterOptions?: FilterOptions;
}) {
  const rows = drilldown;
  const { selection, modalOpen, setModalOpen, modalContext, openDrill } = useBiDrillModal(rows);
  const chartItems = trend.map((x) => ({ month: x.month, value: x.revenue_php }));
  const ai = useChartInterpretation("Revenue Tracking", "line", chartItems, "Monthly Revenue");
  const [showCompare, setShowCompare] = useState(false);

  return (
    <>
      <BiDrillHint />
      <LineChartVisual
        items={chartItems}
        xKey="month"
        yKey="value"
        onItemClick={(payload) =>
          openDrill(
            {
              label: payload.label,
              displayLabel: `Revenue Tracking • ${formatMonthLabel(payload.label)}`,
              fieldKeys: ["month"],
              monthKey: payload.label,
              recordType: "revenue",
            },
            {
              sectionTitle: "Revenue Tracking",
              chartType: "line",
              chartItems,
              valueField: "value",
            },
          )
        }
        selectedLabel={selection?.label ?? null}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" className="quick-action-btn" onClick={() => void ai.explain()} disabled={ai.loading}>
          {ai.loading ? "Generating…" : "Explain this Chart with AI"}
        </button>
        <button type="button" className="quick-action-btn" onClick={() => setShowCompare((v) => !v)}>
          Compare Revenue YoY
        </button>
      </div>
      {ai.error ? <p className="bi-drilldown-empty">{ai.error}</p> : null}
      {ai.text ? <p className="bi-drilldown-interpretation" style={{ marginTop: "0.5rem" }}>{ai.text}</p> : null}
      {showCompare ? <ComparativeAnalyticsBlock title="Revenue YoY comparison" metric={comparative} defaultGranularity="yearly" /> : null}
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "booking_id", label: "Booking ID" },
          { key: "trip_id", label: "Trip ID" },
          { key: "date", label: "Date" },
          { key: "customer", label: "Customer" },
          { key: "route", label: "Route" },
          { key: "driver", label: "Driver" },
          { key: "truck", label: "Truck" },
          { key: "status", label: "Status" },
          { key: "revenue_php", label: "Revenue" },
          { key: "expense_php", label: "Expense" },
          { key: "toll_php", label: "Toll" },
          { key: "fuel_php", label: "Fuel" },
          { key: "profit_php", label: "Profit" },
        ]}
      />
    </>
  );
}

export function RevenueExpenseHistoricalInteractive({
  trend,
  drilldown,
  comparative,
  filterOptions,
}: {
  trend: { month: string; revenue_php: number; expense_php: number; profit_php: number }[];
  drilldown: Record<string, unknown>[];
  comparative?: ComparativeMetric | null;
  filterOptions?: FilterOptions;
}) {
  const rows = drilldown;
  const { selection, modalOpen, setModalOpen, modalContext, openDrill } = useBiDrillModal(rows);
  const [showCompare, setShowCompare] = useState(false);
  const ai = useChartInterpretation(
    "Revenue vs Expense Historical",
    "line",
    trend.map((x) => ({ month: x.month, revenue_php: x.revenue_php, expense_php: x.expense_php })),
    "Revenue vs Expense",
  );
  const chartItems = trend.map((x) => ({ month: x.month, value: x.revenue_php - x.expense_php }));

  return (
    <>
      <BiDrillHint />
      <FinancialTrendChart
        items={trend}
        onItemClick={({ month }) =>
          openDrill(
            { label: month, displayLabel: `Revenue vs Expense • ${formatMonthLabel(month)}`, fieldKeys: ["month"], monthKey: month },
            { sectionTitle: "Revenue vs Expense Historical", chartType: "line", chartItems, valueField: "value" },
          )
        }
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" className="quick-action-btn" onClick={() => void ai.explain()} disabled={ai.loading}>
          {ai.loading ? "Generating…" : "Explain this Chart with AI"}
        </button>
        <button type="button" className="quick-action-btn" onClick={() => setShowCompare((v) => !v)}>
          Compare Expense YoY
        </button>
      </div>
      {ai.error ? <p className="bi-drilldown-empty">{ai.error}</p> : null}
      {ai.text ? <p className="bi-drilldown-interpretation" style={{ marginTop: "0.5rem" }}>{ai.text}</p> : null}
      {showCompare ? <ComparativeAnalyticsBlock title="Expense YoY comparison" metric={comparative} defaultGranularity="yearly" /> : null}
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "booking_id", label: "Booking ID" },
          { key: "trip_id", label: "Trip ID" },
          { key: "date", label: "Date" },
          { key: "customer", label: "Customer" },
          { key: "route", label: "Route" },
          { key: "driver", label: "Driver" },
          { key: "truck", label: "Truck" },
          { key: "status", label: "Status" },
          { key: "revenue_php", label: "Revenue" },
          { key: "expense_php", label: "Expense" },
          { key: "toll_php", label: "Toll" },
          { key: "fuel_php", label: "Fuel" },
          { key: "profit_php", label: "Profit" },
        ]}
      />
    </>
  );
}

export function ProfitMarginHistoricalInteractive({
  trend,
  drilldown,
  comparative,
  filterOptions,
}: {
  trend: { month: string; revenue_php: number; expense_php: number; profit_php: number }[];
  drilldown: Record<string, unknown>[];
  comparative?: ComparativeMetric | null;
  filterOptions?: FilterOptions;
}) {
  const rows = drilldown;
  const [showCompare, setShowCompare] = useState(false);
  const marginTrend = trend.map((x) => ({
    month: x.month,
    value: x.revenue_php > 0 ? Number((((x.profit_php / x.revenue_php) * 100).toFixed(2))) : 0,
  }));
  const { selection, modalOpen, setModalOpen, modalContext, openDrill } = useBiDrillModal(rows);
  const ai = useChartInterpretation("Profit & Margin Historical", "line", marginTrend, "Profit Margin");

  return (
    <>
      <BiDrillHint />
      <LineChartVisual
        items={marginTrend}
        xKey="month"
        yKey="value"
        onItemClick={(payload) =>
          openDrill(
            {
              label: payload.label,
              displayLabel: `Profit & Margin • ${formatMonthLabel(payload.label)}`,
              fieldKeys: ["month"],
              monthKey: payload.label,
            },
            { sectionTitle: "Profit & Margin Historical", chartType: "line", chartItems: marginTrend, valueField: "value" },
          )
        }
        selectedLabel={selection?.label ?? null}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" className="quick-action-btn" onClick={() => void ai.explain()} disabled={ai.loading}>
          {ai.loading ? "Generating…" : "Explain this Chart with AI"}
        </button>
        <button type="button" className="quick-action-btn" onClick={() => setShowCompare((v) => !v)}>
          Compare Profit Margin YoY
        </button>
      </div>
      {ai.error ? <p className="bi-drilldown-empty">{ai.error}</p> : null}
      {ai.text ? <p className="bi-drilldown-interpretation" style={{ marginTop: "0.5rem" }}>{ai.text}</p> : null}
      {showCompare ? <ComparativeAnalyticsBlock title="Profit Margin YoY comparison" metric={comparative} defaultGranularity="yearly" /> : null}
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "booking_id", label: "Booking ID" },
          { key: "trip_id", label: "Trip ID" },
          { key: "date", label: "Date" },
          { key: "customer", label: "Customer" },
          { key: "route", label: "Route" },
          { key: "driver", label: "Driver" },
          { key: "truck", label: "Truck" },
          { key: "status", label: "Status" },
          { key: "revenue_php", label: "Revenue" },
          { key: "expense_php", label: "Expense" },
          { key: "profit_php", label: "Profit" },
        ]}
      />
    </>
  );
}

export function JobsTripsOverTimeInteractive({
  jobs,
  drilldown,
  comparative,
  filterOptions,
}: {
  jobs: { month: string; count: number }[];
  drilldown: Record<string, unknown>[];
  comparative?: ComparativeMetric | null;
  filterOptions?: FilterOptions;
}) {
  const rows = drilldown;
  const [granularity, setGranularity] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [showCompare, setShowCompare] = useState(false);
  const { selection, modalOpen, setModalOpen, modalContext, openDrill } = useBiDrillModal(rows);

  const rolled = useMemo(() => {
    if (granularity === "monthly") return jobs;
    const buckets = new Map<string, number>();
    for (const row of jobs) {
      const [yy, mm] = row.month.split("-");
      const key =
        granularity === "yearly"
          ? yy
          : `${yy}-Q${Math.floor((Math.max(1, Number(mm)) - 1) / 3) + 1}`;
      buckets.set(key, (buckets.get(key) ?? 0) + row.count);
    }
    return [...buckets.entries()].map(([month, count]) => ({ month, count }));
  }, [jobs, granularity]);

  const ai = useChartInterpretation("Jobs / Trips Over Time", "bar", rolled.map((x) => ({ ...x, value: x.count })), "Jobs Over Time");

  return (
    <>
      <BiDrillHint />
      <JobsGranularityControls granularity={granularity} setGranularity={setGranularity} />
      <LineChartVisual
        items={rolled.map((x) => ({ ...x, value: x.count }))}
        xKey="month"
        yKey="value"
        onItemClick={(payload) =>
          openDrill(
            {
              label: payload.label,
              displayLabel: `Jobs / Trips Over Time • ${payload.label}`,
              fieldKeys: ["scheduled_month", "month"],
              monthKey: granularity === "monthly" ? payload.label : undefined,
            },
            {
              sectionTitle: "Jobs / Trips Over Time",
              chartType: "line",
              chartItems: rolled.map((x) => ({ month: x.month, value: x.count })),
              valueField: "value",
            },
          )
        }
        selectedLabel={selection?.label ?? null}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" className="quick-action-btn" onClick={() => void ai.explain()} disabled={ai.loading}>
          {ai.loading ? "Generating…" : "Explain this Chart with AI"}
        </button>
        <button type="button" className="quick-action-btn" onClick={() => setShowCompare((v) => !v)}>
          Compare Jobs YoY
        </button>
      </div>
      {ai.error ? <p className="bi-drilldown-empty">{ai.error}</p> : null}
      {ai.text ? <p className="bi-drilldown-interpretation" style={{ marginTop: "0.5rem" }}>{ai.text}</p> : null}
      {showCompare ? <ComparativeAnalyticsBlock title="Jobs YoY comparison" metric={comparative} defaultGranularity="yearly" /> : null}
      <BiModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={rows}
        filterOptions={filterOptions}
        context={modalContext}
        columns={[
          { key: "booking_id", label: "Booking ID" },
          { key: "trip_id", label: "Trip ID" },
          { key: "date", label: "Date" },
          { key: "customer", label: "Customer" },
          { key: "route", label: "Route" },
          { key: "driver", label: "Driver" },
          { key: "truck", label: "Truck" },
          { key: "status", label: "Status" },
        ]}
      />
    </>
  );
}
