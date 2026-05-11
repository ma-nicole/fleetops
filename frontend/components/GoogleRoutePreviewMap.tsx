"use client";

import { useEffect, useRef, useState } from "react";

const SCRIPT_ID = "fleetopt-google-maps-js";

function hasMapsGlobal(): boolean {
  return typeof window !== "undefined" && typeof google !== "undefined" && !!google.maps;
}

function loadMapsScript(apiKey: string): Promise<void> {
  if (hasMapsGlobal()) return Promise.resolve();
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const iv = window.setInterval(() => {
        if (hasMapsGlobal()) {
          window.clearInterval(iv);
          resolve();
        } else if (Date.now() - t0 > 20000) {
          window.clearInterval(iv);
          reject(new Error("Google Maps load timeout"));
        }
      }, 50);
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
}

export type GoogleRoutePreviewMapProps = {
  apiKey: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  /** px */
  height?: number;
};

/**
 * Embedded Google Map with pickup / dropoff markers (same pins as backend geocode).
 * Requires a browser key with Maps JavaScript API enabled; restrict by HTTP referrer.
 */
export default function GoogleRoutePreviewMap({
  apiKey,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  height = 260,
}: GoogleRoutePreviewMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey.trim()) {
      setErr("Missing Maps API key");
      return;
    }
    setErr(null);
    let cancelled = false;

    void (async () => {
      try {
        await loadMapsScript(apiKey);
        if (cancelled || !divRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(divRef.current, {
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
        }
        const map = mapRef.current;

        for (const m of markersRef.current) m.setMap(null);
        markersRef.current = [];

        const p = { lat: pickupLat, lng: pickupLng };
        const d = { lat: dropoffLat, lng: dropoffLng };
        markersRef.current.push(
          new google.maps.Marker({ map, position: p, title: "Pickup" }),
          new google.maps.Marker({ map, position: d, title: "Dropoff" }),
        );

        const bounds = new google.maps.LatLngBounds();
        bounds.extend(p);
        bounds.extend(d);
        map.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
        google.maps.event.addListenerOnce(map, "idle", () => {
          const z = map.getZoom();
          if (z !== undefined && z > 14) map.setZoom(14);
        });
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Map failed to load");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  if (err) {
    return (
      <div
        style={{
          height,
          borderRadius: 12,
          border: "1px dashed var(--border-subtle, #ccc)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.75rem",
          fontSize: "0.78rem",
          color: "var(--text-secondary)",
          textAlign: "center",
        }}
      >
        {err}
      </div>
    );
  }

  return (
    <div
      ref={divRef}
      style={{
        width: "100%",
        height,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.08)",
      }}
      aria-label="Route preview map"
    />
  );
}
