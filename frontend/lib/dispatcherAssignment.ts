export type DispatcherUserOption = {
  id: number;
  full_name: string;
  email: string;
};

export type DispatcherAssignmentRow = {
  booking_id: number;
  customer_id: number;
  status: string;
  pickup_location: string;
  dropoff_location: string;
  cargo_description: string | null;
  cargo_weight_tons: number;
  scheduled_date: string;
  scheduled_time_slot: string;
  assigned_dispatcher_id: number | null;
  assigned_dispatcher_name: string | null;
  job_order_id: number | null;
  job_issued_at: string | null;
};
