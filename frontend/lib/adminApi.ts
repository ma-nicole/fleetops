import { apiGet, apiPatch, apiPost } from "./api";

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
};
