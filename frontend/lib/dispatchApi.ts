import { apiGet } from "./api";

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
    available_trucks: number;
    trucks_total: number;
    drivers_total: number;
    drivers_busy: number;
    drivers_idle: number;
    trips_assigned_today: number;
    trips_completed_today: number;
    today_volume: number;
  };
  recent_trips: DispatcherDashboardTrip[];
};

export const DispatchApi = {
  dashboard: () => apiGet<DispatcherDashboardResponse>("/dispatch/dashboard"),
};
