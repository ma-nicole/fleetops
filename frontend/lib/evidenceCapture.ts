/** Operational evidence capture — GPS, watermark, and verification metadata. */

export type CaptureSource = "camera" | "gallery" | "live_capture";

export type EvidenceCaptureMetadata = {
  captureSource: CaptureSource;
  deviceCapturedAt: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracyMeters: number | null;
  uploaderName: string | null;
  verificationLabel: string;
  reviewRequired: boolean;
};

export type EvidenceWatermarkContext = {
  bookingId?: number | null;
  tripId?: number | null;
  crewName?: string | null;
};

export type DeviceGeolocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
};

export type DeviceGeolocationResult = {
  coords: DeviceGeolocation | null;
  /** Browser PositionError code when capture failed (1=denied, 2=unavailable, 3=timeout). */
  errorCode: number | null;
  errorMessage: string | null;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const GPS_CACHE_KEY = "fleetops_last_gps_v1";
const GPS_CACHE_MS = 10 * 60 * 1000;

/** Recent fix kept across camera open → return so GPS survives the camera handoff. */
let lastKnownGps: (DeviceGeolocation & { capturedAt: number }) | null = null;
let inflightGps: Promise<DeviceGeolocationResult> | null = null;
let watchId: number | null = null;
let hydratedFromStorage = false;

export function isEvidenceImageFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (IMAGE_TYPES.has(t)) return true;
  const n = file.name.toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp");
}

export function verificationLabelForSource(source: CaptureSource): string {
  if (source === "gallery") return "Uploaded from Gallery";
  if (source === "live_capture") return "Camera Verified";
  return "Camera Verified";
}

function hydrateFromStorage(): void {
  if (hydratedFromStorage || typeof window === "undefined") return;
  hydratedFromStorage = true;
  try {
    const raw = window.sessionStorage.getItem(GPS_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number | null;
      capturedAt?: number;
    };
    if (
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number" &&
      typeof parsed.capturedAt === "number" &&
      Date.now() - parsed.capturedAt < GPS_CACHE_MS
    ) {
      lastKnownGps = {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        accuracyMeters:
          typeof parsed.accuracyMeters === "number" && Number.isFinite(parsed.accuracyMeters)
            ? parsed.accuracyMeters
            : null,
        capturedAt: parsed.capturedAt,
      };
    }
  } catch {
    /* ignore corrupt cache */
  }
}

function persistGps(coords: DeviceGeolocation & { capturedAt: number }): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GPS_CACHE_KEY, JSON.stringify(coords));
  } catch {
    /* private mode / quota */
  }
}

function readCachedGps(maxAgeMs = GPS_CACHE_MS): DeviceGeolocation | null {
  hydrateFromStorage();
  if (!lastKnownGps) return null;
  if (Date.now() - lastKnownGps.capturedAt > maxAgeMs) return null;
  return {
    latitude: lastKnownGps.latitude,
    longitude: lastKnownGps.longitude,
    accuracyMeters: lastKnownGps.accuracyMeters,
  };
}

function rememberGps(coords: DeviceGeolocation): DeviceGeolocation {
  const stamped = { ...coords, capturedAt: Date.now() };
  lastKnownGps = stamped;
  persistGps(stamped);
  return coords;
}

function positionErrorMessage(err: GeolocationPositionError | null | undefined): string {
  if (!err) return "Location could not be read.";
  if (err.code === 1) {
    return "Location permission is blocked. Allow location for this site in browser settings, then retry GPS.";
  }
  if (err.code === 3) return "Location request timed out. Keep Location ON, wait outdoors a few seconds, then retry.";
  return "Location is unavailable on this device right now. Retry GPS.";
}

function getPositionOnce(options: PositionOptions): Promise<{
  coords: DeviceGeolocation | null;
  error: GeolocationPositionError | null;
}> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      resolve({ coords: null, error: null });
      return;
    }
    let settled = false;
    const finish = (coords: DeviceGeolocation | null, error: GeolocationPositionError | null) => {
      if (settled) return;
      settled = true;
      resolve({ coords, error });
    };
    // Soft timeout so enableHighAccuracy cannot hang indefinitely on some Android builds.
    const softMs = Math.max(3000, Number(options.timeout ?? 10000) + 500);
    const timer = window.setTimeout(() => finish(null, null), softMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        finish(
          {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          },
          null,
        );
      },
      (error) => {
        window.clearTimeout(timer);
        finish(null, error);
      },
      options,
    );
  });
}

/**
 * Capture device GPS with progressive fallbacks.
 * Prefer `ensureGpsBeforeCapture()` on Take photo so Android keeps a fix across the camera handoff.
 */
export async function captureDeviceGeolocationDetailed(
  options?: { forceRefresh?: boolean; allowCache?: boolean },
): Promise<DeviceGeolocationResult> {
  hydrateFromStorage();
  const forceRefresh = options?.forceRefresh === true;
  const allowCache = options?.allowCache !== false;

  if (!forceRefresh && allowCache) {
    const cached = readCachedGps();
    if (cached) {
      return { coords: cached, errorCode: null, errorMessage: null };
    }
  }

  if (typeof window === "undefined" || !navigator.geolocation) {
    return {
      coords: null,
      errorCode: 2,
      errorMessage: "This browser does not support GPS.",
    };
  }

  if (!window.isSecureContext) {
    return {
      coords: null,
      errorCode: 1,
      errorMessage: "GPS requires a secure (HTTPS) connection.",
    };
  }

  if (inflightGps && !forceRefresh) {
    return inflightGps;
  }

  inflightGps = (async () => {
    // Fast path: recent cached browser position (no high-accuracy wait).
    let attempt = await getPositionOnce({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: forceRefresh ? 5_000 : 180_000,
    });
    if (attempt.coords) {
      return { coords: rememberGps(attempt.coords), errorCode: null, errorMessage: null };
    }

    // High accuracy for a tighter fix.
    attempt = await getPositionOnce({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: forceRefresh ? 0 : 60_000,
    });
    if (attempt.coords) {
      return { coords: rememberGps(attempt.coords), errorCode: null, errorMessage: null };
    }

    // Final network / cell fallback.
    attempt = await getPositionOnce({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 300_000,
    });
    if (attempt.coords) {
      return { coords: rememberGps(attempt.coords), errorCode: null, errorMessage: null };
    }

    const cached = readCachedGps(GPS_CACHE_MS);
    if (cached) {
      return { coords: cached, errorCode: null, errorMessage: null };
    }

    const err = attempt.error;
    return {
      coords: null,
      errorCode: err?.code ?? 2,
      errorMessage: positionErrorMessage(err),
    };
  })();

  try {
    return await inflightGps;
  } finally {
    inflightGps = null;
  }
}

/** Convenience wrapper used by prepareEvidenceFile / PDF path. */
export async function captureDeviceGeolocation(): Promise<DeviceGeolocation | null> {
  const result = await captureDeviceGeolocationDetailed();
  return result.coords;
}

/**
 * Wait for a GPS fix before opening the camera (must run from the tap handler).
 * This is the reliable path on Android Chrome — fire-and-forget prefetch loses to the camera.
 */
export async function ensureGpsBeforeCapture(): Promise<DeviceGeolocationResult> {
  startGeolocationWatch();
  return captureDeviceGeolocationDetailed({ allowCache: true, forceRefresh: false });
}

/**
 * Keep a live GPS fix while the evidence form is open so camera handoff still has coordinates.
 */
export function startGeolocationWatch(): void {
  if (typeof window === "undefined" || !navigator.geolocation) return;
  hydrateFromStorage();
  if (watchId != null) return;
  try {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        rememberGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        });
      },
      () => {
        /* keep last known; Retry GPS / ensureGpsBeforeCapture still works */
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  } catch {
    watchId = null;
  }
  // Also kick a one-shot so first fix arrives quickly.
  void captureDeviceGeolocationDetailed({ allowCache: true, forceRefresh: false });
}

export function stopGeolocationWatch(): void {
  if (typeof window === "undefined" || !navigator.geolocation) return;
  if (watchId == null) return;
  try {
    navigator.geolocation.clearWatch(watchId);
  } catch {
    /* ignore */
  }
  watchId = null;
}

/** @deprecated use ensureGpsBeforeCapture — kept for callers that only want a warm start. */
export function prefetchDeviceGeolocation(): void {
  startGeolocationWatch();
}

function formatCaptureTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatGps(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return "GPS unavailable";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function buildWatermarkLines(
  ctx: EvidenceWatermarkContext,
  meta: Pick<EvidenceCaptureMetadata, "deviceCapturedAt" | "latitude" | "longitude" | "captureSource" | "uploaderName">,
): string[] {
  const lines = ["FleetOpts"];
  const ids: string[] = [];
  if (ctx.bookingId) ids.push(`Booking #${ctx.bookingId}`);
  if (ctx.tripId) ids.push(`Trip #${ctx.tripId}`);
  if (ids.length) lines.push(ids.join(" | "));
  if (meta.uploaderName || ctx.crewName) lines.push(meta.uploaderName || ctx.crewName || "");
  lines.push(formatCaptureTimestamp(meta.deviceCapturedAt));
  lines.push(formatGps(meta.latitude, meta.longitude));
  lines.push(verificationLabelForSource(meta.captureSource));
  return lines.filter(Boolean);
}

export async function watermarkEvidenceImage(file: File, lines: string[]): Promise<File> {
  if (!isEvidenceImageFile(file)) return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const fontSize = Math.max(12, Math.floor(bitmap.height * 0.022));
  const lineHeight = Math.floor(fontSize * 1.35);
  const padding = Math.floor(fontSize * 0.75);
  const bandHeight = lines.length * lineHeight + padding * 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, padding, canvas.height - bandHeight + padding + i * lineHeight);
  });

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.9));
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "evidence";
  const ext = mime === "image/png" ? ".png" : ".jpg";
  return new File([blob], `${base}_verified${ext}`, { type: mime, lastModified: Date.now() });
}

export async function prepareEvidenceFile(
  file: File,
  source: CaptureSource,
  ctx: EvidenceWatermarkContext,
  uploaderName?: string | null,
): Promise<{ file: File; metadata: EvidenceCaptureMetadata }> {
  const deviceCapturedAt = new Date().toISOString();
  // Prefer cache filled before camera open; retry if empty.
  let gpsResult = await captureDeviceGeolocationDetailed({ allowCache: true });
  if (!gpsResult.coords) {
    gpsResult = await captureDeviceGeolocationDetailed({ allowCache: true, forceRefresh: true });
  }
  const metadata: EvidenceCaptureMetadata = {
    captureSource: source,
    deviceCapturedAt,
    latitude: gpsResult.coords?.latitude ?? null,
    longitude: gpsResult.coords?.longitude ?? null,
    gpsAccuracyMeters: gpsResult.coords?.accuracyMeters ?? null,
    uploaderName: uploaderName ?? ctx.crewName ?? null,
    verificationLabel: verificationLabelForSource(source),
    reviewRequired: source === "gallery",
  };

  const lines = buildWatermarkLines(ctx, metadata);
  const watermarked = await watermarkEvidenceImage(file, lines);
  return { file: watermarked, metadata };
}

/** Re-stamp GPS onto an already-captured evidence file (retry after permission grant). */
export async function attachGpsToEvidence(
  file: File,
  metadata: EvidenceCaptureMetadata,
  ctx: EvidenceWatermarkContext,
): Promise<{ file: File; metadata: EvidenceCaptureMetadata; errorMessage: string | null }> {
  startGeolocationWatch();
  let gpsResult = await captureDeviceGeolocationDetailed({ forceRefresh: true, allowCache: false });
  if (!gpsResult.coords) {
    gpsResult = await captureDeviceGeolocationDetailed({ allowCache: true, forceRefresh: false });
  }
  if (!gpsResult.coords) {
    return {
      file,
      metadata,
      errorMessage: gpsResult.errorMessage || "GPS not captured.",
    };
  }
  const nextMeta: EvidenceCaptureMetadata = {
    ...metadata,
    latitude: gpsResult.coords.latitude,
    longitude: gpsResult.coords.longitude,
    gpsAccuracyMeters: gpsResult.coords.accuracyMeters,
  };
  if (!isEvidenceImageFile(file)) {
    return { file, metadata: nextMeta, errorMessage: null };
  }
  const lines = buildWatermarkLines(ctx, nextMeta);
  const watermarked = await watermarkEvidenceImage(file, lines);
  return { file: watermarked, metadata: nextMeta, errorMessage: null };
}
