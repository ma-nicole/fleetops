/**
 * Typed wrapper around the backend predictive + prescriptive analytics endpoints
 * (paper §3.2.8 + §3.2.9). Each function pairs with a backend route registered
 * under `/api/analytics`.
 */
import { apiGet, apiPost } from "./api";

export type TripCostPredictRequest = {
  distance_km: number;
  cargo_weight_tons: number;
  vehicle_id?: number | null;
  avg_speed_kmh?: number;
  road_condition?: "highway" | "urban" | "rough";
  fuel_price_per_liter?: number;
  labor_rate_per_hour?: number;
  toll_rate_per_km?: number;
};

export type TripCostPredictResponse = {
  fuel_liters: number;
  fuel_cost: number;
  toll_cost: number;
  labor_cost: number;
  maintenance_risk_cost: number;
  total_cost: number;
  load_factor: number;
  speed_factor: number;
  road_factor: number;
  explanation: string[];
};

export type FuelPredictRequest = {
  distance_km: number;
  cargo_weight_tons: number;
  avg_speed_kmh?: number;
  road_condition?: "highway" | "urban" | "rough";
  fuel_price_per_liter?: number;
  vehicle_fuel_efficiency_kmpl?: number;
  max_load_tons?: number;
};

export type FuelPredictResponse = {
  fuel_liters: number;
  fuel_cost: number;
  load_factor: number;
  speed_factor: number;
  road_factor: number;
};

export type MaintenancePredictRequest = {
  vehicle_id?: number | null;
  mileage_km: number;
  age_years: number;
  engine_hours?: number;
  has_recurring_issue?: boolean;
  base_maintenance_cost?: number;
  expected_life_years?: number;
  standard_mileage?: number;
};

export type MaintenancePredictResponse = {
  risk_score: number;
  priority_level: "low_risk" | "medium_risk" | "high_risk";
  estimated_cost: number;
  next_service_in_days: number;
  mileage_factor: number;
  age_factor: number;
  explanation: string[];
};

export type RouteOptimizeRequest = {
  origin: string;
  destination: string;
  weight?: "cost" | "distance" | "time";
  cargo_weight_tons?: number;
  departure_hour?: number;
  vehicle_id?: number | null;
};

export type RouteEdge = {
  from_node: string;
  to_node: string;
  distance_km: number;
  fuel_cost: number;
  toll_cost: number;
  time_penalty: number;
  maintenance_penalty: number;
};

export type RouteCandidate = {
  rank: number;
  path: string[];
  distance_km: number;
  fuel_cost: number;
  toll_cost: number;
  time_penalty: number;
  maintenance_penalty: number;
  total_cost: number;
  edges: RouteEdge[];
  explanation: string[];
};

export type RouteOptimizeResponse = {
  candidates: RouteCandidate[];
  selected_rank: number;
  constraints_applied: string[];
};

export type AssignmentCandidate = {
  truck_id: number;
  truck_code: string;
  driver_id: number;
  driver_name: string;
  helper_id: number | null;
  helper_name: string | null;
  score: number;
  reasoning: string[];
};

export type AssignmentRecommendResponse = {
  booking_id: number;
  best: AssignmentCandidate | null;
  alternatives: AssignmentCandidate[];
};

export type WhatIfRequest = {
  base: TripCostPredictRequest;
  fuel_price_delta_pct?: number;
  distance_delta_pct?: number;
  cargo_delta_pct?: number;
  road_condition_override?: "highway" | "urban" | "rough" | null;
};

export type WhatIfResponse = {
  base: TripCostPredictResponse;
  simulated: TripCostPredictResponse;
  delta_total: number;
  delta_pct: number;
};

export type MonthlyForecastResponse = {
  horizon_months: number;
  points: { period: string; value: number }[];
};

export type ModelMetricRead = {
  model_name: string;
  mae: number;
  mape: number;
  rmse: number;
  accuracy: number;
  recall: number;
  f1: number;
  brier: number;
  sample_size: number;
  measured_at: string;
};

export type FeedbackSummaryResponse = {
  metrics_by_model: Record<string, ModelMetricRead>;
  drift_detected: boolean;
  last_retrain_at: string | null;
  sample_size: number;
};

export type AnalyticsDashboard = {
  ingested_at: string;
  kpis: {
    total_bookings: number;
    completed_bookings: number;
    ongoing_bookings: number;
    total_trips: number;
    active_trucks: number;
    fleet_size: number;
    total_revenue: number;
    outstanding_receivables: number;
    average_trip_cost: number;
  };
  marts: {
    trip_cost_mart: Array<{
      trip_id: number;
      booking_id: number;
      distance_km: number;
      fuel_cost: number;
      toll_cost: number;
      labor_cost: number;
      total_cost: number;
      cost_per_km: number;
      status: string;
      completed_at: string | null;
    }>;
    monthly_mart: Array<{ month: string; total_cost: number; trips: number }>;
    maintenance_mart: Array<{ truck_id: number; events: number; total_cost: number }>;
  };
};

export type ExpenseCategoryBreakdown = {
  key: string;
  label: string;
  amount_php: number;
};

export type ExpenseMonthlyTrendRow = {
  month: string;
  fuel: number;
  toll: number;
  allowance: number;
  operational: number;
  labor: number;
  total: number;
  trips: number;
};

export type ExpenseAnalyticsPayload = {
  generated_at: string;
  summary: {
    total_expenses_php: number;
    trip_count: number;
    avg_expense_per_trip_php: number;
    fuel_php: number;
    toll_php: number;
    allowance_php: number;
    driver_allowance_php: number;
    helper_allowance_php: number;
    labor_php: number;
    operational_php: number;
  };
  components: {
    system_trip_fuel_php: number;
    system_trip_toll_php: number;
    shoulder_fuel_php: number;
    shoulder_toll_php: number;
    shoulder_allowance_php: number;
    trip_driver_allowance_php: number;
    trip_helper_allowance_php: number;
    trip_crew_allowance_php: number;
    shoulder_operational_php: number;
    maintenance_records_php: number;
    trip_maintenance_field_php: number;
  };
  category_breakdown: ExpenseCategoryBreakdown[];
  shoulder_breakdown: Array<{ category: string; label: string; amount_php: number }>;
  monthly_trend: ExpenseMonthlyTrendRow[];
};

export type StatisticsSummary = {
  minimum: number;
  maximum: number;
  average: number;
  median: number;
  subtotal: number;
  standard_deviation: number | null;
  count: number;
  insufficient_for_spread?: boolean;
};

export type AnalyticsValidationCheck = {
  check: string;
  passed: boolean;
  detail: string;
  expected: unknown;
  actual: unknown;
};

export type AnalyticsValidation = {
  valid: boolean;
  checks: AnalyticsValidationCheck[];
};

export type AdminAnalyticsEmpty = { empty: true; message: string };

export type RoleAnalyticsFeatureBlock = AdminAnalyticsEmpty | {
  kpis: { label: string; value: string | number }[];
  chart: Record<string, unknown>[];
  drilldown: Record<string, unknown>[];
  statistics?: StatisticsSummary | null;
  note?: string;
};

export type RoleAnalyticsPillar = {
  descriptive: Record<string, RoleAnalyticsFeatureBlock>;
  predictive: Record<string, RoleAnalyticsFeatureBlock>;
};

export type ManagerRoleAnalyticsPayload = {
  planning: RoleAnalyticsPillar;
  organizing: RoleAnalyticsPillar;
  execution: RoleAnalyticsPillar;
  controlling: RoleAnalyticsPillar;
  performance_monitoring: RoleAnalyticsPillar;
  risk_management: RoleAnalyticsPillar;
};

export type DispatcherRoleAnalyticsPayload = {
  trip_scheduling: RoleAnalyticsPillar;
  route_coordination: RoleAnalyticsPillar;
  truck_assignment: RoleAnalyticsPillar;
  driver_coordination: RoleAnalyticsPillar;
  order_monitoring: RoleAnalyticsPillar;
  operational_support: RoleAnalyticsPillar;
};

export type DriverRoleAnalyticsPayload = {
  trip_execution: RoleAnalyticsPillar;
  route_navigation: RoleAnalyticsPillar;
  delivery_reporting: RoleAnalyticsPillar;
  vehicle_monitoring: RoleAnalyticsPillar;
  trip_status: RoleAnalyticsPillar;
};

export type DriverAnalyticsPayload = {
  generated_at: string;
  filters_applied: Record<string, string | number | null>;
  filter_options: {
    trucks: { id: number; code: string }[];
    routes: string[];
    shipment_statuses: string[];
  };
  driver_role_analytics: DriverRoleAnalyticsPayload;
};

export type DriverAnalyticsQuery = {
  date_from?: string;
  date_to?: string;
  truck_id?: number;
  route?: string;
  shipment_status?: string;
};

export type ExpenseInterpretationRequest = {
  context_year: number;
  quarter: number;
  quarter_label: string;
  total_php: number;
  categories: { key: string; label: string; amount_php: number; percentage: number }[];
  largest: { key: string; label: string; amount_php: number; percentage: number };
  smallest: { key: string; label: string; amount_php: number; percentage: number };
  concentration: "balanced" | "moderately concentrated" | "highly concentrated";
};

export type ExpenseInterpretationResponse = {
  interpretation: string;
};

export type PercentageItem = {
  label: string;
  value: number;
  percentage: number | null;
};

export type ExecutiveKpi = {
  key: string;
  label: string;
  value: number | null;
  format: "php" | "percent" | "count";
  growth_pct?: number | null;
  trend?: "up" | "down" | "flat" | null;
  subtitle?: string | null;
};

export type ExecutiveOverview = {
  kpis: ExecutiveKpi[];
};

export type ComparativePoint = {
  period: string;
  value: number;
};

export type ComparativeComparison = {
  type: string;
  label: string;
  current_period: string;
  previous_period: string;
  current_value: number;
  previous_value: number;
  change_pct: number | null;
  trend: "up" | "down" | "flat";
};

export type ComparativeMetric = {
  value_format: "php" | "count";
  granularity_options: ("weekly" | "monthly" | "quarterly" | "yearly")[];
  series: Partial<Record<"weekly" | "monthly" | "quarterly" | "yearly", ComparativePoint[]>>;
  comparisons: Partial<Record<"weekly" | "monthly" | "quarterly" | "yearly", ComparativeComparison[]>>;
};

export type ComparativeAnalytics = {
  revenue?: ComparativeMetric;
  expenses?: ComparativeMetric;
  deliveries?: ComparativeMetric;
};

export type ChartInterpretationRequest = {
  section_title: string;
  selection_label: string;
  chart_type: string;
  items: Array<Record<string, string | number | undefined>>;
  record_count: number;
  statistics?: StatisticsSummary;
};

export type ChartInterpretationResponse = {
  interpretation: string;
};

export type AdminAnalyticsPayload = {
  generated_at: string;
  filters_applied: Record<string, string | number | null>;
  filter_options: {
    drivers: { id: number; name: string }[];
    trucks: { id: number; code: string }[];
    routes: string[];
    shipment_statuses: string[];
  };
  shipments: AdminAnalyticsEmpty | {
    summary: Record<string, number | null>;
    statistics: StatisticsSummary | null;
    status_distribution: { status: string; count: number }[];
    monthly_deliveries: { month: string; count: number }[];
    drilldown: Record<string, unknown>[];
  };
  expenses: AdminAnalyticsEmpty | {
    summary: Record<string, number>;
    statistics: StatisticsSummary | null;
    fuel_by_truck: { truck_id: number; truck_code: string; fuel_php: number }[];
    fuel_by_route: { route: string; fuel_php: number }[];
    expense_breakdown: { key: string; label: string; amount_php: number }[];
    monthly_totals: { month: string; total: number; fuel: number; toll: number; maintenance: number; allowance: number }[];
    drilldown: {
      context_year: number;
      categories: { key: string; label: string }[];
      records: {
        expense_date: string;
        category: string;
        amount_php: number;
        source_type: string;
        source_id?: number | null;
        trip_id?: number | null;
        booking_id?: number | null;
        truck_id?: number | null;
        truck_code?: string | null;
        label?: string | null;
      }[];
    };
  };
  fleet: AdminAnalyticsEmpty | {
    summary: Record<string, string | number | null>;
    statistics: StatisticsSummary | null;
    truck_usage: Record<string, unknown>[];
    drilldown: Record<string, unknown>[];
  };
  drivers: AdminAnalyticsEmpty | {
    summary: Record<string, number>;
    statistics: StatisticsSummary | null;
    ranking: Record<string, unknown>[];
    distribution: { driver_name: string; completed: number; delayed: number }[];
    drilldown: Record<string, unknown>[];
  };
  routes: AdminAnalyticsEmpty | {
    summary: Record<string, string | number | null>;
    statistics: StatisticsSummary | null;
    performance: Record<string, unknown>[];
    cost_comparison: Record<string, unknown>[];
    drilldown: Record<string, unknown>[];
  };
  financial: AdminAnalyticsEmpty | {
    summary: Record<string, string | number | null>;
    statistics: StatisticsSummary | null;
    revenue_trend: { month: string; revenue_php: number; expense_php: number; profit_php: number }[];
    revenue_vs_expense: { month: string; revenue_php: number; expense_php: number; profit_php: number }[];
    profit_trend: { month: string; profit_php: number }[];
    category_summary?: { category: string; label: string; amount_php: number }[];
    revenue_per_client: Record<string, unknown>[];
    drilldown?: Record<string, unknown>[];
  } | null;
  clients: AdminAnalyticsEmpty | {
    summary: Record<string, number>;
    statistics: StatisticsSummary | null;
    booking_distribution: { client_name: string; bookings: number }[];
    revenue_contribution: { client_name: string; revenue_php: number }[];
    drilldown: Record<string, unknown>[];
  } | null;
  role_analytics?: ManagerRoleAnalyticsPayload | null;
  dispatcher_role_analytics?: DispatcherRoleAnalyticsPayload | null;
  validation?: AnalyticsValidation;
  executive_overview?: ExecutiveOverview | null;
  comparative_analytics?: ComparativeAnalytics | null;
  section_percentages?: {
    shipments?: PercentageItem[] | null;
    expenses?: PercentageItem[] | null;
    financial?: PercentageItem[] | null;
  } | null;
};

export type AdminAnalyticsQuery = {
  date_from?: string;
  date_to?: string;
  driver_id?: number;
  truck_id?: number;
  route?: string;
  shipment_status?: string;
};

export const AnalyticsApi = {
  predictTripCost: (req: TripCostPredictRequest) =>
    apiPost<TripCostPredictResponse>("/analytics/predict-trip-cost", req),
  predictFuel: (req: FuelPredictRequest) => apiPost<FuelPredictResponse>("/analytics/predict-fuel", req),
  predictMaintenance: (req: MaintenancePredictRequest) =>
    apiPost<MaintenancePredictResponse>("/analytics/predict-maintenance", req),
  optimizeRoute: (req: RouteOptimizeRequest) =>
    apiPost<RouteOptimizeResponse>("/analytics/optimize-route", req),
  recommendAssignment: (booking_id: number) =>
    apiPost<AssignmentRecommendResponse>("/analytics/recommend-assignment", { booking_id }),
  whatIf: (req: WhatIfRequest) => apiPost<WhatIfResponse>("/analytics/whatif", req),
  forecastMonthly: (horizon = 6) =>
    apiGet<MonthlyForecastResponse>(`/analytics/forecast-monthly?horizon=${horizon}`),
  feedbackSummary: () => apiGet<FeedbackSummaryResponse>("/analytics/feedback-summary"),
  trainCostModel: () => apiPost<Record<string, unknown>>("/analytics/train-cost-model"),
  dashboard: () => apiGet<AnalyticsDashboard>("/analytics/dashboard"),
  expenseAnalytics: () => apiGet<ExpenseAnalyticsPayload>("/analytics/expenses"),
  managerDashboard: () => apiGet<Record<string, unknown>>("/manager/dashboard"),
  financeSummary: () =>
    apiGet<{
      total_revenue: number;
      total_paid: number;
      total_pending: number;
      total_failed: number;
      total_refunded: number;
      receivables: number;
      payments_count: number;
      average_ticket: number;
      by_method: Record<string, number>;
    }>("/payments/finance/summary"),
  adminAnalytics: (query: AdminAnalyticsQuery = {}) => {
    const params = new URLSearchParams();
    if (query.date_from) params.set("date_from", query.date_from);
    if (query.date_to) params.set("date_to", query.date_to);
    if (query.driver_id != null) params.set("driver_id", String(query.driver_id));
    if (query.truck_id != null) params.set("truck_id", String(query.truck_id));
    if (query.route) params.set("route", query.route);
    if (query.shipment_status) params.set("shipment_status", query.shipment_status);
    const qs = params.toString();
    return apiGet<AdminAnalyticsPayload>(`/admin/analytics${qs ? `?${qs}` : ""}`);
  },
  driverAnalytics: (query: DriverAnalyticsQuery = {}) => {
    const params = new URLSearchParams();
    if (query.date_from) params.set("date_from", query.date_from);
    if (query.date_to) params.set("date_to", query.date_to);
    if (query.truck_id != null) params.set("truck_id", String(query.truck_id));
    if (query.route) params.set("route", query.route);
    if (query.shipment_status) params.set("shipment_status", query.shipment_status);
    const qs = params.toString();
    return apiGet<DriverAnalyticsPayload>(`/driver/analytics${qs ? `?${qs}` : ""}`);
  },
  expenseInterpretation: (req: ExpenseInterpretationRequest) =>
    apiPost<ExpenseInterpretationResponse>("/admin/analytics/expense-interpretation", req),
  chartInterpretation: (req: ChartInterpretationRequest) =>
    apiPost<ChartInterpretationResponse>("/admin/analytics/chart-interpretation", req),
};
