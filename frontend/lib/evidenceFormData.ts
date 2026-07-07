import type { EvidenceCaptureMetadata } from "@/lib/evidenceCapture";

/** Append standard evidence metadata fields expected by backend multipart routes. */
export function appendEvidenceToFormData(fd: FormData, meta: EvidenceCaptureMetadata): void {
  fd.append("evidence_capture_source", meta.captureSource);
  fd.append("evidence_device_captured_at", meta.deviceCapturedAt);
  if (meta.latitude != null) fd.append("evidence_latitude", String(meta.latitude));
  if (meta.longitude != null) fd.append("evidence_longitude", String(meta.longitude));
  if (meta.gpsAccuracyMeters != null) fd.append("evidence_gps_accuracy_m", String(meta.gpsAccuracyMeters));
  if (meta.uploaderName) fd.append("evidence_uploader_name", meta.uploaderName);
}
