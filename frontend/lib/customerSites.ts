/**
 * Saved site addresses for customers — persisted on the API per logged-in customer
 * so they survive sign-out/sign-in (unlike legacy browser-only storage).
 *
 * Migrates `fleetopt_customer_sites_v1` once when the account has no server rows yet.
 */

import { ApiError, apiDelete, apiGet, apiPost } from "./api";
import { AUTH_CHANGE_EVENT } from "./auth";
import { validateCustomerSiteStructuredFields, type CustomerSiteAddressPartsInput } from "./formValidation";

export const MIN_BOOKING_SITES = 2;
export const SITES_CHANGED_EVENT = "fleetopt-customer-sites-changed";

const LEGACY_STORAGE_KEY = "fleetopt_customer_sites_v1";

export type CustomerSite = {
  id: string;
  address: string;
  label?: string;
  street?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  postalCode?: string;
};

type SavedSiteDTO = {
  id: number;
  address: string;
  label: string | null;
  street: string | null;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  postal_code: string | null;
};

type LegacyCustomerSite = {
  id: string;
  address: string;
  label?: string;
};

function dtoToSite(d: SavedSiteDTO): CustomerSite {
  const address = String(d.address).trim();
  return {
    id: String(d.id),
    address,
    ...(d.label && String(d.label).trim() ? { label: String(d.label).trim() } : {}),
    ...(d.street && String(d.street).trim() ? { street: String(d.street).trim() } : {}),
    ...(d.barangay && String(d.barangay).trim() ? { barangay: String(d.barangay).trim() } : {}),
    ...(d.city_municipality && String(d.city_municipality).trim()
      ? { cityMunicipality: String(d.city_municipality).trim() }
      : {}),
    ...(d.province && String(d.province).trim() ? { province: String(d.province).trim() } : {}),
    ...(d.postal_code && String(d.postal_code).trim() ? { postalCode: String(d.postal_code).trim() } : {}),
  };
}

function emitSitesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SITES_CHANGED_EVENT));
}

function readLegacySites(): LegacyCustomerSite[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is LegacyCustomerSite =>
          row != null &&
          typeof row === "object" &&
          "id" in row &&
          "address" in row &&
          typeof (row as LegacyCustomerSite).id === "string" &&
          typeof (row as LegacyCustomerSite).address === "string",
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

async function fetchSitesFromApi(): Promise<CustomerSite[]> {
  const rows = await apiGet<SavedSiteDTO[]>("/customer/sites");
  return rows.map(dtoToSite);
}

async function migrateLegacyThenRefresh(): Promise<CustomerSite[]> {
  const legacy = readLegacySites();
  if (legacy.length === 0) {
    return [];
  }
  for (const s of legacy) {
    await apiPost<SavedSiteDTO>("/customer/sites", {
      address: s.address.trim(),
      label: s.label?.trim() ? s.label.trim() : null,
    }).catch(() => undefined);
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  const after = await fetchSitesFromApi();
  emitSitesChanged();
  return after;
}

/** Load sites from API; migrates legacy localStorage once when the account has zero server rows. */
export async function loadCustomerSites(): Promise<CustomerSite[]> {
  try {
    let sites = await fetchSitesFromApi();
    if (sites.length === 0) {
      const migrated = await migrateLegacyThenRefresh();
      if (migrated.length > 0) {
        sites = migrated;
      }
    }
    return sites;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      return [];
    }
    throw e;
  }
}

export async function addCustomerSite(
  parts: CustomerSiteAddressPartsInput,
  label?: string,
): Promise<{ ok: true; site: CustomerSite } | { ok: false; message: string }> {
  const v = validateCustomerSiteStructuredFields(parts);
  if (v) {
    return { ok: false, message: v };
  }
  try {
    const row = await apiPost<SavedSiteDTO>("/customer/sites", {
      label: label?.trim() ? label.trim() : null,
      street: parts.street.trim(),
      barangay: parts.barangay.trim(),
      city_municipality: parts.cityMunicipality.trim(),
      province: parts.province.trim(),
      postal_code: parts.postalCode.trim(),
    });
    const site = dtoToSite(row);
    emitSitesChanged();
    return { ok: true, site };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.message };
    return { ok: false, message: e instanceof Error ? e.message : "Could not save site." };
  }
}

export async function removeCustomerSite(id: string): Promise<void> {
  await apiDelete(`/customer/sites/${encodeURIComponent(id)}`);
  emitSitesChanged();
}

export function subscribeSitesChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => handler();
  const onAuth = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === "token" ||
      e.key === "authToken" ||
      e.key === "userRole" ||
      e.key === LEGACY_STORAGE_KEY
    ) {
      handler();
    }
  };
  window.addEventListener(SITES_CHANGED_EVENT, onCustom);
  window.addEventListener(AUTH_CHANGE_EVENT, onAuth);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SITES_CHANGED_EVENT, onCustom);
    window.removeEventListener(AUTH_CHANGE_EVENT, onAuth);
    window.removeEventListener("storage", onStorage);
  };
}
