import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

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

export type PricingConfig = {
  id: number;
  service_type: string;
  base_rate: number;
  labor_rate: number;
  helper_rate: number;
};

export type PasswordResetResponse = {
  user_id: number;
  email: string;
  temporary_password: string;
  message: string;
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
  resetPassword: (id: number) =>
    apiPost<PasswordResetResponse>(`/admin/users/${id}/reset-password`),
  lockUser: (id: number) => apiPost<AdminUser>(`/admin/users/${id}/lock`),
  unlockUser: (id: number) => apiPost<AdminUser>(`/admin/users/${id}/unlock`),
  deleteUser: (id: number) => apiDelete<{ deleted: true }>(`/admin/users/${id}`),

  getStats: () => apiGet<AdminStats>("/admin/stats"),

  listPricing: () => apiGet<PricingConfig[]>("/admin/pricing"),
  updatePricing: (
    id: number,
    data: { base_rate?: number; labor_rate?: number; helper_rate?: number }
  ) => apiPatch<PricingConfig>(`/admin/pricing/${id}`, data),
};
