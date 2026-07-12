import { apiGet } from "./api";

export type PlaceSuggestion = {
  label: string;
  latitude: number;
  longitude: number;
  provider: string;
};

export type GeocodeResult = {
  label: string;
  latitude: number | null;
  longitude: number | null;
  provider: string;
};

export type ReverseGeocodeResult = {
  label: string | null;
  latitude: number;
  longitude: number;
  provider: string;
};

export type PhAdminArea = {
  code: string;
  name: string;
  kind?: string | null;
  region_name?: string | null;
};

export const GeoPlacesApi = {
  search: (q: string, limit = 6) =>
    apiGet<PlaceSuggestion[]>(`/geo/places/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  geocode: (q: string) => apiGet<GeocodeResult>(`/geo/places/geocode?q=${encodeURIComponent(q)}`),
  reverse: (lat: number, lon: number) =>
    apiGet<ReverseGeocodeResult>(`/geo/places/reverse?lat=${lat}&lon=${lon}`),
  regions: () => apiGet<PhAdminArea[]>("/geo/ph/regions"),
  provinces: (regionCode: string) =>
    apiGet<PhAdminArea[]>(`/geo/ph/provinces?region_code=${encodeURIComponent(regionCode)}`),
  cities: (parentCode: string, kind: "province" | "district" = "province") =>
    apiGet<PhAdminArea[]>(
      `/geo/ph/cities?parent_code=${encodeURIComponent(parentCode)}&kind=${encodeURIComponent(kind)}`,
    ),
  barangays: (cityCode: string) =>
    apiGet<PhAdminArea[]>(`/geo/ph/barangays?city_code=${encodeURIComponent(cityCode)}`),
};
