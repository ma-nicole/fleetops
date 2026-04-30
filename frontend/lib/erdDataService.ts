export type Truck = {
  plate_number: string;
  truck_type: string;
  capacity: number;
};

export type TruckSchedule = {
  id: string;
  truck_id: string;
  trip_id: string;
  schedule_start: string;
  schedule_end: string;
  schedule_status: "scheduled" | "ongoing" | "completed";
};

export type Route = {
  id: string;
  origin: string;
  destination: string;
  estimated_distance: number;
  eta: string;
};

export type Customer = {
  id: string;
  name: string;
  address: string;
  contact: string;
  balance: number;
  type: string;
};

export type Broker = {
  id: string;
  name: string;
  salary: number;
  date_employed: string;
};

export type Transaction = {
  id: string;
  customer_id: string;
  broker_id?: string;
  type: string;
  create_time: string;
  creation_time: string;
  cancellation_time?: string;
};

export type Trip = {
  id: string;
  transaction_id: string;
  route_id: string;
  truck_id: string;
  driver_name: string;
  helper_name: string;
  trip_status: "pending" | "confirmed" | "scheduled" | "assigned" | "ongoing" | "completed";
  departure_time?: string;
  arrival_time?: string;
};

export type FuelRecord = {
  id: string;
  trip_id: string;
  truck_id: string;
  liters_used: number;
  fuel_cost: number;
  recorded_date: string;
};

export type TollRecord = {
  id: string;
  trip_id: string;
  toll_amount: number;
};

export type MaintenanceReport = {
  id: string;
  truck_id: string;
  report_type: string;
  description: string;
  report_date: string;
  cost: number;
};

export type Payment = {
  id: string;
  transaction_id: string;
  payment_method: string;
  payment_status: "paid" | "failed" | "pending";
  amount_paid: number;
  payment_date: string;
};

export type Stock = {
  id: string;
  transaction_id: string;
  name: string;
};

type DataStore = {
  trucks: Truck[];
  truckSchedules: TruckSchedule[];
  trips: Trip[];
  routes: Route[];
  transactions: Transaction[];
  customers: Customer[];
  brokers: Broker[];
  fuelRecords: FuelRecord[];
  tollRecords: TollRecord[];
  maintenanceReports: MaintenanceReport[];
  payments: Payment[];
  stocks: Stock[];
};

const storageKey = "fleetops_erd_store";

function nowIso() {
  return new Date().toISOString();
}

const seed: DataStore = {
  trucks: [
    { plate_number: "TRK-001", truck_type: "Van", capacity: 8 },
    { plate_number: "TRK-002", truck_type: "Wing Van", capacity: 15 },
  ],
  truckSchedules: [],
  trips: [],
  routes: [],
  transactions: [],
  customers: [],
  brokers: [{ id: "BRK-001", name: "Default Broker", salary: 30000, date_employed: "2024-01-15" }],
  fuelRecords: [],
  tollRecords: [],
  maintenanceReports: [],
  payments: [],
  stocks: [],
};

function readStore(): DataStore {
  if (typeof window === "undefined") return seed;
  const raw = localStorage.getItem(storageKey);
  return raw ? (JSON.parse(raw) as DataStore) : seed;
}

function saveStore(store: DataStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(store));
}

function nextId(prefix: string, list: { id: string }[]) {
  return `${prefix}-${String(list.length + 1).padStart(4, "0")}`;
}

export class ERDDataService {
  static getStore() {
    return readStore();
  }

  static upsertCustomer(data: Omit<Customer, "id" | "balance"> & { id?: string; balance?: number }): Customer {
    const store = readStore();
    if (data.id) {
      const idx = store.customers.findIndex((c) => c.id === data.id);
      if (idx >= 0) {
        store.customers[idx] = { ...store.customers[idx], ...data, balance: data.balance ?? store.customers[idx].balance };
        saveStore(store);
        return store.customers[idx];
      }
    }
    const customer: Customer = {
      id: nextId("CUS", store.customers as { id: string }[]),
      name: data.name,
      address: data.address,
      contact: data.contact,
      balance: data.balance ?? 0,
      type: data.type,
    };
    store.customers.unshift(customer);
    saveStore(store);
    return customer;
  }

  static createTransaction(customerId: string, type = "booking", brokerId?: string): Transaction {
    const store = readStore();
    const trx: Transaction = {
      id: nextId("TRX", store.transactions),
      customer_id: customerId,
      broker_id: brokerId || store.brokers[0]?.id,
      type,
      create_time: nowIso(),
      creation_time: nowIso(),
    };
    store.transactions.unshift(trx);
    saveStore(store);
    return trx;
  }

  static createRoute(origin: string, destination: string, estimatedDistance = 0, eta = ""): Route {
    const store = readStore();
    const route: Route = {
      id: nextId("RTE", store.routes),
      origin,
      destination,
      estimated_distance: estimatedDistance,
      eta: eta || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };
    store.routes.unshift(route);
    saveStore(store);
    return route;
  }

  static createTripFromTransaction(params: {
    transactionId: string;
    routeId: string;
    truckId: string;
    driverName: string;
    helperName: string;
    status?: Trip["trip_status"];
  }): Trip {
    const store = readStore();
    const trip: Trip = {
      id: nextId("TRP", store.trips),
      transaction_id: params.transactionId,
      route_id: params.routeId,
      truck_id: params.truckId,
      driver_name: params.driverName,
      helper_name: params.helperName,
      trip_status: params.status || "scheduled",
    };
    store.trips.unshift(trip);
    const schedule: TruckSchedule = {
      id: nextId("SCH", store.truckSchedules),
      truck_id: params.truckId,
      trip_id: trip.id,
      schedule_start: nowIso(),
      schedule_end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      schedule_status: "scheduled",
    };
    store.truckSchedules.unshift(schedule);
    saveStore(store);
    return trip;
  }

  static updateTripStatus(tripId: string, status: Trip["trip_status"]): Trip | null {
    const store = readStore();
    const idx = store.trips.findIndex((t) => t.id === tripId);
    if (idx < 0) return null;
    const departureStatuses: Trip["trip_status"][] = ["ongoing", "completed"];
    store.trips[idx] = {
      ...store.trips[idx],
      trip_status: status,
      departure_time: departureStatuses.includes(status) ? store.trips[idx].departure_time || nowIso() : store.trips[idx].departure_time,
      arrival_time: status === "completed" ? nowIso() : store.trips[idx].arrival_time,
    };
    const schIdx = store.truckSchedules.findIndex((s) => s.trip_id === tripId);
    if (schIdx >= 0) {
      store.truckSchedules[schIdx].schedule_status =
        status === "completed" ? "completed" : status === "ongoing" ? "ongoing" : "scheduled";
    }
    saveStore(store);
    return store.trips[idx];
  }

  static addFuelRecord(tripId: string, truckId: string, liters: number, cost: number): FuelRecord {
    const store = readStore();
    const rec: FuelRecord = {
      id: nextId("FUEL", store.fuelRecords),
      trip_id: tripId,
      truck_id: truckId,
      liters_used: liters,
      fuel_cost: cost,
      recorded_date: nowIso(),
    };
    store.fuelRecords.unshift(rec);
    saveStore(store);
    return rec;
  }

  static addTollRecord(tripId: string, amount: number): TollRecord {
    const store = readStore();
    const rec: TollRecord = {
      id: nextId("TOLL", store.tollRecords),
      trip_id: tripId,
      toll_amount: amount,
    };
    store.tollRecords.unshift(rec);
    saveStore(store);
    return rec;
  }

  static createPayment(transactionId: string, method: string, amount: number, status: Payment["payment_status"] = "paid"): Payment {
    const store = readStore();
    const payment: Payment = {
      id: nextId("PAY", store.payments),
      transaction_id: transactionId,
      payment_method: method,
      payment_status: status,
      amount_paid: amount,
      payment_date: nowIso(),
    };
    store.payments.unshift(payment);
    saveStore(store);
    return payment;
  }

  static getTransactionBundle(transactionId: string) {
    const store = readStore();
    const transaction = store.transactions.find((t) => t.id === transactionId);
    if (!transaction) return null;
    const customer = store.customers.find((c) => c.id === transaction.customer_id) || null;
    const trip = store.trips.find((t) => t.transaction_id === transactionId) || null;
    const route = trip ? store.routes.find((r) => r.id === trip.route_id) || null : null;
    const payment = store.payments.find((p) => p.transaction_id === transactionId) || null;
    const fuel = trip ? store.fuelRecords.filter((f) => f.trip_id === trip.id) : [];
    const toll = trip ? store.tollRecords.filter((t) => t.trip_id === trip.id) : [];
    return { transaction, customer, trip, route, payment, fuel, toll };
  }
}

