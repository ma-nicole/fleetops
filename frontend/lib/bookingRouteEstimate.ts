/**
 * Client-side route estimate for booking analytics (demo / UX).
 * Uses Metro Manila reference points + haversine distance, then:
 * — Fuel & distance charge: ₱/km × km × weight factor
 * — Driver fee: 10% of that subtotal
 * — Total: subtotal + driver fee
 */

export type BookingEstimateBreakdown = {
  distanceKm: number;
  /** Combined fuel + distance-based route charge (pre-driver). */
  fuelRouteCharge: number;
  /** 10% driver fee on subtotal. */
  driverFee: number;
  /** Subtotal before driver cut. */
  subtotalBeforeDriver: number;
  total: number;
};

/** Blended ₱ per km (fuel consumption + route wear) — analytics teaching default. */
const PHP_PER_KM = 16.5;

const DRIVER_COMMISSION_RATE = 0.1;

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

/** Road distance ≈ crow-flies × factor (typical urban). */
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
  const weightFactor = 1 + Math.max(0, w - 1) * 0.07;
  const subtotalBeforeDriver = km * PHP_PER_KM * weightFactor;
  const driverFee = Math.round(subtotalBeforeDriver * DRIVER_COMMISSION_RATE * 100) / 100;
  const total = Math.round((subtotalBeforeDriver + driverFee) * 100) / 100;

  return {
    distanceKm: km,
    fuelRouteCharge: Math.round(subtotalBeforeDriver * 100) / 100,
    driverFee,
    subtotalBeforeDriver: Math.round(subtotalBeforeDriver * 100) / 100,
    total,
  };
}
