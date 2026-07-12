import { apiDelete, apiGet, apiPost, apiPut } from "./api";

export type TollPlazaAlias = { id: number; alias: string };

export type TollPlazaRow = {
  id: number;
  canonical_name: string;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  corridor?: string | null;
  aliases: TollPlazaAlias[];
  created_at: string;
  updated_at: string;
};

export type TollPlazaPayload = {
  canonical_name: string;
  status: string;
  aliases: string[];
  latitude?: number | null;
  longitude?: number | null;
  corridor?: string | null;
};

export type AdminBookingTollOverridePayload = {
  toll_entry_point: string;
  toll_exit_point: string;
  vehicle_class: string;
  distance_km_override?: number;
};

export const TollPlazaApi = {
  list: () => apiGet<TollPlazaRow[]>("/admin/toll-plazas"),
  create: (payload: TollPlazaPayload) => apiPost<TollPlazaRow>("/admin/toll-plazas", payload),
  update: (id: number, payload: Partial<TollPlazaPayload>) => apiPut<TollPlazaRow>(`/admin/toll-plazas/${id}`, payload),
  remove: (id: number) => apiDelete<{ ok: boolean }>(`/admin/toll-plazas/${id}`),
  options: () => apiGet<{ name: string }[]>("/toll-plazas/options"),
  overrideBookingToll: (bookingId: number, payload: AdminBookingTollOverridePayload) =>
    apiPut<import("@/lib/workflowApi").Booking>(`/bookings/${bookingId}/admin/toll-estimate`, payload),
};
