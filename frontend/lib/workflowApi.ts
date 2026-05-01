/**
 * Typed wrapper around the booking → trip → payment lifecycle.
 */
import { apiGet, apiPost } from "./api";

export type BookingStatus =
  | "pending_approval"
  | "approved"
  | "assigned"
  | "accepted"
  | "enroute"
  | "loading"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "rejected";

export type Booking = {
  id: number;
  customer_id: number;
  pickup_location: string;
  dropoff_location: string;
  service_type: "fixed" | "customized";
  scheduled_date: string;
  cargo_weight_tons: number;
  cargo_description: string | null;
  estimated_cost: number;
  actual_cost: number | null;
  status: BookingStatus;
  approved_by_id: number | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Trip = {
  id: number;
  booking_id: number;
  truck_id: number;
  driver_id: number;
  dispatcher_id: number | null;
  route_path: string;
  distance_km: number;
  toll_cost: number;
  fuel_cost: number;
  labor_cost: number;
  duration_hours: number;
  status: string;
  assigned_at: string | null;
  accepted_at: string | null;
  departure_time: string | null;
  arrival_pickup_time: string | null;
  loading_start_time: string | null;
  loading_end_time: string | null;
  departure_delivery_time: string | null;
  arrival_delivery_time: string | null;
  completed_at: string | null;
  proof_of_delivery: string | null;
  pod_notes: string | null;
  current_latitude: number | null;
  current_longitude: number | null;
  estimated_delivery_time: string | null;
};

export type Payment = {
  id: number;
  booking_id: number;
  customer_id: number;
  method: string;
  amount: number;
  status: "pending" | "processing" | "paid" | "failed" | "refunded";
  reference: string;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export const WorkflowApi = {
  // Bookings
  listBookings: () => apiGet<Booking[]>("/bookings"),
  createBooking: (payload: {
    pickup_location: string;
    dropoff_location: string;
    service_type: "fixed" | "customized";
    scheduled_date: string;
    cargo_weight_tons: number;
    cargo_description?: string | null;
  }) => apiPost<Booking>("/bookings", payload),
  cancelBooking: (id: number) => apiPost<{ status: string }>(`/bookings/${id}/cancel`),

  // Workflow API
  workflowCreateBooking: (payload: Record<string, unknown>) =>
    apiPost<Booking>("/workflow/booking/create", payload),
  pendingApprovals: () => apiGet<Booking[]>("/workflow/booking/pending-approval"),
  approveBooking: (id: number, approved: boolean, reason?: string) =>
    apiPost<Booking>(`/workflow/booking/${id}/approve`, { approved, rejection_reason: reason }),
  createJobFromBooking: (id: number) => apiPost<Trip>(`/workflow/job/create-from-booking/${id}`),

  // Trip
  getTrip: (trip_id: number) => apiGet<Trip>(`/workflow/job/${trip_id}`),

  // Driver
  myTrips: () => apiGet<Trip[]>("/driver/trips"),
  driverSalary: () => apiGet<Record<string, unknown>>("/driver/salary"),
  driverCheckIn: () => apiPost<{ checked_in: boolean; timestamp: string }>("/driver/attendance/check-in"),
  acceptJob: (trip_id: number) => apiPost<Trip>(`/workflow/job/${trip_id}/accept`),
  depart: (trip_id: number, lat?: number, lng?: number) =>
    apiPost<Trip>(`/workflow/job/${trip_id}/depart`, {
      status: "departed",
      latitude: lat,
      longitude: lng,
    }),
  arrivedPickup: (trip_id: number) =>
    apiPost<Trip>(`/workflow/job/${trip_id}/arrived-pickup`, { status: "loading" }),
  loadingComplete: (trip_id: number) =>
    apiPost<Trip>(`/workflow/job/${trip_id}/loading-complete`),
  completeTrip: (trip_id: number, proof_url?: string, notes?: string) =>
    apiPost<Trip>(`/workflow/job/${trip_id}/complete`, { proof_url, notes }),
  reportIssue: (trip_id: number, issue_type: string, description: string, severity = "medium") =>
    apiPost(`/workflow/job/${trip_id}/report-issue`, { issue_type, description, severity }),

  // Fuel & toll
  addFuelLog: (
    trip_id: number,
    payload: { liters: number; cost: number; odometer_km?: number; receipt_url?: string }
  ) => apiPost(`/trips/${trip_id}/fuel-log`, payload),
  addTollLog: (trip_id: number, payload: { location: string; amount: number; receipt_url?: string }) =>
    apiPost(`/trips/${trip_id}/toll-log`, payload),
  fuelLogs: (trip_id: number) => apiGet(`/trips/${trip_id}/fuel-logs`),
  tollLogs: (trip_id: number) => apiGet(`/trips/${trip_id}/toll-logs`),
  generateReport: (trip_id: number) => apiPost(`/trips/${trip_id}/generate-report`),
  getCompletionReport: (trip_id: number) => apiGet(`/trips/${trip_id}/report`),
  confirmCompletionReport: (trip_id: number) => apiPost(`/trips/${trip_id}/report/confirm`),

  // Payments
  listPayments: () => apiGet<Payment[]>("/payments"),
  payBooking: (booking_id: number, method: string, amount: number) =>
    apiPost<Payment>("/payments", { booking_id, method, amount }),
  refundPayment: (payment_id: number, reason?: string) =>
    apiPost<Payment>(`/payments/${payment_id}/refund`, { reason }),
  bookingPayments: (booking_id: number) => apiGet<Payment[]>(`/payments/booking/${booking_id}`),

  // Feedback
  submitFeedback: (payload: {
    booking_id: number;
    rating: number;
    message?: string;
    category?: string;
  }) => apiPost("/feedback", payload),
  listFeedback: () => apiGet("/feedback"),

  // Manager
  managerFinance: () => apiGet("/manager/finance"),
  issueJobOrder: (booking_id: number, instructions?: string) =>
    apiPost(`/manager/job-orders/${booking_id}${instructions ? `?instructions=${encodeURIComponent(instructions)}` : ""}`),

  // Schedule
  scheduleTrucks: (week?: string) =>
    apiGet(`/schedule/trucks${week ? `?week=${encodeURIComponent(week)}` : ""}`),
  scheduleDrivers: (week?: string) =>
    apiGet(`/schedule/drivers${week ? `?week=${encodeURIComponent(week)}` : ""}`),
  availability: (scheduled_date: string) =>
    apiGet(`/schedule/availability?scheduled_date=${encodeURIComponent(scheduled_date)}`),

  // Dispatch
  manualAssign: (
    booking_id: number,
    payload: {
      truck_id?: number;
      driver_id?: number;
      helper_id?: number;
      route_path?: string[];
      distance_km?: number;
      duration_hours?: number;
      fuel_cost?: number;
      toll_cost?: number;
      labor_cost?: number;
      predicted_total_cost?: number;
    }
  ) => apiPost(`/dispatch/${booking_id}/assign`, payload),
};
