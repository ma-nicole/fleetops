"use client";

import { useEffect, useId, useRef, useState } from "react";
import EvidenceVerificationBadge from "@/components/EvidenceVerificationBadge";
import {
  type CaptureSource,
  type EvidenceCaptureMetadata,
  type EvidenceWatermarkContext,
  attachGpsToEvidence,
  captureDeviceGeolocationDetailed,
  prepareEvidenceFile,
  prefetchDeviceGeolocation,
  startGeolocationWatch,
  stopGeolocationWatch,
} from "@/lib/evidenceCapture";

type Props = {
  label: string;
  required?: boolean;
  disabled?: boolean;
  accept?: string;
  fileFieldName?: string;
  watermarkContext: EvidenceWatermarkContext;
  uploaderName?: string | null;
  value?: File | null;
  metadata?: EvidenceCaptureMetadata | null;
  onCapture: (file: File | null, metadata: EvidenceCaptureMetadata | null) => void;
  allowGalleryFallback?: boolean;
  allowPdf?: boolean;
};

export default function EvidenceCaptureInput({
  label,
  required = false,
  disabled = false,
  accept = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
  watermarkContext,
  uploaderName,
  value,
  metadata,
  onCapture,
  allowGalleryFallback = true,
  allowPdf = false,
}: Props) {
  const id = useId();
  const cameraId = `${id}-camera`;
  const galleryId = `${id}-gallery`;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdfAccept = allowPdf ? ",.pdf,application/pdf" : "";
  const fullAccept = `${accept}${pdfAccept}`;
  const missingGps = Boolean(value && metadata && (metadata.latitude == null || metadata.longitude == null));

  useEffect(() => {
    // Warm GPS while the helper is reading the form — does not block camera.
    startGeolocationWatch();
    prefetchDeviceGeolocation();
    return () => stopGeolocationWatch();
  }, []);

  const processFile = async (file: File | undefined, source: CaptureSource) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        const gps = await captureDeviceGeolocationDetailed({ allowCache: true });
        const meta: EvidenceCaptureMetadata = {
          captureSource: source,
          deviceCapturedAt: new Date().toISOString(),
          latitude: gps.coords?.latitude ?? null,
          longitude: gps.coords?.longitude ?? null,
          gpsAccuracyMeters: gps.coords?.accuracyMeters ?? null,
          uploaderName: uploaderName ?? watermarkContext.crewName ?? null,
          verificationLabel: source === "gallery" ? "Uploaded from Gallery" : "Camera Verified",
          reviewRequired: source === "gallery",
        };
        onCapture(file, meta);
        if (!gps.coords && gps.errorMessage) setError(gps.errorMessage);
        return;
      }
      const { file: prepared, metadata: meta } = await prepareEvidenceFile(file, source, watermarkContext, uploaderName);
      onCapture(prepared, meta);
      if (meta.latitude == null || meta.longitude == null) {
        // Best-effort second try; never blocks saving the photo.
        const detail = await captureDeviceGeolocationDetailed({ allowCache: true, forceRefresh: true });
        if (detail.coords) {
          const attached = await attachGpsToEvidence(prepared, meta, watermarkContext);
          if (!attached.errorMessage) {
            onCapture(attached.file, attached.metadata);
            return;
          }
        }
        if (detail.errorMessage) setError(detail.errorMessage);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process photo.");
      onCapture(null, null);
    } finally {
      setBusy(false);
      // Allow re-selecting the same photo next time.
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  /**
   * Critical: open the file/camera picker in the same synchronous tap turn.
   * Awaiting GPS first breaks the user-gesture chain on Android Chrome / in-app browsers,
   * so the camera never opens ("Location ready… Opening camera…" stuck).
   */
  const openCamera = () => {
    if (disabled || busy) return;
    setError(null);
    prefetchDeviceGeolocation();
    const el = cameraRef.current;
    if (!el) return;
    el.value = "";
    el.click();
  };

  const openGallery = () => {
    if (disabled || busy) return;
    setError(null);
    prefetchDeviceGeolocation();
    const el = galleryRef.current;
    if (!el) return;
    el.value = "";
    el.click();
  };

  const retryGps = async () => {
    if (!value || !metadata) return;
    setGpsBusy(true);
    setError(null);
    try {
      const result = await attachGpsToEvidence(value, metadata, watermarkContext);
      if (result.errorMessage) {
        setError(result.errorMessage);
        return;
      }
      onCapture(result.file, result.metadata);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not retry GPS.");
    } finally {
      setGpsBusy(false);
    }
  };

  const clear = () => {
    onCapture(null, null);
    setError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  const controlsDisabled = disabled || busy;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: "0.85rem", color: "#555", fontWeight: 600 }}>
        {label}
        {required ? " (required)" : " (optional)"}
      </span>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280", lineHeight: 1.45 }}>
        Tap <strong>Take photo</strong> to open the camera. Location is captured in the background when permitted
        (allow Location for this site if prompted). Photos are watermarked with FleetOpt, booking/trip ID, timestamp,
        and GPS when available.
        {allowGalleryFallback
          ? " Gallery upload is available if the camera is unavailable (marked for manual review)."
          : ""}
      </p>

      <input
        ref={cameraRef}
        id={cameraId}
        type="file"
        accept={fullAccept}
        capture="environment"
        disabled={controlsDisabled}
        style={{ display: "none" }}
        onChange={(e) => void processFile(e.target.files?.[0], "camera")}
      />
      {allowGalleryFallback ? (
        <input
          ref={galleryRef}
          id={galleryId}
          type="file"
          accept={fullAccept}
          disabled={controlsDisabled}
          style={{ display: "none" }}
          onChange={(e) => void processFile(e.target.files?.[0], "gallery")}
        />
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {/* Native label + sync click keeps the mobile camera gesture valid. */}
        <label
          htmlFor={cameraId}
          onClick={(e) => {
            if (controlsDisabled) {
              e.preventDefault();
              return;
            }
            prefetchDeviceGeolocation();
            // Some WebViews ignore htmlFor after capture= — also force click.
            e.preventDefault();
            openCamera();
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.65rem 1.1rem",
            borderRadius: 8,
            border: "none",
            background: "#10B981",
            color: "white",
            fontWeight: 700,
            cursor: controlsDisabled ? "not-allowed" : "pointer",
            fontSize: "0.9rem",
            minHeight: 42,
            opacity: controlsDisabled ? 0.7 : 1,
          }}
        >
          {busy ? "Processing…" : "Take photo"}
        </label>
        {allowGalleryFallback ? (
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={openGallery}
            style={{
              padding: "0.55rem 0.85rem",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              color: "#6B7280",
              fontWeight: 500,
              cursor: controlsDisabled ? "not-allowed" : "pointer",
              fontSize: "0.8rem",
            }}
          >
            Use gallery instead
          </button>
        ) : null}
        {value ? (
          <button
            type="button"
            disabled={busy || gpsBusy}
            onClick={clear}
            style={{
              padding: "0.55rem 0.75rem",
              borderRadius: 8,
              border: "1px solid #FECACA",
              background: "#FEF2F2",
              color: "#991B1B",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {value ? (
        <div style={{ display: "grid", gap: 6 }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#065F46", fontWeight: 600 }}>
            Ready: {value.name}
          </p>
          {metadata ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <EvidenceVerificationBadge label={metadata.verificationLabel} reviewRequired={metadata.reviewRequired} />
              {metadata.latitude != null && metadata.longitude != null ? (
                <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                  GPS: {metadata.latitude.toFixed(5)}, {metadata.longitude.toFixed(5)}
                </span>
              ) : (
                <>
                  <span style={{ fontSize: "0.75rem", color: "#B45309", fontWeight: 700 }}>GPS not captured</span>
                  <button
                    type="button"
                    disabled={gpsBusy || busy}
                    onClick={() => void retryGps()}
                    style={{
                      padding: "0.35rem 0.7rem",
                      borderRadius: 8,
                      border: "1px solid #F59E0B",
                      background: "#FFFBEB",
                      color: "#92400E",
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      cursor: gpsBusy || busy ? "not-allowed" : "pointer",
                      minHeight: 36,
                    }}
                  >
                    {gpsBusy ? "Getting GPS…" : "Retry GPS"}
                  </button>
                </>
              )}
            </div>
          ) : null}
          {missingGps ? (
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#92400E", lineHeight: 1.4 }}>
              Photo is saved. To attach GPS: allow Location for this site, then tap <strong>Retry GPS</strong>. You can
              still Save milestone without GPS if needed.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: "0.82rem", color: "#991B1B" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
