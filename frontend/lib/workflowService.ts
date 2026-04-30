import { api } from "./api";

export interface Booking {
  id: number;
  customer_id: number;
  pickup_location: string;
  dropoff_location: string;
  service_type: string;
  scheduled_date: string;
  cargo_weight_tons: number;
  cargo_description?: string;
  estimated_cost: number;
  actual_cost?: number;
  status: string;
  approved_by_id?: number;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: number;
  booking_id: number;
  truck_id: number;
  driver_id: number;
  dispatcher_id?: number;
  route_path: string;
  distance_km: number;
  toll_cost: number;
  fuel_cost: number;
  labor_cost: number;
  duration_hours: number;
  status: string;
  assigned_at?: string;
  accepted_at?: string;
  departure_time?: string;
  arrival_pickup_time?: string;
  loading_start_time?: string;
  loading_end_time?: string;
  departure_delivery_time?: string;
  arrival_delivery_time?: string;
  completed_at?: string;
  proof_of_delivery?: string;
  pod_notes?: string;
  current_latitude?: number;
  current_longitude?: number;
  estimated_delivery_time?: string;
  created_at: string;
  updated_at: string;
}

export interface TripIssue {
  id: number;
  trip_id: number;
  reported_by_id: number;
  issue_type: string;
  description: string;
  severity: string;
  resolved: boolean;
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
}

// Booking endpoints
export const createBookingRequest = (bookingData: any) =>
  api.post("/workflow/booking/create", bookingData);

export const getPendingBookings = () =>
  api.get("/workflow/booking/pending-approval");

export const approveBooking = (bookingId: number, approved: boolean, rejectionReason?: string) =>
  api.post(`/workflow/booking/${bookingId}/approve`, {
    approved,
    rejection_reason: rejectionReason,
  });

// Job creation
export const createJobFromBooking = (bookingId: number) =>
  api.post(`/workflow/job/create-from-booking/${bookingId}`);

// Driver actions
export const acceptJob = (tripId: number) =>
  api.post(`/workflow/job/${tripId}/accept`);

export const departToPickup = (tripId: number, latitude?: number, longitude?: number) =>
  api.post(`/workflow/job/${tripId}/depart`, {
    status: "departed",
    latitude,
    longitude,
  });

export const arrivedAtPickup = (tripId: number) =>
  api.post(`/workflow/job/${tripId}/arrived-pickup`, {
    status: "loading",
  });

export const loadingComplete = (tripId: number) =>
  api.post(`/workflow/job/${tripId}/loading-complete`);

export const completeDelivery = (tripId: number, proofUrl?: string, notes?: string) =>
  api.post(`/workflow/job/${tripId}/complete`, {
    proof_url: proofUrl,
    notes,
  });

export const updateTripStatus = (tripId: number, status: string, latitude?: number, longitude?: number) =>
  api.post(`/workflow/job/${tripId}/update-status`, {
    status,
    latitude,
    longitude,
  });

export const getTripDetails = (tripId: number) =>
  api.get(`/workflow/job/${tripId}`);

// Cancellation
export const requestCancellation = (bookingId: number) =>
  api.post(`/workflow/booking/${bookingId}/cancel`);

// Issues
export const reportIssue = (tripId: number, issueType: string, description: string, severity?: string) =>
  api.post(`/workflow/job/${tripId}/report-issue`, {
    issue_type: issueType,
    description,
    severity: severity || "medium",
  });

export const getTripIssues = (tripId: number) =>
  api.get(`/workflow/job/${tripId}/issues`);

export const resolveIssue = (issueId: number, resolutionNotes?: string) =>
  api.post(`/workflow/issue/${issueId}/resolve`, {
    resolution_notes: resolutionNotes,
  });
