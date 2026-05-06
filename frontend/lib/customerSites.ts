/**
 * Saved site addresses for customers (browser localStorage).
 * At least {@link MIN_BOOKING_SITES} sites are required before creating a booking.
 */

export const MIN_BOOKING_SITES = 2;
export const SITES_CHANGED_EVENT = "fleetopt-customer-sites-changed";
const STORAGE_KEY = "fleetopt_customer_sites_v1";

export type CustomerSite = {
  id: string;
  address: string;
  label?: string;
};

function readRaw(): CustomerSite[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is CustomerSite =>
          row != null &&
          typeof row === "object" &&
          "id" in row &&
          "address" in row &&
          typeof (row as CustomerSite).id === "string" &&
          typeof (row as CustomerSite).address === "string",
      )
      .map((s) => ({
        id: s.id,
        address: String(s.address).trim(),
        ...(typeof s.label === "string" && s.label.trim() ? { label: s.label.trim() } : {}),
      }))
      .filter((s) => s.address.length >= 3);
  } catch {
    return [];
  }
}

function writeRaw(sites: CustomerSite[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
  window.dispatchEvent(new CustomEvent(SITES_CHANGED_EVENT));
}

export function getCustomerSites(): CustomerSite[] {
  return readRaw();
}

export function addCustomerSite(address: string, label?: string): { ok: true; site: CustomerSite } | { ok: false; message: string } {
  const trimmed = address.trim();
  if (trimmed.length < 3) {
    return { ok: false, message: "Address must be at least 3 characters." };
  }
  const sites = readRaw();
  const site: CustomerSite = {
    id: `site-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    address: trimmed,
    ...(label?.trim() ? { label: label.trim() } : {}),
  };
  writeRaw([...sites, site]);
  return { ok: true, site };
}

export function removeCustomerSite(id: string): void {
  writeRaw(readRaw().filter((s) => s.id !== id));
}

export function hasMinimumSitesForBooking(): boolean {
  return readRaw().length >= MIN_BOOKING_SITES;
}

export function subscribeSitesChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) handler();
  };
  window.addEventListener(SITES_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SITES_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
