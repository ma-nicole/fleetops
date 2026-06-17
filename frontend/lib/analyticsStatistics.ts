import type { StatisticsSummary } from "@/lib/analyticsApi";

const NUMERIC_FIELD_PRIORITY = [
  "amount_php",
  "revenue_php",
  "total_cost_php",
  "fuel_php",
  "trip_count",
  "count",
  "deliveries_completed",
  "deliveries",
  "total_bookings",
  "bookings",
  "utilization_rate_pct",
  "total_hours",
  "distance_km",
];

export function extractNumericValues(
  rows: Record<string, unknown>[],
  preferFields?: string[],
): number[] {
  if (!rows.length) return [];
  const fields = preferFields?.length
    ? preferFields
    : NUMERIC_FIELD_PRIORITY.filter((f) => f in rows[0]);
  const fallback = Object.keys(rows[0]).filter((k) => typeof rows[0][k] === "number");
  const candidates = fields.length ? fields : fallback;
  const values: number[] = [];
  for (const row of rows) {
    for (const field of candidates) {
      const raw = row[field];
      if (typeof raw === "number" && Number.isFinite(raw)) {
        values.push(raw);
        break;
      }
      if (typeof raw === "string" && raw !== "—" && !Number.isNaN(Number(raw))) {
        values.push(Number(raw));
        break;
      }
    }
  }
  return values;
}

export function computeRowStatistics(
  rows: Record<string, unknown>[],
  preferFields?: string[],
): StatisticsSummary | null {
  const values = extractNumericValues(rows, preferFields);
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const subtotal = sorted.reduce((s, v) => s + v, 0);
  const avg = subtotal / n;
  const median = n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  let stdDev: number | null = null;
  if (n >= 2) {
    const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
    stdDev = Math.round(Math.sqrt(variance) * 100) / 100;
  }
  return {
    minimum: round2(sorted[0]),
    maximum: round2(sorted[n - 1]),
    average: round2(avg),
    median: round2(median),
    subtotal: round2(subtotal),
    standard_deviation: stdDev,
    count: n,
    insufficient_for_spread: n < 2,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type PanelFilters = {
  dateFrom: string;
  dateTo: string;
  route: string;
  driverId: string;
  truckId: string;
  clientId: string;
  status: string;
};

export const EMPTY_PANEL_FILTERS: PanelFilters = {
  dateFrom: "",
  dateTo: "",
  route: "",
  driverId: "",
  truckId: "",
  clientId: "",
  status: "",
};

export function applyPanelFilters(
  rows: Record<string, unknown>[],
  filters: PanelFilters,
  filterOptions?: {
    drivers?: { id: number; name: string }[];
    trucks?: { id: number; code: string }[];
    clients?: { id: number; name: string }[];
  },
): Record<string, unknown>[] {
  return rows.filter((row) => {
    const dateFields = ["delivery_date", "expense_date", "paid_at", "date", "scheduled_date"];
    if (filters.dateFrom || filters.dateTo) {
      const rawDate = dateFields.map((f) => row[f]).find((v) => v != null);
      if (rawDate) {
        const d = String(rawDate).slice(0, 10);
        if (filters.dateFrom && d < filters.dateFrom) return false;
        if (filters.dateTo && d > filters.dateTo) return false;
      }
    }
    if (filters.route && String(row.route ?? "") !== filters.route) return false;
    if (filters.status) {
      const st = String(row.delivery_status ?? row.status ?? "").toLowerCase();
      if (st !== filters.status.toLowerCase()) return false;
    }
    if (filters.driverId) {
      const driver = filterOptions?.drivers?.find((d) => String(d.id) === filters.driverId);
      const name = driver?.name ?? "";
      const rowDriver = String(row.driver ?? row.driver_name ?? "");
      if (rowDriver !== name && String(row.driver_id ?? "") !== filters.driverId) return false;
    }
    if (filters.truckId) {
      const truck = filterOptions?.trucks?.find((t) => String(t.id) === filters.truckId);
      const code = truck?.code ?? "";
      const rowTruck = String(row.truck ?? row.truck_code ?? "");
      if (rowTruck !== code && String(row.truck_id ?? "") !== filters.truckId) return false;
    }
    if (filters.clientId) {
      const client = filterOptions?.clients?.find((c) => String(c.id) === filters.clientId);
      const name = client?.name ?? "";
      const rowClient = String(row.customer ?? row.client_name ?? "");
      if (rowClient !== name && String(row.customer_id ?? "") !== filters.clientId) return false;
    }
    return true;
  });
}
