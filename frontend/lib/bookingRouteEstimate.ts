/**
 * Offline road-km fallback from address text + freight pricing matching backend `customer_freight_pricing`.
 */

import { bookingPricingKnobs } from "@/lib/bookingPricingEnv";
import {
  CARGO_RATE_PHP_PER_TON,
  DRIVER_FREIGHT_SHARE_RATE,
  HELPER_FREIGHT_SHARE_RATE,
  TRUCK_FUEL_KMPL,
  TRUCK_MAX_LOAD_TONS,
} from "@/lib/customerPricingConstants";

export type TruckLoadLineBreakdown = {
  truckIndex: number;
  weightTons: number;
  distanceKm: number;
  cargoGrossPhp: number;
  dieselLiters: number;
  dieselCostPhp: number;
  driverSharePhp: number;
  helperSharePhp: number;
  tollFeesPhp: number;
  additivesTotalPhp: number;
  netProfitPhp: number;
};

export type BookingPricingBreakdown = {
  distanceKm: number;
  weightTons: number;
  totalTrucks: number;
  cargoRatePhpPerTon: number;
  cargoGrossPhp: number;
  dieselLiters: number;
  dieselCostPhp: number;
  driverSharePhp: number;
  helperSharePhp: number;
  tollFeesPhp: number;
  additivesTotalPhp: number;
  netProfitTotalPhp: number;
  dieselPricePerLiter: number;
  driverFreightSharePct: number;
  helperFreightSharePct: number;
  truckLoads: TruckLoadLineBreakdown[];
  /** Same as netProfitTotalPhp — combined net profit across trucks */
  total: number;
};

const METRO_CENTER = { lat: 14.5995, lon: 120.9842 };

const NCR_POINTS: Record<string, { lat: number; lon: number }> = {
  makati: { lat: 14.5547, lon: 121.0244 },
  "quezon city": { lat: 14.676, lon: 121.0437 },
  qc: { lat: 14.676, lon: 121.0437 },
  pasig: { lat: 14.5764, lon: 121.0851 },
  taguig: { lat: 14.5176, lon: 121.0509 },
  paranaque: { lat: 14.4793, lon: 121.0198 },
  parañaque: { lat: 14.4793, lon: 121.0198 },
  manila: { lat: 14.5995, lon: 120.9842 },
  mandaluyong: { lat: 14.5794, lon: 121.0359 },
  marikina: { lat: 14.6507, lon: 121.1029 },
  caloocan: { lat: 14.6576, lon: 120.9842 },
  "las pinas": { lat: 14.445, lon: 120.9842 },
  "las piñas": { lat: 14.445, lon: 120.9842 },
  muntinlupa: { lat: 14.4081, lon: 121.0415 },
  valenzuela: { lat: 14.7, lon: 120.9833 },
  malabon: { lat: 14.6622, lon: 120.9563 },
  navotas: { lat: 14.65, lon: 120.95 },
  pasay: { lat: 14.5375, lon: 120.995 },
  "san juan": { lat: 14.6016, lon: 121.0354 },
  pateros: { lat: 14.545, lon: 121.0715 },
  antipolo: { lat: 14.6214, lon: 121.1247 },
  cavite: { lat: 14.4793, lon: 120.897 },
  batangas: { lat: 13.7565, lon: 121.0583 },
  bulacan: { lat: 14.7927, lon: 120.8788 },
  rizal: { lat: 14.7668, lon: 121.1448 },
  rodriguez: { lat: 14.7668, lon: 121.1448 },
  montalban: { lat: 14.7668, lon: 121.1448 },
  laguna: { lat: 14.2167, lon: 121.1667 },
  "santa rosa": { lat: 14.3122, lon: 121.1115 },
  pampanga: { lat: 15.0794, lon: 120.6199 },
  "san fernando": { lat: 15.0292, lon: 120.6828 },
  bataan: { lat: 14.6794, lon: 120.5369 },
  "nueva ecija": { lat: 15.4865, lon: 121.0072 },
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ñ/g, "n")
    .replace(/\s+/g, " ");
}

function findCoord(input: string): { lat: number; lon: number } | null {
  const k = normalizeKey(input);
  if (NCR_POINTS[k]) return NCR_POINTS[k];
  for (const [key, val] of Object.entries(NCR_POINTS)) {
    if (k === key || k.includes(key) || key.includes(k)) return val;
  }
  const parts = k.split(/[\s,]+/).filter((p) => p.length > 2);
  for (const part of parts) {
    if (NCR_POINTS[part]) return NCR_POINTS[part];
    for (const [key, val] of Object.entries(NCR_POINTS)) {
      if (part.length >= 4 && (key.includes(part) || part.includes(key))) return val;
    }
  }
  return null;
}

/** True when the text matches a built-in reference point (better distance accuracy). */
export function hasResolvedRoutePoint(address: string): boolean {
  return findCoord(address.trim()) !== null;
}

export function routeUsesGeocodedPinsBoth(pickup: string, dropoff: string): boolean {
  return hasResolvedRoutePoint(pickup) && hasResolvedRoutePoint(dropoff);
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const ROAD_FACTOR = 1.28;

function heuristicKm(pickup: string, dropoff: string): number {
  const a = pickup.toLowerCase().charCodeAt(0) || 0;
  const b = dropoff.toLowerCase().charCodeAt(0) || 0;
  const raw = Math.abs(a - b) * 2.2 + 18;
  return Math.min(140, Math.max(8, Math.round(raw * 10) / 10));
}

export function fallbackRoadKmFromText(pickup: string, dropoff: string): number {
  const p = findCoord(pickup);
  const d = findCoord(dropoff);
  if (p && d) {
    const crow = haversineKm(p, d);
    if (crow < 0.001 && normalizeKey(pickup) !== normalizeKey(dropoff)) {
      return heuristicKm(pickup, dropoff);
    }
    return Math.round(crow * ROAD_FACTOR * 10) / 10;
  }
  if (p && !d) {
    const crow = haversineKm(p, METRO_CENTER);
    return Math.round(crow * ROAD_FACTOR * 10) / 10;
  }
  if (!p && d) {
    const crow = haversineKm(METRO_CENTER, d);
    return Math.round(crow * ROAD_FACTOR * 10) / 10;
  }
  return heuristicKm(pickup, dropoff);
}

/** Split booking weight into loads of at most `cap` metric tons (default 42). */
export function splitCargoIntoTruckLoads(totalTons: number, cap: number = TRUCK_MAX_LOAD_TONS): number[] {
  if (!Number.isFinite(totalTons) || totalTons <= 0) return [];
  const c = Math.max(0, cap);
  if (c <= 0) return [];
  let remaining = Math.round(totalTons * 1e6) / 1e6;
  const loads: number[] = [];
  while (remaining > 1e-9) {
    const chunk = Math.min(c, remaining);
    loads.push(Math.round(chunk * 1e4) / 1e4);
    remaining = Math.round((remaining - chunk) * 1e6) / 1e6;
  }
  return loads;
}

function profitLineOneTruck(
  km: number,
  tons: number,
  dieselPl: number,
  toll: number,
  truckIndex: number,
): TruckLoadLineBreakdown {
  const w = Math.min(TRUCK_MAX_LOAD_TONS, Math.max(0, tons));
  const gross = w * CARGO_RATE_PHP_PER_TON;
  const kmpl = Math.max(0.5, TRUCK_FUEL_KMPL);
  const liters = Math.max(0, km / kmpl);
  const fuel = liters * dieselPl;
  const driver = gross * DRIVER_FREIGHT_SHARE_RATE;
  const helper = gross * HELPER_FREIGHT_SHARE_RATE;
  const additives = fuel + driver + helper + toll;
  const net = gross + additives;
  return {
    truckIndex,
    weightTons: Math.round(w * 1e4) / 1e4,
    distanceKm: Math.round(km * 100) / 100,
    cargoGrossPhp: Math.round(gross * 100) / 100,
    dieselLiters: Math.round(liters * 100) / 100,
    dieselCostPhp: Math.round(fuel * 100) / 100,
    driverSharePhp: Math.round(driver * 100) / 100,
    helperSharePhp: Math.round(helper * 100) / 100,
    tollFeesPhp: Math.round(toll * 100) / 100,
    additivesTotalPhp: Math.round(additives * 100) / 100,
    netProfitPhp: Math.round(net * 100) / 100,
  };
}

function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return Math.round(rows.reduce((a, r) => a + pick(r), 0) * 100) / 100;
}

/** Same math as backend `customer_freight_pricing` using `bookingPricingKnobs()`. */
export function freightPricingFromKm(kmRaw: number, weightTonsRaw: number): BookingPricingBreakdown {
  const knobs = bookingPricingKnobs();
  const km = Number(kmRaw);
  const wBooking =
    Number.isFinite(weightTonsRaw) && weightTonsRaw > 0 ? Math.min(168, Math.max(0.1, weightTonsRaw)) : 0.1;

  const loads = splitCargoIntoTruckLoads(wBooking);
  const weightChunks = loads.length ? loads : [Math.round(wBooking * 1e4) / 1e4];

  const truckLoads = weightChunks.map((tons, i) =>
    profitLineOneTruck(km, tons, knobs.dieselPricePhpPerLiter, knobs.tollFeesPhpPerTrip, i + 1),
  );

  const cargoRate = CARGO_RATE_PHP_PER_TON;
  const netTotal = sumBy(truckLoads, (r) => r.netProfitPhp);

  return {
    distanceKm: Math.round(km * 10) / 10,
    weightTons: wBooking,
    totalTrucks: truckLoads.length,
    cargoRatePhpPerTon: Math.round(cargoRate * 100) / 100,
    cargoGrossPhp: sumBy(truckLoads, (r) => r.cargoGrossPhp),
    dieselLiters: sumBy(truckLoads, (r) => r.dieselLiters),
    dieselCostPhp: sumBy(truckLoads, (r) => r.dieselCostPhp),
    driverSharePhp: sumBy(truckLoads, (r) => r.driverSharePhp),
    helperSharePhp: sumBy(truckLoads, (r) => r.helperSharePhp),
    tollFeesPhp: sumBy(truckLoads, (r) => r.tollFeesPhp),
    additivesTotalPhp: sumBy(truckLoads, (r) => r.additivesTotalPhp),
    netProfitTotalPhp: netTotal,
    dieselPricePerLiter: Math.round(knobs.dieselPricePhpPerLiter * 100) / 100,
    driverFreightSharePct: Math.round(DRIVER_FREIGHT_SHARE_RATE * 10000) / 100,
    helperFreightSharePct: Math.round(HELPER_FREIGHT_SHARE_RATE * 10000) / 100,
    truckLoads,
    total: netTotal,
  };
}

export function computeOfflineBookingPricing(
  pickup: string,
  dropoff: string,
  weightTons: number,
): BookingPricingBreakdown | null {
  const p = pickup.trim();
  const d = dropoff.trim();
  if (p.length < 3 || d.length < 3) return null;
  if (p.toLowerCase() === d.toLowerCase()) return null;

  const w = Number.isFinite(weightTons) && weightTons > 0 ? Math.min(168, weightTons) : 1;
  const km = fallbackRoadKmFromText(p, d);
  return freightPricingFromKm(km, w);
}
