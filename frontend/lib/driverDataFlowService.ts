import { ERDDataService } from "./erdDataService";

export type DriverFlowStatus = "pending" | "confirmed" | "scheduled" | "ongoing" | "completed" | "cancelled";

export type DriverFlowBooking = {
  id: string;
  customerName: string;
  pickup: string;
  dropoff: string;
  load: string;
  createdAt: string;
  confirmedBy?: string;
  assignedDriver?: string;
  status: DriverFlowStatus;
};

export type DriverFlowReport = {
  id: string;
  bookingId: string;
  generatedAt: string;
  tripDetails: string;
  costs: string;
  status: DriverFlowStatus;
  driverActivity: string;
  final: boolean;
};

const bookingsKey = "driver_flow_bookings";
const reportsKey = "driver_flow_reports";

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export class DriverDataFlowService {
  static getBookings(): DriverFlowBooking[] {
    return readStorage<DriverFlowBooking[]>(bookingsKey, []);
  }

  static createBooking(payload: Omit<DriverFlowBooking, "id" | "createdAt" | "status">): DriverFlowBooking {
    const bookings = this.getBookings();
    const booking: DriverFlowBooking = {
      id: `DF-${String(bookings.length + 1).padStart(4, "0")}`,
      createdAt: new Date().toISOString(),
      status: "pending",
      ...payload,
    };
    const updated = [booking, ...bookings];
    writeStorage(bookingsKey, updated);
    return booking;
  }

  /**
   * Booking DB check for driver flow:
   * - If booking does not exist, create it as pending.
   * - If booking exists, confirm the order and keep current assignment.
   */
  static ensureBookingEntry(
    payload: Omit<DriverFlowBooking, "id" | "createdAt" | "status">,
    dispatcherName: string
  ): DriverFlowBooking {
    const existing = this.getBookings().find(
      (item) =>
        item.customerName.toLowerCase() === payload.customerName.toLowerCase() &&
        item.pickup.toLowerCase() === payload.pickup.toLowerCase() &&
        item.dropoff.toLowerCase() === payload.dropoff.toLowerCase() &&
        item.load.toLowerCase() === payload.load.toLowerCase()
    );

    if (!existing) {
      return this.createBooking(payload);
    }

    return (
      this.confirmOrder(existing.id, dispatcherName, existing.assignedDriver || payload.assignedDriver || "Unassigned") ||
      existing
    );
  }

  static confirmOrder(bookingId: string, dispatcher: string, assignedDriver: string): DriverFlowBooking | null {
    const bookings = this.getBookings();
    const index = bookings.findIndex((b) => b.id === bookingId);
    if (index < 0) return null;
    bookings[index] = {
      ...bookings[index],
      confirmedBy: dispatcher,
      assignedDriver,
      status: "confirmed",
    };
    writeStorage(bookingsKey, bookings);
    const erdStore = ERDDataService.getStore();
    const matchingTransaction = erdStore.transactions[0];
    if (matchingTransaction && !erdStore.trips.some((t) => t.transaction_id === matchingTransaction.id)) {
      const route = ERDDataService.createRoute(bookings[index].pickup, bookings[index].dropoff, 0, "");
      ERDDataService.createTripFromTransaction({
        transactionId: matchingTransaction.id,
        routeId: route.id,
        truckId: "TRK-001",
        driverName: assignedDriver,
        helperName: "helper-001",
        status: "assigned",
      });
    }
    return bookings[index];
  }

  static updateStatus(bookingId: string, status: DriverFlowStatus): DriverFlowBooking | null {
    const bookings = this.getBookings();
    const index = bookings.findIndex((b) => b.id === bookingId);
    if (index < 0) return null;
    bookings[index] = { ...bookings[index], status };
    writeStorage(bookingsKey, bookings);
    const erdStore = ERDDataService.getStore();
    const trip = erdStore.trips.find((t) => t.driver_name === (bookings[index].assignedDriver || ""));
    if (trip) {
      const mapped =
        status === "confirmed"
          ? "confirmed"
          : status === "scheduled"
          ? "scheduled"
          : status === "ongoing"
          ? "ongoing"
          : status === "completed"
          ? "completed"
          : status === "cancelled"
          ? "cancelled"
          : "pending";
      ERDDataService.updateTripStatus(trip.id, mapped);
      if (status === "ongoing") {
        ERDDataService.addFuelRecord(trip.id, trip.truck_id, 18, 42);
        ERDDataService.addTollRecord(trip.id, 12);
      }
    }
    return bookings[index];
  }

  static getReports(): DriverFlowReport[] {
    return readStorage<DriverFlowReport[]>(reportsKey, []);
  }

  static generateReport(bookingId: string): DriverFlowReport | null {
    const booking = this.getBookings().find((b) => b.id === bookingId);
    if (!booking) return null;
    const reports = this.getReports();
    const report: DriverFlowReport = {
      id: `RPT-${String(reports.length + 1).padStart(4, "0")}`,
      bookingId: booking.id,
      generatedAt: new Date().toISOString(),
      tripDetails: `${booking.pickup} -> ${booking.dropoff} (${booking.load})`,
      costs: booking.status === "completed" ? "$420.00" : "$300.00 (estimated)",
      status: booking.status,
      driverActivity: booking.assignedDriver ? `Driver ${booking.assignedDriver} updated status to ${booking.status}.` : "No driver activity yet.",
      final: booking.status === "completed",
    };
    writeStorage(reportsKey, [report, ...reports]);
    return report;
  }
}

