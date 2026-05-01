/**
 * Philippine defaults for FleetOpt — formatting only (safe on server & client).
 * Dates use Philippine capital timezone (Asia/Manila); amounts use PHP.
 */

export const APP_LOCALE = "en-PH";
export const APP_TIMEZONE = "Asia/Manila";

export function formatPhp(amount: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

/** Pesos in tables/KPIs where whole pesos read cleaner. */
export function formatPhpWhole(amount: number): string {
  return formatPhp(amount, { maximumFractionDigits: 0 });
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(APP_LOCALE, options).format(value);
}

export function formatDateTime(
  iso: string | Date | number | null | undefined,
  dateStyle: Intl.DateTimeFormatOptions["dateStyle"] = "medium",
  timeStyle: Intl.DateTimeFormatOptions["timeStyle"] = "short"
): string {
  if (iso == null) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    dateStyle,
    timeStyle,
  }).format(d);
}

/** Time-only (dispatch boards). */
export function formatTimeShort(iso: string | Date | null | undefined): string {
  if (iso == null) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
