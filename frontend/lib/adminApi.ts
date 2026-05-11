import { apiGet, apiPatch, apiPost, apiPut } from "./api";

export type AdminUser = {
  id: number;
  email: string;
  full_name: string;
  role: "driver" | "helper" | "dispatcher" | "manager" | "admin" | "customer";
  phone: string | null;
  failed_login_count: number;
  is_locked: boolean;
  locked_until: string | null;
  created_at: string | null;
};

export type AdminStats = {
  total_users: number;
  by_role: Record<string, number>;
  locked_accounts: number;
  total_failed_logins: number;
};

export type AdminBookingFreightSettings = {
  id: number;
  diesel_price_php_per_liter: number;
  toll_fees_php_per_trip: number;
  updated_at: string | null;
};

export type AdminTruck = {
  id: number;
  code: string;
  model_name: string | null;
  capacity_tons: number;
  status: string;
  fuel_efficiency_kmpl: number;
  odometer_km: number;
  age_years: number;
  last_maintenance_date: string | null;
};

export const adminApi = {
  listUsers: () => apiGet<AdminUser[]>("/admin/users"),
  createUser: (data: {
    email: string;
    full_name: string;
    role: AdminUser["role"];
    phone?: string;
    password: string;
  }) => apiPost<AdminUser>("/admin/users", data),
  updateUser: (
    id: number,
    data: { full_name?: string; role?: AdminUser["role"]; phone?: string }
  ) => apiPatch<AdminUser>(`/admin/users/${id}`, data),
  lockUser: (id: number) => apiPost<AdminUser>(`/admin/users/${id}/lock`),
  unlockUser: (id: number) => apiPost<AdminUser>(`/admin/users/${id}/unlock`),

  getStats: () => apiGet<AdminStats>("/admin/stats"),

  getBookingFreightSettings: () => apiGet<AdminBookingFreightSettings>("/admin/booking-freight-settings"),

  saveBookingFreightSettings: (
    body: Omit<AdminBookingFreightSettings, "id" | "updated_at">,
  ) => apiPut<AdminBookingFreightSettings>("/admin/booking-freight-settings", body),

  listTrucks: () => apiGet<AdminTruck[]>("/admin/trucks"),

  createTruck: (body: {
    model_name: string;
    plate_number: string;
    capacity_tons: number;
    status: string;
    age_years: number;
  }) => apiPost<AdminTruck>("/admin/trucks", body),
};
