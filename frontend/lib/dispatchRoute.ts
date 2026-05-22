export type DispatchRouteOption = {
  id: number;
  booking_id: number;
  rank: number;
  path: string[];
  distance_km: number;
  fuel_cost: number;
  toll_cost: number;
  time_penalty: number;
  maintenance_penalty: number;
  total_cost: number;
  is_selected: boolean;
  source: string;
  created_at: string | null;
};

export type DispatchRouteOptionsResponse = {
  booking_id: number;
  pickup_location: string;
  dropoff_location: string;
  selected_route_option_id: number | null;
  options: DispatchRouteOption[];
};
