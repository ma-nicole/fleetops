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
  confirmationCheckedAt?: string;
};

export type CustomerPayment = {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  method: string;
  status: "paid" | "failed";
  paidAt: string;
  reference: string;
};

export type CustomerFeedback = {
  id: string;
  bookingId: string;
  userId: string;
  message: string;
  rating: number;
  createdAt: string;
  receiptMessage: string;
  emailSentAt: string;
};

const usersKey = "customer_users_data";
const bookingsKey = "customer_bookings_data";
const paymentsKey = "customer_payments_data";
const feedbackKey = "customer_feedback_data";
const currentUserKey = "customer_current_user";
const currentBookingKey = "customer_current_booking";
const lastReceiptKey = "customer_last_receipt";

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
    if (!fullName.trim()) return { ok: false, message: "Full name is required." };
    if (!email.trim()) return { ok: false, message: "Email is required." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { ok: false, message: "Please enter a valid email address." };
    if (password.trim().length < 6) return { ok: false, message: "Password must be at least 6 characters." };

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
    if (!email.trim() || !password.trim()) return { ok: false, message: "Email and password are required." };

    // Users DB lookup during login.
    const user = this.getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return { ok: false, message: "Account not found. Please register first." };
    if (user.password !== password) return { ok: false, message: "Invalid email or password." };

    write(currentUserKey, user);
    return { ok: true, message: "Login successful." };
  }

  static getCurrentUser(): CustomerUser | null {
    return read<CustomerUser | null>(currentUserKey, null);
  }

  static createBooking(
    serviceType: string,
    pickup: string,
    dropoff: string,
    load: string
  ): { ok: boolean; message: string; booking: CustomerBooking | null } {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return { ok: false, message: "Please login first to create a booking.", booking: null };
    if (!serviceType.trim() || !pickup.trim() || !dropoff.trim() || !load.trim()) {
      return { ok: false, message: "Please complete all booking details.", booking: null };
    }
    if (pickup.trim().toLowerCase() === dropoff.trim().toLowerCase()) {
      return { ok: false, message: "Pickup and dropoff locations must be different.", booking: null };
    }

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
    return { ok: true, message: "Booking saved successfully.", booking };
  }

  static getCurrentBooking(): CustomerBooking | null {
    return read<CustomerBooking | null>(currentBookingKey, null);
  }

  static confirmCurrentBooking(): { ok: boolean; message: string; booking: CustomerBooking | null } {
    const current = this.getCurrentBooking();
    if (!current) return { ok: false, message: "No booking found to confirm.", booking: null };

    // Booking confirmation check before order confirmation.
    if (!current.serviceType || !current.pickup || !current.dropoff || !current.load) {
      return { ok: false, message: "Booking details are incomplete.", booking: null };
    }

    const bookings = this.getBookings();
    const index = bookings.findIndex((b) => b.id === current.id);
    if (index < 0) return { ok: false, message: "Booking record was not found.", booking: null };
    bookings[index] = {
      ...bookings[index],
      status: "confirmed",
      confirmationCheckedAt: new Date().toISOString(),
    };
    write(bookingsKey, bookings);
    write(currentBookingKey, bookings[index]);
    return { ok: true, message: "Booking confirmed.", booking: bookings[index] };
  }

  private static shouldPaymentSucceed(): boolean {
    // Simulate payment processing with occasional failures.
    return Math.random() >= 0.2;
  }

  static payCurrentBooking(
    method: string,
    amount: number
  ): { ok: boolean; message: string; payment: CustomerPayment | null } {
    const currentUser = this.getCurrentUser();
    const booking = this.getCurrentBooking();
    if (!currentUser || !booking) {
      return { ok: false, message: "No confirmed booking found for payment.", payment: null };
    }
    if (booking.status !== "confirmed") {
      return { ok: false, message: "Booking must be confirmed before payment.", payment: null };
    }
    if (!method.trim()) return { ok: false, message: "Please select a payment method.", payment: null };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Invalid payment amount.", payment: null };

    const payments = this.getPayments();
    const isSuccess = this.shouldPaymentSucceed();
    const paidAt = new Date().toISOString();
    const payment: CustomerPayment = {
      id: `PAY-${String(payments.length + 1).padStart(4, "0")}`,
      bookingId: booking.id,
      userId: currentUser.id,
      amount,
      method,
      status: isSuccess ? "paid" : "failed",
      paidAt,
      reference: `TXN-${Date.now()}`,
    };
    write(paymentsKey, [payment, ...payments]);
    const store = ERDDataService.getStore();
    const transaction = store.transactions.find((t) => t.customer_id === currentUser.id) || ERDDataService.createTransaction(currentUser.id, "payment");
    ERDDataService.createPayment(transaction.id, method, amount, payment.status);
    if (!isSuccess) {
      return { ok: false, message: "Payment failed. Please try again.", payment };
    }

    const receiptMessage = `Receipt ${payment.reference}: Payment of ${amount.toFixed(2)} via ${method} was successful for booking ${booking.id}.`;
    write(lastReceiptKey, receiptMessage);
    return { ok: true, message: "Payment successful.", payment };
  }

  static getPaymentForCurrentBooking(): CustomerPayment | null {
    const booking = this.getCurrentBooking();
    if (!booking) return null;
    return this.getPayments().find((payment) => payment.bookingId === booking.id) || null;
  }

  static getLastReceipt(): string {
    return read<string>(lastReceiptKey, "");
  }

  static saveFeedback(message: string, rating: number): { ok: boolean; message: string; feedback: CustomerFeedback | null } {
    const currentUser = this.getCurrentUser();
    const booking = this.getCurrentBooking();
    const payment = this.getPaymentForCurrentBooking();

    if (!currentUser || !booking) return { ok: false, message: "No booking context found.", feedback: null };
    if (!payment || payment.status !== "paid") {
      return { ok: false, message: "Feedback is available only after successful payment.", feedback: null };
    }
    if (rating < 1 || rating > 5) return { ok: false, message: "Rating must be between 1 and 5.", feedback: null };

    const cleanMessage = message.trim() || "Great service";
    const emailSentAt = new Date().toISOString();
    const receiptMessage =
      this.getLastReceipt() ||
      `Receipt ${payment.reference}: Payment of ${payment.amount.toFixed(2)} via ${payment.method} was successful for booking ${booking.id}.`;

    const items = this.getFeedback();
    const feedback: CustomerFeedback = {
      id: `FDB-${String(items.length + 1).padStart(4, "0")}`,
      bookingId: booking.id,
      userId: currentUser.id,
      message: cleanMessage,
      rating,
      createdAt: emailSentAt,
      receiptMessage,
      emailSentAt,
    };
    write(feedbackKey, [feedback, ...items]);
    return { ok: true, message: "Feedback submitted and receipt emailed.", feedback };
  }
}

