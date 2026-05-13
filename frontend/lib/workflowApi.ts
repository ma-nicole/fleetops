/**
 * Typed wrapper around the booking → trip → payment lifecycle.
 */
import { apiGet, apiPatch, apiPost, apiPostMultipart } from "./api";

export type BookingStatus =
  | "pending_payment"
  | "payment_verification"
  | "payment_verified"
  | "ready_for_assignment"
  | "pending_approval"
  | "approved"
  | "assigned"
  | "accepted"
  | "enroute"
  | "loading"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "rejected"
  | "payment_rejected"
  | "expired";

export type CustomerBookingAssignment = {
  trip_id: number;
  trip_status: string;
  helper_progress_status: string | null;
  truck: {
    id: number;
    code: string;
    plate_number?: string;
    model_name: string | null;
    capacity_tons: number;
  } | null;
  driver: { id: number; name: string } | null;
  helper: { id: number; name: string } | null;
  latest_location_name: string | null;
  location_updates: Array<{
    location_name: string;
    remarks: string | null;
    photo_url: string | null;
    created_at: string;
  }>;
  status_timeline: Array<{
    status: string;
    location_name: string;
    remarks: string | null;
    photo_url: string | null;
    created_at: string;
  }>;
};

export type CustomerBookingRow = Booking & {
  display_status: string;
  display_status_label: string;
  can_cancel: boolean;
  assignments: CustomerBookingAssignment[];
};

export type CustomerBookingHistoryRow = CustomerBookingRow & {
  primary_trip_id: number | null;
  closed_at: string | null;
};

export type Booking = {
  id: number;
  customer_id: number;
  pickup_location: string;
  dropoff_location: string;
  service_type: "fixed" | "customized";
  scheduled_date: string;
  scheduled_time_slot: string;
  cargo_weight_tons: number;
  required_truck_count: number;
  cargo_description: string | null;
  estimated_cost: number;
  actual_cost: number | null;
  status: BookingStatus;
  approved_by_id: number | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  latest_location?: string | null;
};

export type TripBookingSummary = {
  id: number;
  customer_id?: number;
  customer_name?: string | null;
  customer_company_name?: string | null;
  paid_amount_verified?: number | null;
  pickup_location: string;
  dropoff_location: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  cargo_weight_tons: number;
  cargo_description: string | null;
  estimated_cost: number;
  status: string;
};

export type TripTruckSummary = {
  id: number;
  code: string;
  capacity_tons: number;
  model_name?: string | null;
  plate_number?: string | null;
  /** Fleet DB status (e.g. available, maintenance). */
  status?: string | null;
  availability_status?: string | null;
};

/** Shared driver/helper assigned-leg row from GET /driver/bookings and GET /helper/bookings. */
export type CrewTimelineEvent = {
  at: string;
  kind: "milestone" | "location";
  code: string;
  title: string;
  detail: string;
  remarks: string | null;
  photo_url: string | null;
  submitted_by: string | null;
  update_index?: number;
};

export type CrewAssignedBookingRow = {
  trip_id: number;
  booking_id: number;
  trip_status: string;
  helper_progress_status: string | null;
  operational_status: string;
  location_updates_submitted: number;
  required_location_updates: number;
  location_update_count: number;
  distance_km: number;
  road_distance_km: number | null;
  driver_name: string | null;
  helper_name: string | null;
  driver_profile: { rating: number; compliance_status: string } | null;
  helper_profile: { rating: number } | null;
  latest_location: string | null;
  latest_location_name: string | null;
  payment_status: string;
  payment_latest_amount_php: number | null;
  booking_status: string | null;
  truck_assignment_status: string | null;
  completed_at: string | null;
  pod_notes: string | null;
  timeline_events: CrewTimelineEvent[];
  location_updates: Array<{
    id: number;
    location_name: string;
    remarks: string | null;
    photo_url: string | null;
    created_at: string;
    helper_id: number;
    submitted_by: string | null;
  }>;
  status_updates: Array<{
    id: number;
    status: string;
    location_name: string;
    remarks: string | null;
    photo_url: string | null;
    created_at: string;
    helper_id: number;
    submitted_by: string | null;
  }>;
  proof_photo_urls: string[];
  general_operational_reports: Array<{
    id: number;
    category: string;
    status: string | null;
    report_date: string;
    description: string;
    notes: string | null;
    attachment_url: string | null;
    created_at: string;
  }>;
  vehicle_issue_reports: Array<{
    id: number;
    issue_type: string;
    priority: string;
    description: string;
    attachment_url: string | null;
    status: string;
    created_at: string;
  }>;
  recent_locations: Array<{
    location_name: string;
    remarks: string | null;
    photo_url: string | null;
    created_at: string;
  }>;
  booking: TripBookingSummary | null;
  truck: TripTruckSummary | null;
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
  latest_location: string | null;
  estimated_delivery_time: string | null;
  helper_id?: number | null;
  helper_name?: string | null;
  helper_progress_status?: string | null;
  helper_last_proof_path?: string | null;
  /** Helper workflow slug (assigned, for_pickup, picked_up, …). */
  operational_status?: string;
  operational_status_label?: string;
  /** Routed pickup→dropoff km when available. */
  road_distance_km?: number | null;
  driver_name?: string | null;
  location_updates?: Array<{
    location_name: string;
    remarks: string | null;
    photo_url: string | null;
    created_at: string;
  }>;
  status_timeline?: Array<{
    status: string;
    location_name: string;
    remarks: string | null;
    photo_url: string | null;
    created_at: string;
  }>;
  booking?: TripBookingSummary | null;
  truck?: TripTruckSummary | null;
};

export type DriverDashboardSummary = {
  generated_at: string;
  crew_role?: "driver" | "helper";
  attendance: {
    has_open_shift: boolean;
    check_in_at: string | null;
    can_check_in: boolean;
  };
  assignments_today: {
    total_assigned_today: number;
    active_trips: number;
    completed_today: number;
    completed_legs_total: number;
  };
  distance_loaded_km: {
    total_km: number;
    average_km: number;
    trip_count: number;
  };
  fuel_completed_php: number;
  trip_labor_completed_php: number;
  completion_rate_percent: number;
  completion_counts: {
    completed_assigned_legs: number;
    assigned_legs_excluded_cancelled: number;
  };
  driver_profile: {
    base_salary_php: number;
    deductions_php: number;
    net_salary_php: number;
    compliance_status: string;
    rating: number;
  } | null;
  helper_profile?: {
    base_salary_php: number;
    rating: number;
  } | null;
};

export type DriverPayHistoryRow = {
  trip_id: number;
  booking_id: number;
  completed_at: string | null;
  period_label: string;
  route_label: string;
  cargo_weight_tons: number;
  distance_km: number;
  driver_pay: number;
  bonus: number;
  deduction: number;
  total_pay: number;
  status: string;
};

export type DriverPaySummary = {
  period_start: string;
  period_end: string;
  period_label: string;
  trips_completed: number;
  total_distance_km: number;
  base_earnings: number;
  bonus: number;
  deductions: number;
  current_total: number;
  driver_share_formula: {
    description: string;
    cargo_gross_php_per_ton: number;
    driver_share_rate: number;
  };
  payroll_note: string;
  payment_history: DriverPayHistoryRow[];
};

export type DriverVehicleIssueSelectableTrip = {
  trip_id: number;
  booking_id: number;
  truck_plate: string;
  truck_model: string | null;
  route_label: string;
  pickup_location: string;
  dropoff_location: string;
  helper_id: number | null;
  helper_name: string | null;
  trip_status: string;
  operational_status: string;
  scheduled_date: string | null;
};

export type DriverVehicleIssueReportResponse = {
  id: number;
  booking_id: number;
  trip_id: number;
  truck_id: number;
  driver_id: number;
  helper_id: number | null;
  issue_type: string;
  priority: string;
  description: string;
  attachment_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DispatchVehicleIssueReportRow = {
  id: number;
  booking_id: number;
  trip_id: number;
  truck_id: number;
  truck_plate: string;
  truck_model: string | null;
  route: string;
  driver_id: number;
  driver_name: string | null;
  helper_id: number | null;
  helper_name: string | null;
  issue_type: string;
  issue_type_label: string;
  priority: string;
  description: string;
  attachment_url: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

export type GeneralOperationalReportRow = {
  id: number;
  booking_id: number;
  trip_id: number;
  driver_id: number;
  driver_name: string | null;
  category: string;
  category_label: string;
  trip_status: string | null;
  trip_status_label: string | null;
  report_date: string;
  starting_odometer_km: number | null;
  ending_odometer_km: number | null;
  fuel_consumed: number | null;
  description: string;
  notes: string | null;
  attachment_url: string | null;
  created_at: string | null;
  route: string;
  truck_plate: string;
};

export type DriverGeneralOperationalReportResponse = {
  id: number;
  booking_id: number;
  trip_id: number;
  driver_id: number;
  helper_id: number | null;
  category: string;
  trip_status: string | null;
  report_date: string;
  starting_odometer_km: number | null;
  ending_odometer_km: number | null;
  fuel_consumed: number | null;
  description: string;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
};

export type Payment = {
  id: number;
  booking_id: number;
  customer_id: number;
  method: string;
  amount: number;
  status: "for_verification" | "verified" | "rejected" | "refunded";
  reference: string;
  paid_at: string | null;
  refunded_at: string | null;
  proof_original_filename?: string | null;
  proof_uploaded_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

export type ScheduleTimelineResource = {
  id: number;
  label: string;
  sub: string;
  availability: "available" | "maintenance" | "lane";
};

export type ScheduleTimelineEvent = {
  id: string;
  type: string;
  trip_id: number | null;
  booking_id: number | null;
  resource_kind: string;
  resource_id: number;
  start: string;
  end: string;
  state: string;
  title: string;
  subtitle: string;
  pickup?: string;
  dropoff?: string;
  truck_code?: string;
  driver_name?: string;
  helper_name?: string;
  trip_status?: string;
  helper_progress?: string | null;
  customer_name?: string;
  cargo_tons?: number;
  conflict?: boolean;
  conflict_reasons?: string[];
};

export type ScheduleTimelineResponse = {
  window_start: string;
  window_end: string;
  mode: string;
  resource: string;
  total_hours: number;
  start_date: string;
  resources: ScheduleTimelineResource[];
  events: ScheduleTimelineEvent[];
  conflicts: Array<{
    event_id: string;
    trip_id: number | null;
    booking_id: number | null;
    reasons: string[];
    label?: string;
  }>;
};

export type ScheduleTimelineTripDetail = {
  trip_id: number;
  booking_id: number;
  customer: string;
  customer_email: string | null;
  cargo_tons: number;
  pickup: string;
  dropoff: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  booking_status: string;
  trip_status: string;
  helper_progress: string | null;
  truck: { id: number; code: string | null } | null;
  driver: { id: number; name: string | null } | null;
  helper: { id: number; name: string | null } | null;
  eta: string | null;
  payment: { status: string | null; amount: number | null };
  window_start: string;
  window_end: string;
  latest_location: { text: string; at: string } | null;
  status_history: Array<{ status: string; location: string; at: string }>;
};

export type DispatchTripMonitoringAssignment = {
  trip_id: number;
  trip_status: string;
  operational_status: string;
  booking_id: number;
  customer_id: number;
  customer_name: string | null;
  customer_company_name: string | null;
  pickup_location: string;
  dropoff_location: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  cargo_weight_tons: number;
  estimated_cost: number;
  booking_status: string;
  booking_db_status: string;
  paid_amount_verified?: number | null;
  truck_id: number | null;
  truck_code: string;
  driver_id: number | null;
  driver_name: string | null;
  helper_id: number | null;
  helper_name: string | null;
  helper_progress_status: string | null;
  distance_km: number;
  latest_location: string | null;
  last_updated: string | null;
};

export type DispatchTripMonitoringBoardResponse = {
  generated_at: string;
  summary: {
    active_legs: number;
    in_transit_legs: number;
    loading_unloading_legs: number;
    completed_trip_legs_today: number;
    completed_trip_legs_total: number;
    bookings_all_legs_completed: number;
  };
  active_assignments: DispatchTripMonitoringAssignment[];
};

export const WorkflowApi = {
  // Bookings
  listBookings: () => apiGet<Booking[]>("/bookings"),
  bookingPickupSlotAvailability: (
    scheduled_date: string,
    opts?: { cargo_weight_tons?: number; pickup_location?: string; dropoff_location?: string },
  ) => {
    const q = new URLSearchParams({ scheduled_date });
    if (opts?.cargo_weight_tons != null && Number.isFinite(opts.cargo_weight_tons)) {
      q.set("cargo_weight_tons", String(opts.cargo_weight_tons));
    }
    if (opts?.pickup_location && opts.pickup_location.trim().length >= 3) {
      q.set("pickup_location", opts.pickup_location.trim());
    }
    if (opts?.dropoff_location && opts.dropoff_location.trim().length >= 3) {
      q.set("dropoff_location", opts.dropoff_location.trim());
    }
    return apiGet<{
      scheduled_date: string;
      slots: Record<string, boolean>;
      required_trucks: number;
      available_trucks_by_slot: Record<string, number>;
    }>(
      `/bookings/schedule-availability?${q.toString()}`,
    );
  },
  createBooking: (payload: {
    pickup_location: string;
    dropoff_location: string;
    service_type: "fixed" | "customized";
    scheduled_date: string;
    scheduled_time_slot: string;
    cargo_weight_tons: number;
    cargo_description?: string | null;
  }) => apiPost<Booking>("/bookings", payload),
  getBooking: (id: number) => apiGet<Booking>(`/bookings/${id}`),
  bookingTrackingDetails: (id: number) =>
    apiGet<{
      booking: {
        id: number;
        status: string;
        pickup_location: string;
        dropoff_location: string;
        cargo_weight_tons: number;
        scheduled_date: string;
        scheduled_time_slot: string;
        required_truck_count: number;
        /** Routed pickup→dropoff km (same engine as booking pricing); null if unavailable. */
        road_distance_km?: number | null;
      };
      assignments: Array<{
        trip_id: number;
        trip_status: string;
        helper_progress_status: string | null;
        truck: { id: number; code: string; model_name: string | null; capacity_tons: number } | null;
        driver: { id: number; name: string } | null;
        helper: { id: number; name: string } | null;
        latest_location_name: string | null;
        location_updates: Array<{
          location_name: string;
          remarks: string | null;
          photo_url: string | null;
          created_at: string;
        }>;
        status_timeline: Array<{
          status: string;
          location_name: string;
          remarks: string | null;
          photo_url: string | null;
          created_at: string;
        }>;
      }>;
      /** Dispatcher operational logs (staff only; omitted for customers). */
      operational_logs?: Array<{
        id: number;
        trip_id: number;
        booking_id: number;
        dispatcher_id: number;
        dispatcher_name: string | null | undefined;
        report_type: string;
        report_type_label: string;
        priority_level: string;
        operational_details: string;
        attachment_url: string | null;
        created_at: string | null;
      }>;
      general_operational_reports?: Array<{
        id: number;
        trip_id: number;
        booking_id: number;
        driver_id: number;
        driver_name: string | null | undefined;
        category: string;
        category_label: string;
        trip_status: string | null;
        trip_status_label: string | null;
        report_date: string;
        starting_odometer_km: number | null;
        ending_odometer_km: number | null;
        fuel_consumed: number | null;
        description: string;
        notes: string | null;
        attachment_url: string | null;
        created_at: string | null;
      }>;
    }>(`/bookings/${id}/tracking-details`),
  cancelBooking: (id: number) => apiPost<{ status: string }>(`/bookings/${id}/cancel`),

  customerCurrentBookings: () => apiGet<CustomerBookingRow[]>("/customer/current-bookings"),
  customerBookingHistory: () => apiGet<CustomerBookingHistoryRow[]>("/customer/booking-history"),
  customerShipmentTracking: () => apiGet<{ shipments: CustomerBookingRow[] }>("/customer/shipment-tracking"),
  customerCancelBooking: (id: number) => apiPatch<{ status: string }>(`/customer/bookings/${id}/cancel`, {}),

  // Workflow API
  workflowCreateBooking: (payload: Record<string, unknown>) =>
    apiPost<Booking>("/workflow/booking/create", payload),
  pendingApprovals: () => apiGet<Booking[]>("/workflow/booking/pending-approval"),
  /** Approved bookings ready for dispatcher assignment (empty until managers approve). */
  assignableBookings: () => apiGet<Booking[]>("/workflow/booking/assignable"),
  approveBooking: (id: number, approved: boolean, reason?: string) =>
    apiPost<Booking>(`/workflow/booking/${id}/approve`, { approved, rejection_reason: reason }),
  createJobFromBooking: (id: number) => apiPost<Trip>(`/workflow/job/create-from-booking/${id}`),

  // Trip
  getTrip: (trip_id: number) => apiGet<Trip>(`/workflow/job/${trip_id}`),

  // Driver
  myTrips: () => apiGet<Trip[]>("/driver/trips"),
  driverDashboardSummary: () => apiGet<DriverDashboardSummary>("/driver/dashboard-summary"),
  driverPaySummary: () => apiGet<DriverPaySummary>("/driver/pay-summary"),
  driverVehicleIssueSelectableTrips: () =>
    apiGet<{ trips: DriverVehicleIssueSelectableTrip[] }>("/driver/vehicle-issue/trips"),
  driverSubmitVehicleIssueReport: (formData: FormData) =>
    apiPostMultipart<DriverVehicleIssueReportResponse>("/driver/vehicle-issue-reports", formData),
  driverGeneralOperationalFormTrips: () =>
    apiGet<{ trips: DriverVehicleIssueSelectableTrip[] }>("/driver/general-operational-form/trips"),
  driverSubmitGeneralOperationalReport: (formData: FormData) =>
    apiPostMultipart<DriverGeneralOperationalReportResponse>("/driver/general-operational-reports", formData),
  driverSalary: () => apiGet<Record<string, unknown>>("/driver/salary"),
  driverCheckIn: () =>
    apiPost<{ checked_in: boolean; timestamp: string }>("/driver/attendance/check-in", {}),
  driverCheckOut: () =>
    apiPost<{ checked_out: boolean; timestamp: string }>("/driver/attendance/check-out", {}),
  acceptJob: (trip_id: number) => apiPost<Trip>(`/workflow/job/${trip_id}/accept`),
  depart: (trip_id: number, opts?: { location_name?: string; notes?: string }) =>
    apiPost<Trip>(`/workflow/job/${trip_id}/depart`, {
      status: "departed",
      location_name: opts?.location_name,
      notes: opts?.notes,
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
  submitPaymentProof: (booking_id: number, method: string, file: File) => {
    const fd = new FormData();
    fd.append("booking_id", String(booking_id));
    fd.append("method", method);
    fd.append("file", file);
    return apiPostMultipart<Payment>("/payments/submit-proof", fd);
  },
  verifyPayment: (payment_id: number) => apiPost<Payment>(`/payments/${payment_id}/verify`, {}),
  rejectPayment: (payment_id: number) => apiPost<Payment>(`/payments/${payment_id}/reject`, {}),
  payBooking: (booking_id: number, method: string, amount: number) =>
    apiPost<Payment>("/payments", { booking_id, method, amount }),
  refundPayment: (payment_id: number, reason?: string) =>
    apiPost<Payment>(`/payments/${payment_id}/refund`, { reason }),
  bookingPayments: (booking_id: number) => apiGet<Payment[]>(`/payments/booking/${booking_id}`),

  // Feedback
  submitFeedback: (payload: {
    booking_id?: number | null;
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
  /** Gantt-style timeline (trips, maintenance, holds, conflicts). */
  scheduleTimeline: (params?: {
    start?: string;
    mode?: "day" | "week";
    resource?: "truck" | "driver";
    status?: string;
    q?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.start) q.set("start", params.start);
    if (params?.mode) q.set("mode", params.mode);
    if (params?.resource) q.set("resource", params.resource);
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    const qs = q.toString();
    return apiGet<ScheduleTimelineResponse>(`/schedule/timeline${qs ? `?${qs}` : ""}`);
  },
  scheduleTimelineTripDetail: (tripId: number) =>
    apiGet<ScheduleTimelineTripDetail>(`/schedule/timeline/trip/${tripId}`),
  availability: (scheduled_date: string) =>
    apiGet(`/schedule/availability?scheduled_date=${encodeURIComponent(scheduled_date)}`),

  // Dispatch
  dispatchBookingAvailability: (booking_id: number) =>
    apiGet<{
      booking_id: number;
      required_truck_count: number;
      cargo_weight_tons: number;
      weight_splits: number[];
      trucks: { id: number; code: string; capacity_tons: number }[];
      drivers: { id: number; name: string }[];
      helpers: { id: number; name: string }[];
    }>(`/dispatch/booking/${booking_id}/availability`),
  dispatchAssignBatch: (
    booking_id: number,
    assignments: Array<{ truck_id: number; driver_id: number; helper_id: number; assigned_weight: number }>,
  ) =>
    apiPost<{ booking_id: number; trip_ids: number[]; assigned_count: number }>(`/dispatch/${booking_id}/assign-batch`, {
      assignments,
    }),
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

  dispatchRoster: () =>
    apiGet<{
      trucks: { id: number; code: string; capacity_tons: number }[];
      drivers: { id: number; name: string }[];
      helpers: { id: number; name: string }[];
    }>("/dispatch/roster"),

  dispatchAssignmentsBoard: () =>
    apiGet<{
      assignments: Array<{
        trip_id: number;
        trip_status: string;
        booking_id: number;
        customer_id: number;
        customer_name: string | null;
        customer_company_name: string | null;
        pickup_location: string;
        dropoff_location: string;
        scheduled_date: string;
        scheduled_time_slot: string;
        cargo_weight_tons: number;
        estimated_cost: number;
        booking_status: string;
        paid_amount_verified?: number | null;
        truck_id: number | null;
        truck_code: string;
        driver_id: number | null;
        driver_name: string | null;
        helper_id: number | null;
        helper_name: string | null;
        helper_progress_status: string | null;
        distance_km: number;
        latest_location: string | null;
        last_updated: string | null;
      }>;
    }>("/dispatch/assignments-board"),

  dispatchTripMonitoringBoard: () => apiGet<DispatchTripMonitoringBoardResponse>("/dispatch/trip-monitoring-board"),

  dispatchVehicleIssueReports: () =>
    apiGet<{ reports: DispatchVehicleIssueReportRow[] }>("/dispatch/vehicle-issue-reports"),
  dispatchVehicleIssueReportUpdate: (report_id: number, status: "reviewed" | "resolved") =>
    apiPatch<{ id: number; status: string }>(`/dispatch/vehicle-issue-reports/${report_id}`, { status }),

  dispatchGeneralOperationalReports: (params?: { booking_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.booking_id != null) q.set("booking_id", String(params.booking_id));
    const qs = q.toString();
    return apiGet<{ reports: GeneralOperationalReportRow[] }>(
      `/dispatch/general-operational-reports${qs ? `?${qs}` : ""}`,
    );
  },

  dispatchFleetAssets: () =>
    apiGet<{
      drivers: Array<{
        id: number;
        name: string;
        phone: string;
        rating: number;
        completed_trips: number;
        status: "on_trip" | "available";
        assigned_truck_code?: string;
      }>;
      trucks: Array<{
        id: number;
        plate: string;
        model_name: string;
        capacity_tons: number;
        status: string;
        db_status: string;
        odometer_km: number;
        age_years: number;
        assigned_driver_name: string | null;
        assigned_driver_id: number | null;
      }>;
    }>("/dispatch/fleet-assets"),

  driverAssignedBookings: () => apiGet<{ bookings: CrewAssignedBookingRow[] }>("/driver/bookings"),

  helperListBookings: () => apiGet<{ bookings: CrewAssignedBookingRow[] }>("/helper/bookings"),

  helperSubmitProgress: (trip_id: number, fd: FormData) =>
    apiPostMultipart<{
      trip_id: number;
      status: string;
      trip_status: string;
      photo_path: string | null;
      location_updates_submitted: number;
      required_location_updates: number;
    }>(`/helper/trips/${trip_id}/status`, fd),
  helperSubmitLocation: (trip_id: number, fd: FormData) =>
    apiPostMultipart<{
      trip_id: number;
      location_updates_submitted: number;
      required_location_updates: number;
    }>(`/helper/trips/${trip_id}/location`, fd),
};
