import { ERDDataService } from "./erdDataService";

export type CustomerUser = {
  id: string;
  fullName: string;
  email: string;
  password: string;
  createdAt: string;
};

export type CustomerBooking = {
  id: string;
  userId: string;
  serviceType: string;
  pickup: string;
  dropoff: string;
  load: string;
  status: "pending" | "confirmed";
  createdAt: string;
};

export type CustomerPayment = {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  method: string;
  status: "paid" | "failed";
  paidAt: string;
};

export type CustomerFeedback = {
  id: string;
  bookingId: string;
  userId: string;
  message: string;
  rating: number;
  createdAt: string;
};

const usersKey = "customer_users_data";
const bookingsKey = "customer_bookings_data";
const paymentsKey = "customer_payments_data";
const feedbackKey = "customer_feedback_data";
const currentUserKey = "customer_current_user";
const currentBookingKey = "customer_current_booking";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export class CustomerDataFlowService {
  static getUsers(): CustomerUser[] { return read(usersKey, [] as CustomerUser[]); }
  static getBookings(): CustomerBooking[] { return read(bookingsKey, [] as CustomerBooking[]); }
  static getPayments(): CustomerPayment[] { return read(paymentsKey, [] as CustomerPayment[]); }
  static getFeedback(): CustomerFeedback[] { return read(feedbackKey, [] as CustomerFeedback[]); }

  static register(fullName: string, email: string, password: string): { ok: boolean; message: string } {
    const users = this.getUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, message: "Email already registered." };
    }
    const user: CustomerUser = {
      id: `USR-${String(users.length + 1).padStart(4, "0")}`,
      fullName,
      email,
      password,
      createdAt: new Date().toISOString(),
    };
    write(usersKey, [user, ...users]);
    ERDDataService.upsertCustomer({
      name: fullName,
      address: "N/A",
      contact: email,
      type: "customer",
      balance: 0,
    });
    return { ok: true, message: "Registered successfully." };
  }

  static login(email: string, password: string): { ok: boolean; message: string } {
    const user = this.getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return { ok: false, message: "Invalid email or password." };
    write(currentUserKey, user);
    return { ok: true, message: "Login successful." };
  }

  static getCurrentUser(): CustomerUser | null {
    return read<CustomerUser | null>(currentUserKey, null);
  }

  static createBooking(serviceType: string, pickup: string, dropoff: string, load: string): CustomerBooking | null {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return null;
    const bookings = this.getBookings();
    const booking: CustomerBooking = {
      id: `CBK-${String(bookings.length + 1).padStart(4, "0")}`,
      userId: currentUser.id,
      serviceType,
      pickup,
      dropoff,
      load,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const updated = [booking, ...bookings];
    write(bookingsKey, updated);
    write(currentBookingKey, booking);
    const trx = ERDDataService.createTransaction(currentUser.id, "customer_booking");
    const route = ERDDataService.createRoute(pickup, dropoff, 0, "");
    ERDDataService.createTripFromTransaction({
      transactionId: trx.id,
      routeId: route.id,
      truckId: "TRK-001",
      driverName: "Unassigned",
      helperName: "Unassigned",
      status: "pending",
    });
    return booking;
  }

  static getCurrentBooking(): CustomerBooking | null {
    return read<CustomerBooking | null>(currentBookingKey, null);
  }

  static confirmCurrentBooking(): CustomerBooking | null {
    const current = this.getCurrentBooking();
    if (!current) return null;
    const bookings = this.getBookings();
    const index = bookings.findIndex((b) => b.id === current.id);
    if (index < 0) return null;
    bookings[index] = { ...bookings[index], status: "confirmed" };
    write(bookingsKey, bookings);
    write(currentBookingKey, bookings[index]);
    return bookings[index];
  }

  static payCurrentBooking(method: string, amount: number): CustomerPayment | null {
    const currentUser = this.getCurrentUser();
    const booking = this.getCurrentBooking();
    if (!currentUser || !booking) return null;
    const payments = this.getPayments();
    const payment: CustomerPayment = {
      id: `PAY-${String(payments.length + 1).padStart(4, "0")}`,
      bookingId: booking.id,
      userId: currentUser.id,
      amount,
      method,
      status: "paid",
      paidAt: new Date().toISOString(),
    };
    write(paymentsKey, [payment, ...payments]);
    const store = ERDDataService.getStore();
    const transaction = store.transactions.find((t) => t.customer_id === currentUser.id) || ERDDataService.createTransaction(currentUser.id, "payment");
    ERDDataService.createPayment(transaction.id, method, amount, "paid");
    return payment;
  }

  static saveFeedback(message: string, rating: number): CustomerFeedback | null {
    const currentUser = this.getCurrentUser();
    const booking = this.getCurrentBooking();
    if (!currentUser || !booking) return null;
    const items = this.getFeedback();
    const feedback: CustomerFeedback = {
      id: `FDB-${String(items.length + 1).padStart(4, "0")}`,
      bookingId: booking.id,
      userId: currentUser.id,
      message,
      rating,
      createdAt: new Date().toISOString(),
    };
    write(feedbackKey, [feedback, ...items]);
    return feedback;
  }
}

