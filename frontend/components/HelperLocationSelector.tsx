"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GeoPlacesApi,
  type PhAdminArea,
  type PlaceSuggestion,
} from "@/lib/geoPlacesApi";

export type SelectedHelperLocation = {
  label: string;
  latitude: number;
  longitude: number;
  source: "search" | "map" | "admin";
};

type Mode = "search" | "map" | "admin";

type Props = {
  value: SelectedHelperLocation | null;
  onChange: (next: SelectedHelperLocation | null) => void;
  disabled?: boolean;
};

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Map is only available in the browser."));
      return;
    }
    const w = window as any;
    if (w.L) {
      resolve(w.L);
      return;
    }
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).L));
      existing.addEventListener("error", () => reject(new Error("Failed to load map library.")));
      return;
    }
    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => reject(new Error("Failed to load map library."));
    document.body.appendChild(script);
  });
}

export default function HelperLocationSelector({ value, onChange, disabled = false }: Props) {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [regions, setRegions] = useState<PhAdminArea[]>([]);
  const [provinces, setProvinces] = useState<PhAdminArea[]>([]);
  const [cities, setCities] = useState<PhAdminArea[]>([]);
  const [barangays, setBarangays] = useState<PhAdminArea[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [barangayCode, setBarangayCode] = useState("");
  const [provinceKind, setProvinceKind] = useState<"province" | "district">("province");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const selectedRegion = useMemo(() => regions.find((r) => r.code === regionCode) || null, [regions, regionCode]);
  const selectedProvince = useMemo(
    () => provinces.find((p) => p.code === provinceCode) || null,
    [provinces, provinceCode],
  );
  const selectedCity = useMemo(() => cities.find((c) => c.code === cityCode) || null, [cities, cityCode]);
  const selectedBarangay = useMemo(
    () => barangays.find((b) => b.code === barangayCode) || null,
    [barangays, barangayCode],
  );

  const isComplete = Boolean(value?.label && value.latitude != null && value.longitude != null);

  useEffect(() => {
    let cancelled = false;
    void GeoPlacesApi.regions()
      .then((rows) => {
        if (!cancelled) setRegions(rows);
      })
      .catch(() => {
        if (!cancelled) setAdminError("Could not load PH regions.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!regionCode) {
      setProvinces([]);
      setProvinceCode("");
      return;
    }
    let cancelled = false;
    setAdminBusy(true);
    void GeoPlacesApi.provinces(regionCode)
      .then((rows) => {
        if (cancelled) return;
        setProvinces(rows);
        setProvinceKind((rows[0]?.kind as "province" | "district") || "province");
        setProvinceCode("");
        setCities([]);
        setCityCode("");
        setBarangays([]);
        setBarangayCode("");
      })
      .catch(() => {
        if (!cancelled) setAdminError("Could not load provinces/districts.");
      })
      .finally(() => {
        if (!cancelled) setAdminBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [regionCode]);

  useEffect(() => {
    if (!provinceCode) {
      setCities([]);
      setCityCode("");
      return;
    }
    let cancelled = false;
    setAdminBusy(true);
    void GeoPlacesApi.cities(provinceCode, provinceKind)
      .then((rows) => {
        if (cancelled) return;
        setCities(rows);
        setCityCode("");
        setBarangays([]);
        setBarangayCode("");
      })
      .catch(() => {
        if (!cancelled) setAdminError("Could not load cities/municipalities.");
      })
      .finally(() => {
        if (!cancelled) setAdminBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provinceCode, provinceKind]);

  useEffect(() => {
    if (!cityCode) {
      setBarangays([]);
      setBarangayCode("");
      return;
    }
    let cancelled = false;
    setAdminBusy(true);
    void GeoPlacesApi.barangays(cityCode)
      .then((rows) => {
        if (cancelled) return;
        setBarangays(rows);
        setBarangayCode("");
      })
      .catch(() => {
        if (!cancelled) setAdminError("Could not load barangays.");
      })
      .finally(() => {
        if (!cancelled) setAdminBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cityCode]);

  const applySelection = useCallback(
    (next: SelectedHelperLocation) => {
      onChange(next);
      setSearchError(null);
      setAdminError(null);
      setMapError(null);
    },
    [onChange],
  );

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 3) {
      setSearchError("Enter at least 3 characters to search.");
      return;
    }
    setSearchBusy(true);
    setSearchError(null);
    try {
      const rows = await GeoPlacesApi.search(q);
      setSuggestions(rows);
      if (!rows.length) setSearchError("No matching Philippine addresses found.");
    } catch (e) {
      setSuggestions([]);
      setSearchError(e instanceof Error ? e.message : "Address search failed.");
    } finally {
      setSearchBusy(false);
    }
  }, [query]);

  const applyAdminSelection = useCallback(async () => {
    if (!selectedRegion || !selectedProvince || !selectedCity || !selectedBarangay) {
      setAdminError("Select Region → Province/District → City/Municipality → Barangay.");
      return;
    }
    const label = [
      selectedBarangay.name,
      selectedCity.name,
      selectedProvince.name,
      selectedRegion.name,
      "Philippines",
    ].join(", ");
    setAdminBusy(true);
    setAdminError(null);
    try {
      const geo = await GeoPlacesApi.geocode(label);
      if (geo.latitude == null || geo.longitude == null) {
        setAdminError("Could not resolve coordinates for this address. Try search or map pin.");
        return;
      }
      applySelection({
        label,
        latitude: geo.latitude,
        longitude: geo.longitude,
        source: "admin",
      });
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : "Could not geocode admin selection.");
    } finally {
      setAdminBusy(false);
    }
  }, [selectedRegion, selectedProvince, selectedCity, selectedBarangay, applySelection]);

  // Interactive map for pin selection + preview.
  useEffect(() => {
    if (mode !== "map" && !value) return;
    let cancelled = false;
    let clickHandler: ((e: any) => void) | null = null;

    void (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapHostRef.current) return;
        if (!mapRef.current) {
          const center: [number, number] = value
            ? [value.latitude, value.longitude]
            : [14.5995, 120.9842];
          mapRef.current = L.map(mapHostRef.current).setView(center, value ? 15 : 11);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap",
            maxZoom: 19,
          }).addTo(mapRef.current);
          clickHandler = async (e: any) => {
            if (disabled) return;
            const lat = Number(e.latlng.lat);
            const lon = Number(e.latlng.lng);
            try {
              const rev = await GeoPlacesApi.reverse(lat, lon);
              applySelection({
                label: rev.label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
                latitude: lat,
                longitude: lon,
                source: "map",
              });
            } catch {
              applySelection({
                label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
                latitude: lat,
                longitude: lon,
                source: "map",
              });
            }
          };
          mapRef.current.on("click", clickHandler);
        }
        if (value) {
          if (!markerRef.current) {
            markerRef.current = L.marker([value.latitude, value.longitude]).addTo(mapRef.current);
          } else {
            markerRef.current.setLatLng([value.latitude, value.longitude]);
          }
          mapRef.current.setView([value.latitude, value.longitude], Math.max(mapRef.current.getZoom(), 14));
        }
        setTimeout(() => mapRef.current?.invalidateSize?.(), 50);
      } catch (e) {
        if (!cancelled) setMapError(e instanceof Error ? e.message : "Map unavailable.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, value, disabled, applySelection]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const tabBtn = (id: Mode, label: string) => (
    <button
      key={id}
      type="button"
      disabled={disabled}
      onClick={() => setMode(id)}
      style={{
        padding: "0.4rem 0.7rem",
        borderRadius: 8,
        border: mode === id ? "1px solid #2563EB" : "1px solid #CBD5E1",
        background: mode === id ? "#DBEAFE" : "#fff",
        color: mode === id ? "#1E40AF" : "#334155",
        fontWeight: 700,
        fontSize: "0.78rem",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
        {tabBtn("search", "Search address")}
        {tabBtn("map", "Pick on map")}
        {tabBtn("admin", "Region / Province / City")}
      </div>

      {mode === "search" ? (
        <div style={{ display: "grid", gap: "0.55rem" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: "0.85rem", color: "#555" }}>Search Philippine address</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="input"
                value={query}
                disabled={disabled || searchBusy}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
                placeholder="Street, barangay, city…"
                style={{ flex: "1 1 220px" }}
              />
              <button
                type="button"
                disabled={disabled || searchBusy}
                onClick={() => void runSearch()}
                style={{
                  padding: "0.55rem 0.85rem",
                  borderRadius: 8,
                  border: "none",
                  background: "#2563EB",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: searchBusy ? "wait" : "pointer",
                }}
              >
                {searchBusy ? "Searching…" : "Search"}
              </button>
            </div>
          </label>
          {searchError ? (
            <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: "0.8rem" }}>
              {searchError}
            </p>
          ) : null}
          {suggestions.length > 0 ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
              {suggestions.map((s) => (
                <li key={`${s.label}-${s.latitude}-${s.longitude}`}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      applySelection({
                        label: s.label,
                        latitude: s.latitude,
                        longitude: s.longitude,
                        source: "search",
                      })
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "0.55rem 0.7rem",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: "0.82rem",
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mode === "admin" ? (
        <div style={{ display: "grid", gap: "0.55rem" }}>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            <span>Region</span>
            <select
              className="select"
              disabled={disabled || adminBusy}
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
            >
              <option value="">Select region…</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            <span>{provinceKind === "district" ? "District" : "Province"}</span>
            <select
              className="select"
              disabled={disabled || adminBusy || !regionCode}
              value={provinceCode}
              onChange={(e) => setProvinceCode(e.target.value)}
            >
              <option value="">Select {provinceKind === "district" ? "district" : "province"}…</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            <span>City / Municipality</span>
            <select
              className="select"
              disabled={disabled || adminBusy || !provinceCode}
              value={cityCode}
              onChange={(e) => setCityCode(e.target.value)}
            >
              <option value="">Select city/municipality…</option>
              {cities.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
            <span>Barangay</span>
            <select
              className="select"
              disabled={disabled || adminBusy || !cityCode}
              value={barangayCode}
              onChange={(e) => setBarangayCode(e.target.value)}
            >
              <option value="">Select barangay…</option>
              {barangays.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={disabled || adminBusy || !barangayCode}
            onClick={() => void applyAdminSelection()}
            style={{
              justifySelf: "start",
              padding: "0.55rem 0.85rem",
              borderRadius: 8,
              border: "none",
              background: !barangayCode ? "#CBD5E1" : "#2563EB",
              color: "#fff",
              fontWeight: 700,
              cursor: !barangayCode || adminBusy ? "not-allowed" : "pointer",
            }}
          >
            {adminBusy ? "Resolving…" : "Use this location"}
          </button>
          {adminError ? (
            <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: "0.8rem" }}>
              {adminError}
            </p>
          ) : null}
        </div>
      ) : null}

      {(mode === "map" || value) && (
        <div style={{ display: "grid", gap: "0.4rem" }}>
          {mode === "map" ? (
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#1E40AF" }}>
              Tap the map to drop a pin. Coordinates and address are filled automatically.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>Selected location preview</p>
          )}
          <div
            ref={mapHostRef}
            style={{
              width: "100%",
              height: 220,
              borderRadius: 10,
              border: "1px solid #BFDBFE",
              overflow: "hidden",
              background: "#E2E8F0",
            }}
          />
          {mapError ? (
            <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: "0.8rem" }}>
              {mapError}
            </p>
          ) : null}
        </div>
      )}

      <div
        style={{
          padding: "0.65rem 0.75rem",
          borderRadius: 8,
          border: `1px solid ${isComplete ? "#86EFAC" : "#FCD34D"}`,
          background: isComplete ? "#ECFDF5" : "#FFFBEB",
          fontSize: "0.82rem",
        }}
      >
        {isComplete && value ? (
          <>
            <div style={{ fontWeight: 700, color: "#065F46", marginBottom: 4 }}>Location ready</div>
            <div style={{ color: "#166534" }}>{value.label}</div>
            <div style={{ color: "#047857", marginTop: 4, fontSize: "0.78rem" }}>
              Coordinates: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
            </div>
          </>
        ) : (
          <div style={{ color: "#92400E", fontWeight: 600 }}>
            Select a complete location (search, map pin, or full admin cascade) before submitting.
          </div>
        )}
      </div>
    </div>
  );
}
