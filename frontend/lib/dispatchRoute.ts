export type DispatchRouteOption = {
  id: number;
  booking_id: number;
  rank: number;
  path: string[];
  route_name?: string | null;
  notes?: string | null;
  summary?: string | null;
  duration_hours?: number | null;
  distance_km: number;
  fuel_cost: number;
  toll_cost: number;
  time_penalty: number;
  maintenance_penalty: number;
  total_cost: number;
  is_selected: boolean;
  source: string;
  provider?: string | null;
  objective_tags?: string[];
  routing_note?: string | null;
  created_at: string | null;
};

export type DispatchManualRoutePayload = {
  route_name: string;
  distance_km: number;
  duration_hours: number;
  toll_cost_php?: number;
  notes?: string | null;
};

export type DispatchRouteOptionsResponse = {
  booking_id: number;
  pickup_location: string;
  dropoff_location: string;
  selected_route_option_id: number | null;
  options: DispatchRouteOption[];
  map_verification_warning?: string | null;
  alternatives_available?: boolean;
  routing_note?: string | null;
};
