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

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

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

export async function captureDeviceGeolocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
} | null> {
  if (typeof window === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
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
  const gps = await captureDeviceGeolocation();
  const metadata: EvidenceCaptureMetadata = {
    captureSource: source,
    deviceCapturedAt,
    latitude: gps?.latitude ?? null,
    longitude: gps?.longitude ?? null,
    gpsAccuracyMeters: gps?.accuracyMeters ?? null,
    uploaderName: uploaderName ?? ctx.crewName ?? null,
    verificationLabel: verificationLabelForSource(source),
    reviewRequired: source === "gallery",
  };

  const lines = buildWatermarkLines(ctx, metadata);
  const watermarked = await watermarkEvidenceImage(file, lines);
  return { file: watermarked, metadata };
}
