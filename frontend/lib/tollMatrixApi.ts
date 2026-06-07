import { apiDelete, apiGet, apiPost, apiPut } from "./api";

export type TollMatrixRow = {
  id: number;
  entry_point: string;
  exit_point: string;
  vehicle_class: string;
  toll_fee: number;
  effective_date: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type TollMatrixPayload = {
  entry_point: string;
  exit_point: string;
  vehicle_class: string;
  toll_fee: number;
  effective_date: string;
  status: string;
};

export const TollMatrixApi = {
  list: (status?: string) =>
    apiGet<TollMatrixRow[]>(`/admin/toll-matrix${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  create: (payload: TollMatrixPayload) => apiPost<TollMatrixRow>("/admin/toll-matrix", payload),
  update: (id: number, payload: Partial<TollMatrixPayload>) => apiPut<TollMatrixRow>(`/admin/toll-matrix/${id}`, payload),
  remove: (id: number) => apiDelete<{ ok: boolean }>(`/admin/toll-matrix/${id}`),
};
