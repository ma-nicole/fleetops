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
};
