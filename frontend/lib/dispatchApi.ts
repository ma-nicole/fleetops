import { apiGet, apiPostMultipart } from "./api";

export type DispatcherDashboardTrip = {
  id: number;
  display_id: string;
  driver_name: string;
  route: string;
  status: string;
  start_time: string | null;
  eta: string | null;
  booking_id: number;
};

export type DispatcherDashboardResponse = {
  kpis: {
    pending_orders: number;
    active_trips: number;
    /** In-progress legs dispatched today (subset of today's board). */
    active_trips_assigned_today: number;
    available_trucks: number;
    trucks_total: number;
    trucks_operational: number;
    drivers_total: number;
    drivers_busy: number;
    drivers_idle: number;
    drivers_on_break: number;
    drivers_standby: number;
    trips_assigned_today: number;
    trips_completed_today: number;
    /** Distinct trip legs with assign or complete activity today (no double-count). */
    today_volume: number;
  };
  recent_trips: DispatcherDashboardTrip[];
};

export type OperationsSummary = {
  pending_payment_verification: number;
  waiting_for_assignment: number;
  assigned_trips: number;
  for_pickup: number;
  picked_up: number;
  en_route: number;
  dropped_off: number;
  completed_today: number;
  cancelled_bookings: number;
  available_trucks: number;
  trucks_under_maintenance: number;
  available_drivers: number;
  available_helpers: number;
};

export type OperationsActiveTripRow = {
  trip_id: number;
  booking_id: number;
  pickup: string;
  dropoff: string;
  truck_code: string;
  driver_name: string;
  helper_name: string;
  current_status: string;
  /** For status pill (includes `delayed` when ETA passed). Omitted on older API responses. */
  badge_status?: string;
  latest_location: string;
  scheduled_window: string;
  last_updated: string | null;
  eta?: string | null;
};

export type OperationsWaitingBooking = {
  booking_id: number;
  cargo_weight_tons: number;
  required_trucks: number;
  pickup_location: string;
  dropoff_location: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  payment_verified_at: string | null;
};

export type OperationsResources = {
  trucks: { available: number; on_hold: number; assigned: number; under_maintenance: number; total_registered: number };
  drivers: { available: number; assigned: number; off_duty: number; total: number };
  helpers: { available: number; assigned: number; off_duty: number; total: number };
};

export type OperationsLocationUpdate = {
  trip_id: number;
  helper_name: string;
  status: string;
  location_text: string;
  updated_at: string | null;
};

export type OperationsAlert = {
  severity: string;
  code: string;
  message: string;
  trip_id: number | null;
  booking_id: number | null;
};

export type OperationsCenterResponse = {
  generated_at: string | null;
  summary: OperationsSummary;
  active_trips: OperationsActiveTripRow[];
  waiting_for_assignment: OperationsWaitingBooking[];
  resources: OperationsResources;
  recent_location_updates: OperationsLocationUpdate[];
  alerts: OperationsAlert[];
};

export type TripLogTimelineEntry = {
  at: string;
  kind:
    | "milestone"
    | "helper_status"
    | "location_ping"
    | "issue"
    | "delivery_proof"
    | "operational_log";
  label: string;
  detail: string | null;
  photos: string[];
  actor: string | null;
  severity?: string;
  resolved?: boolean;
  priority?: string;
  report_type?: string;
};

export type TripLogRow = {
  trip_id: number;
  booking_id: number;
  pickup: string;
  dropoff: string;
  truck_code: string | null;
  driver_name: string | null;
  helper_name: string | null;
  trip_status: string;
  helper_progress_status: string | null;
  latest_location: string | null;
  completed_at: string | null;
  timeline: TripLogTimelineEntry[];
};

export type TripLogsResponse = {
  trips: TripLogRow[];
};

export const DispatchApi = {
  dashboard: () => apiGet<DispatcherDashboardResponse>("/dispatch/dashboard"),
  operationsCenter: () => apiGet<OperationsCenterResponse>("/dispatch/operations-center"),
  tripLogs: () => apiGet<TripLogsResponse>("/dispatch/trip-logs"),
  createOperationalLog: (formData: FormData) =>
    apiPostMultipart<{
      id: number;
      booking_id: number;
      trip_id: number;
      dispatcher_id: number;
      report_type: string;
      report_type_label: string;
      priority_level: string;
      operational_details: string;
      attachment_url: string | null;
      created_at: string | null;
    }>("/dispatch/operational-log", formData),
};
