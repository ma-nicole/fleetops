export type AdminSchedule = {
  id: string;
  route: string;
  driver: string;
  vehicle: string;
  startTime: string;
  eta: string;
  status: "scheduled" | "enroute" | "completed";
};

export type AdminTrip = {
  id: string;
  scheduleId: string;
  driver: string;
  vehicle: string;
  location: string;
  eta: string;
  status: "enroute" | "delayed" | "completed";
};

export type AdminOrder = {
  id: string;
  customer: string;
  route: string;
  driver: string;
  vehicle: string;
  amount: number;
  fuelCost: number;
  tollFee: number;
  paymentStatus: "paid" | "pending";
};

const schedulesKey = "admin_schedules";
const tripsKey = "admin_trips";
const ordersKey = "admin_orders";

const seededSchedules: AdminSchedule[] = [
  { id: "SCH-001", route: "Makati → Quezon City", driver: "driver-001", vehicle: "TRK-001", startTime: "08:30", eta: "10:30", status: "enroute" },
  { id: "SCH-002", route: "Pasig → Taguig", driver: "driver-002", vehicle: "TRK-002", startTime: "09:00", eta: "11:00", status: "scheduled" },
  { id: "SCH-003", route: "Paranaque → Manila", driver: "driver-003", vehicle: "TRK-003", startTime: "07:30", eta: "09:00", status: "completed" },
];

const seededTrips: AdminTrip[] = [
  { id: "TRIP-001", scheduleId: "SCH-001", driver: "driver-001", vehicle: "TRK-001", location: "EDSA Northbound", eta: "10:30", status: "enroute" },
  { id: "TRIP-002", scheduleId: "SCH-002", driver: "driver-002", vehicle: "TRK-002", location: "C5 Corridor", eta: "11:15", status: "delayed" },
  { id: "TRIP-003", scheduleId: "SCH-003", driver: "driver-003", vehicle: "TRK-003", location: "Delivered", eta: "09:00", status: "completed" },
];

const seededOrders: AdminOrder[] = [
  { id: "ORD-001", customer: "ABC Retail", route: "Makati → Quezon City", driver: "driver-001", vehicle: "TRK-001", amount: 540, fuelCost: 95, tollFee: 24, paymentStatus: "paid" },
  { id: "ORD-002", customer: "Metro Foods", route: "Pasig → Taguig", driver: "driver-002", vehicle: "TRK-002", amount: 420, fuelCost: 88, tollFee: 20, paymentStatus: "pending" },
  { id: "ORD-003", customer: "Nova Hardware", route: "Paranaque → Manila", driver: "driver-003", vehicle: "TRK-003", amount: 390, fuelCost: 76, tollFee: 17, paymentStatus: "paid" },
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export class AdminFlowService {
  static init() {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(schedulesKey)) writeJson(schedulesKey, seededSchedules);
    if (!localStorage.getItem(tripsKey)) writeJson(tripsKey, seededTrips);
    if (!localStorage.getItem(ordersKey)) writeJson(ordersKey, seededOrders);
  }

  static getSchedules(): AdminSchedule[] {
    this.init();
    return readJson<AdminSchedule[]>(schedulesKey, seededSchedules);
  }

  static saveSchedules(schedules: AdminSchedule[]) {
    writeJson(schedulesKey, schedules);
    const trips = schedules.map((s) => ({
      id: `TRIP-${s.id.split("-")[1]}`,
      scheduleId: s.id,
      driver: s.driver,
      vehicle: s.vehicle,
      location: s.status === "completed" ? "Delivered" : "On route",
      eta: s.eta,
      status: s.status === "scheduled" ? "enroute" : s.status,
    })) as AdminTrip[];
    writeJson(tripsKey, trips);
  }

  static getTrips(): AdminTrip[] {
    this.init();
    return readJson<AdminTrip[]>(tripsKey, seededTrips);
  }

  static getOrders(): AdminOrder[] {
    this.init();
    return readJson<AdminOrder[]>(ordersKey, seededOrders);
  }

  static getKpis() {
    const trips = this.getTrips();
    const orders = this.getOrders();
    const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
    const totalFuel = orders.reduce((sum, o) => sum + o.fuelCost, 0);
    const totalToll = orders.reduce((sum, o) => sum + o.tollFee, 0);
    return {
      totalSchedules: this.getSchedules().length,
      ongoingTrips: trips.filter((t) => t.status !== "completed").length,
      completedTrips: trips.filter((t) => t.status === "completed").length,
      totalRevenue,
      totalFuel,
      totalToll,
      paidOrders: orders.filter((o) => o.paymentStatus === "paid").length,
    };
  }
}

