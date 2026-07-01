import { decodeJwtSubject } from "./api";
import { getEffectiveRole, type UserRole } from "./auth";
import type { PanelFilters } from "./analyticsStatistics";

const SYSTEM_VERSION = "1.0.0";
const SYSTEM_NAME = "FleetOpts Logistics Management System";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  dispatcher: "Dispatcher",
  driver: "Driver",
  helper: "Helper",
  customer: "Customer",
};

export type ReportExportContext = {
  systemName: string;
  systemVersion: string;
  moduleName: string;
  reportName: string;
  generatedBy: string;
  userRole: string;
  generatedAt: Date;
};

export function getReportExportContext(moduleName: string, reportName: string): ReportExportContext {
  const role = getEffectiveRole();
  let generatedBy = "System User";
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (token) {
      const sub = decodeJwtSubject(token);
      if (sub) generatedBy = sub;
    }
    try {
      const cached = localStorage.getItem("customer_current_user");
      if (cached) {
        const parsed = JSON.parse(cached) as { full_name?: string; email?: string };
        if (parsed.full_name?.trim()) generatedBy = parsed.full_name.trim();
        else if (parsed.email?.trim()) generatedBy = parsed.email.trim();
      }
    } catch {
      /* ignore */
    }
  }

  return {
    systemName: SYSTEM_NAME,
    systemVersion: SYSTEM_VERSION,
    moduleName,
    reportName,
    generatedBy,
    userRole: role ? ROLE_LABELS[role] : "User",
    generatedAt: new Date(),
  };
}

export function formatPanelFiltersForReport(
  filters: PanelFilters,
  selectionLabel?: string,
  extra?: string[],
): string[] {
  const lines: string[] = [];
  if (selectionLabel) lines.push(`Chart selection: ${selectionLabel}`);
  if (filters.dateFrom) lines.push(`Date from: ${filters.dateFrom}`);
  if (filters.dateTo) lines.push(`Date to: ${filters.dateTo}`);
  if (filters.year) lines.push(`Year: ${filters.year}`);
  if (filters.quarter) lines.push(`Quarter: ${filters.quarter}`);
  if (filters.month) lines.push(`Month: ${filters.month}`);
  if (filters.week) lines.push(`Week: ${filters.week}`);
  if (filters.day) lines.push(`Day: ${filters.day}`);
  if (filters.route) lines.push(`Route: ${filters.route}`);
  if (filters.driverId) lines.push(`Driver ID: ${filters.driverId}`);
  if (filters.truckId) lines.push(`Truck ID: ${filters.truckId}`);
  if (filters.clientId) lines.push(`Client ID: ${filters.clientId}`);
  if (filters.status) lines.push(`Status: ${filters.status.replace(/_/g, " ")}`);
  if (extra?.length) lines.push(...extra);
  if (!lines.length) lines.push("No additional filters applied.");
  return lines;
}

export function inferReportPeriod(filters: PanelFilters): string {
  if (filters.dateFrom && filters.dateTo) return `${filters.dateFrom} to ${filters.dateTo}`;
  if (filters.month) return filters.month;
  if (filters.quarter) return filters.quarter;
  if (filters.year) return filters.year;
  return "All available data";
}
