/**
 * Distance estimate (keyword fallback) + freight pricing matching backend `customer_freight_pricing`.
 */

import { bookingPricingKnobs } from "@/lib/bookingPricingEnv";

export type BookingEstimateBreakdown = {
  distanceKm: number;
  dieselLiters: number;
  dieselCostPhp: number;
  wearMiscPhp: number;
  depreciationPhp: number;
  helperPayPhp: number;
  freightBasePhp: number;
  fuelRouteCharge: number;
  subtotalBeforeDriver: number;
  dieselPricePerLiter: number;
  driverCommissionPct: number;
  driverFee: number;
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
  pasay: { lat: 14.5378, lon: 120.995 },
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

export function estimateUsesGeocodedBoth(pickup: string, dropoff: string): boolean {
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

export function estimateDistanceKm(pickup: string, dropoff: string): number {
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

function weightFactorTons(weightTons: number, coef: number): number {
  const w =
    Number.isFinite(weightTons) && weightTons > 0 ? Math.min(50, Math.max(0.1, weightTons)) : 1;
  return 1 + Math.max(0, w - 1) * coef;
}

/** Same math as backend `customer_freight_pricing` using `bookingPricingKnobs()`. */
export function freightPricingFromKm(kmRaw: number, weightTonsRaw: number): BookingEstimateBreakdown {
  const knobs = bookingPricingKnobs();
  const km = Number(kmRaw);
  const wf = weightFactorTons(weightTonsRaw, knobs.cargoWeightMultiplierPerTon);
  const kmpl = Math.max(1.5, knobs.truckKmPerLiter);
  const liters = Math.max(0, (km * wf) / kmpl);
  const dieselCost = liters * knobs.dieselPricePhpPerLiter;
  const wear = km * knobs.tripWearPhpPerKm * wf;
  const core = dieselCost + wear;
  const depreciation = core * knobs.tripDepreciationRate;
  const opsStack = core + depreciation;
  const freightBase = opsStack + knobs.helperPhpPerTrip;
  const driverFee = Math.round(freightBase * knobs.driverCommissionRate * 100) / 100;
  const total = Math.round((freightBase + driverFee) * 100) / 100;

  return {
    distanceKm: Math.round(km * 10) / 10,
    dieselLiters: Math.round(liters * 100) / 100,
    dieselCostPhp: Math.round(dieselCost * 100) / 100,
    wearMiscPhp: Math.round(wear * 100) / 100,
    depreciationPhp: Math.round(depreciation * 100) / 100,
    helperPayPhp: Math.round(knobs.helperPhpPerTrip * 100) / 100,
    freightBasePhp: Math.round(freightBase * 100) / 100,
    fuelRouteCharge: Math.round(freightBase * 100) / 100,
    subtotalBeforeDriver: Math.round(freightBase * 100) / 100,
    dieselPricePerLiter: Math.round(knobs.dieselPricePhpPerLiter * 100) / 100,
    driverCommissionPct: Math.round(knobs.driverCommissionRate * 10000) / 100,
    driverFee,
    total,
  };
}

export function estimateBookingCost(
  pickup: string,
  dropoff: string,
  weightTons: number,
): BookingEstimateBreakdown | null {
  const p = pickup.trim();
  const d = dropoff.trim();
  if (p.length < 3 || d.length < 3) return null;
  if (p.toLowerCase() === d.toLowerCase()) return null;

  const w = Number.isFinite(weightTons) && weightTons > 0 ? Math.min(50, weightTons) : 1;
  const km = estimateDistanceKm(p, d);
  return freightPricingFromKm(km, w);
}
