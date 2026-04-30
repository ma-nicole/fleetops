// Booking status flow: Pending Approval → Approved → Assigned → Accepted → Enroute → Loading → Out for Delivery → Completed

export type BookingStatus = 
  | "pending_approval"
  | "approved"
  | "rejected"
  | "assigned"
  | "accepted"
  | "enroute"
  | "loading"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export interface Booking {
  id: string;
  userId: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  
  // Booking Details
  pickupLocation: string;
  dropoffLocation: string;
  shipmentDate: string;
  cargoWeight: string;
  cargoDescription: string;
  totalCost: number;
  
  // Service Details
  truck?: {
    id: string;
    name: string;
    capacity_tons: number;
    price_per_km: number;
  };
  service?: {
    id: string;
    name: string;
    base_price: number;
  };
  
  // Manager Review
  managerId?: string;
  approvalNotes?: string;
  approvalTime?: string;
  
  // Dispatcher Assignment
  dispatcherId?: string;
  driverId?: string;
  truckAssignedId?: string;
  routePlan?: {
    waypoints: Array<{ location: string; eta: string; }>;
    estimatedDistance: number;
    estimatedDuration: number;
  };
  
  // Driver Execution
  currentLocation?: string;
  currentETA?: string;
  pickupTime?: string;
  loadingStartTime?: string;
  departureTime?: string;
  deliveryTime?: string;
  proofOfDelivery?: string;
  
  // Exception Handling
  exceptionType?: "breakdown" | "traffic_delay" | "other";
  exceptionDetails?: string;
  exceptionReportedAt?: string;
  
  // Cancellation
  cancellationReason?: string;
  cancellationTime?: string;
  cancellationRequested?: boolean;
  cancellationRequestedAt?: string;
  closedByManager?: boolean;
  closedAt?: string;
  notificationLog?: string[];
}

/**
 * BookingService - Manages booking lifecycle from creation to completion
 */
export class BookingService {
  private static pushNotification(booking: Booking, message: string): void {
    const currentLog = booking.notificationLog || [];
    booking.notificationLog = [...currentLog, `${new Date().toISOString()}|${message}`];
  }

  private static storageKey = "bookings";
  private static nextIdKey = "bookings_next_id";

  /**
   * Get all bookings from localStorage
   */
  static getAllBookings(): Booking[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Get bookings by user ID
   */
  static getBookingsByUser(userId: string): Booking[] {
    return this.getAllBookings().filter(b => b.userId === userId);
  }

  /**
   * Get bookings by status
   */
  static getBookingsByStatus(status: BookingStatus): Booking[] {
    return this.getAllBookings().filter(b => b.status === status);
  }

  /**
   * Get a single booking by ID
   */
  static getBooking(id: string): Booking | undefined {
    return this.getAllBookings().find(b => b.id === id);
  }

  /**
   * Get next booking ID
   */
  private static getNextId(): string {
    if (typeof window === "undefined") return "BK-00001";
    let nextId = localStorage.getItem(this.nextIdKey);
    let num = nextId ? parseInt(nextId) + 1 : 1;
    localStorage.setItem(this.nextIdKey, num.toString());
    return `BK-${String(num).padStart(5, "0")}`;
  }

  /**
   * Create a new booking (status: pending_approval)
   */
  static createBooking(
    userId: string,
    pickupLocation: string,
    dropoffLocation: string,
    shipmentDate: string,
    cargoWeight: string,
    cargoDescription: string,
    totalCost: number,
    truck?: any,
    service?: any
  ): Booking {
    const booking: Booking = {
      id: this.getNextId(),
      userId,
      status: "pending_approval",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pickupLocation,
      dropoffLocation,
      shipmentDate,
      cargoWeight,
      cargoDescription,
      totalCost,
      truck,
      service,
      notificationLog: [],
    };

    this.pushNotification(booking, "Booking created and submitted for manager approval.");
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Save or update a booking
   */
  static saveBooking(booking: Booking): void {
    if (typeof window === "undefined") return;
    const bookings = this.getAllBookings();
    const index = bookings.findIndex(b => b.id === booking.id);
    
    booking.updatedAt = new Date().toISOString();
    
    if (index >= 0) {
      bookings[index] = booking;
    } else {
      bookings.push(booking);
    }

    localStorage.setItem(this.storageKey, JSON.stringify(bookings));
  }

  /**
   * Manager approves or rejects booking
   */
  static managerReviewBooking(
    bookingId: string,
    managerId: string,
    approved: boolean,
    notes: string = ""
  ): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking) return null;

    booking.status = approved ? "approved" : "rejected";
    booking.managerId = managerId;
    booking.approvalNotes = notes;
    booking.approvalTime = new Date().toISOString();
    
    this.pushNotification(
      booking,
      approved
        ? "Booking approved by manager. Waiting for dispatcher assignment."
        : "Booking rejected by manager."
    );

    this.saveBooking(booking);
    return booking;
  }

  /**
   * Dispatcher assigns truck and driver
   */
  static dispatcherAssignJob(
    bookingId: string,
    dispatcherId: string,
    driverId: string,
    truckId: string,
    routePlan: {
      waypoints: Array<{ location: string; eta: string; }>;
      estimatedDistance: number;
      estimatedDuration: number;
    }
  ): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.status !== "approved") return null;

    booking.status = "assigned";
    booking.dispatcherId = dispatcherId;
    booking.driverId = driverId;
    booking.truckAssignedId = truckId;
    booking.routePlan = routePlan;
    booking.cancellationRequested = false;
    this.pushNotification(booking, "Truck and driver assigned by dispatcher.");
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Driver accepts the job
   */
  static driverAcceptJob(bookingId: string, driverId: string): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.status !== "assigned" || booking.driverId !== driverId) return null;

    booking.status = "accepted";
    this.pushNotification(booking, "Driver accepted the job.");
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Driver departs to pickup
   */
  static driverDepartToPickup(bookingId: string, driverId: string, currentLocation: string): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.driverId !== driverId) return null;

    booking.status = "enroute";
    booking.departureTime = new Date().toISOString();
    booking.currentLocation = currentLocation;
    booking.currentETA = booking.routePlan?.waypoints[0]?.eta || new Date().toISOString();
    this.pushNotification(booking, "Driver enroute to pickup.");
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Driver arrives and starts loading
   */
  static driverStartLoading(bookingId: string, driverId: string, currentLocation: string): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.driverId !== driverId) return null;

    booking.status = "loading";
    booking.pickupTime = new Date().toISOString();
    booking.loadingStartTime = new Date().toISOString();
    booking.currentLocation = currentLocation;
    this.pushNotification(booking, "Driver arrived at pickup. Loading started.");
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Driver departs for delivery
   */
  static driverDepartForDelivery(bookingId: string, driverId: string, currentLocation: string): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.driverId !== driverId) return null;

    booking.status = "out_for_delivery";
    booking.departureTime = new Date().toISOString();
    booking.currentLocation = currentLocation;
    booking.currentETA = booking.routePlan?.waypoints[booking.routePlan.waypoints.length - 1]?.eta || new Date().toISOString();
    this.pushNotification(booking, "Cargo loaded. Out for delivery.");
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Driver marks delivery as completed
   */
  static driverCompleteDelivery(
    bookingId: string,
    driverId: string,
    currentLocation: string,
    proofOfDelivery?: string
  ): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.driverId !== driverId) return null;

    booking.status = "completed";
    booking.deliveryTime = new Date().toISOString();
    booking.currentLocation = currentLocation;
    booking.proofOfDelivery = proofOfDelivery;
    this.pushNotification(booking, "Delivery completed. Receipt is now available.");
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * User requests cancellation
   */
  static requestCancellation(bookingId: string, userId: string, reason: string): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.userId !== userId) return null;

    // Can only cancel if not already in execution
    if (["enroute", "loading", "out_for_delivery", "completed"].includes(booking.status)) {
      return null;
    }

    booking.cancellationRequested = true;
    booking.cancellationRequestedAt = new Date().toISOString();
    booking.cancellationReason = reason;
    this.pushNotification(booking, "Cancellation requested by customer. Awaiting manager approval.");
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Manager cancels booking
   */
  static managerCancelBooking(bookingId: string, managerId: string, reason: string): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking) return null;

    booking.status = "cancelled";
    booking.cancellationReason = reason;
    booking.cancellationTime = new Date().toISOString();
    booking.cancellationRequested = false;
    booking.driverId = undefined;
    booking.truckAssignedId = undefined;
    booking.routePlan = undefined;
    this.pushNotification(booking, "Cancellation confirmed by manager. Assignment released.");
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Driver reports an exception
   */
  static reportException(
    bookingId: string,
    driverId: string,
    type: "breakdown" | "traffic_delay" | "other",
    details: string
  ): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.driverId !== driverId) return null;

    booking.exceptionType = type;
    booking.exceptionDetails = details;
    booking.exceptionReportedAt = new Date().toISOString();
    this.pushNotification(booking, `Driver reported issue: ${type.replace("_", " ")}.`);
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Dispatcher updates route due to exception
   */
  static updateRouteForException(
    bookingId: string,
    dispatcherId: string,
    newRoutePlan: {
      waypoints: Array<{ location: string; eta: string; }>;
      estimatedDistance: number;
      estimatedDuration: number;
    }
  ): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.dispatcherId !== dispatcherId) return null;

    booking.routePlan = newRoutePlan;
    booking.exceptionType = undefined;
    booking.exceptionDetails = undefined;
    booking.currentETA = newRoutePlan.waypoints[newRoutePlan.waypoints.length - 1]?.eta;
    this.pushNotification(booking, "Dispatcher updated route plan and ETA.");
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Update driver's current location and ETA
   */
  static updateDriverLocation(bookingId: string, driverId: string, location: string, eta: string): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.driverId !== driverId) return null;

    booking.currentLocation = location;
    booking.currentETA = eta;
    this.pushNotification(booking, `Location updated: ${location}.`);
    
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Manager closes completed job
   */
  static managerCloseJob(bookingId: string, managerId: string): Booking | null {
    const booking = this.getBooking(bookingId);
    if (!booking || booking.status !== "completed") return null;
    booking.managerId = managerId;
    booking.closedByManager = true;
    booking.closedAt = new Date().toISOString();
    this.pushNotification(booking, "Job closed by manager.");
    this.saveBooking(booking);
    return booking;
  }

  /**
   * Get booking status label for UI
   */
  static getStatusLabel(status: BookingStatus): string {
    const labels: Record<BookingStatus, string> = {
      pending_approval: "⏳ Pending Approval",
      approved: "✅ Approved",
      rejected: "❌ Rejected",
      assigned: "📋 Assigned",
      accepted: "👍 Accepted",
      enroute: "🚗 Enroute",
      loading: "📦 Loading",
      out_for_delivery: "🚚 Out for Delivery",
      completed: "✨ Completed",
      cancelled: "❌ Cancelled",
    };
    return labels[status] || status;
  }

  /**
   * Get booking status color for UI
   */
  static getStatusColor(status: BookingStatus): string {
    const colors: Record<BookingStatus, string> = {
      pending_approval: "#FFC107",
      approved: "#4CAF50",
      rejected: "#F44336",
      assigned: "#2196F3",
      accepted: "#00BCD4",
      enroute: "#FF9800",
      loading: "#9C27B0",
      out_for_delivery: "#E91E63",
      completed: "#4CAF50",
      cancelled: "#757575",
    };
    return colors[status] || "#666";
  }
}

export default BookingService;
