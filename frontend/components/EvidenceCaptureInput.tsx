"use client";

import { useEffect, useId, useRef, useState } from "react";
import EvidenceVerificationBadge from "@/components/EvidenceVerificationBadge";
import {
  type CaptureSource,
  type EvidenceCaptureMetadata,
  type EvidenceWatermarkContext,
  attachGpsToEvidence,
  captureDeviceGeolocationDetailed,
  ensureGpsBeforeCapture,
  prepareEvidenceFile,
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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsReadyHint, setGpsReadyHint] = useState<string | null>(null);

  const pdfAccept = allowPdf ? ",.pdf,application/pdf" : "";
  const fullAccept = `${accept}${pdfAccept}`;
  const missingGps = Boolean(value && metadata && (metadata.latitude == null || metadata.longitude == null));

  useEffect(() => {
    startGeolocationWatch();
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
        const detail = await captureDeviceGeolocationDetailed({ allowCache: true });
        if (detail.errorMessage) setError(detail.errorMessage);
      } else {
        setGpsReadyHint(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process photo.");
      onCapture(null, null);
    } finally {
      setBusy(false);
    }
  };

  const openCamera = async () => {
    setError(null);
    setLocating(true);
    setGpsReadyHint(null);
    try {
      // Must finish GPS before opening the camera — Android cancels in-flight requests otherwise.
      const gps = await ensureGpsBeforeCapture();
      if (gps.coords) {
        setGpsReadyHint(
          `Location ready (${gps.coords.latitude.toFixed(5)}, ${gps.coords.longitude.toFixed(5)}). Opening camera…`,
        );
      } else {
        setError(
          (gps.errorMessage || "GPS not ready.") +
            " You can still take the photo, then tap Retry GPS after allowing location.",
        );
      }
    } finally {
      setLocating(false);
    }
    cameraRef.current?.click();
  };

  const openGallery = async () => {
    setError(null);
    setLocating(true);
    try {
      await ensureGpsBeforeCapture();
    } finally {
      setLocating(false);
    }
    galleryRef.current?.click();
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
      setGpsReadyHint(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not retry GPS.");
    } finally {
      setGpsBusy(false);
    }
  };

  const clear = () => {
    onCapture(null, null);
    setError(null);
    setGpsReadyHint(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  const buttonBusy = disabled || busy || locating;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: "0.85rem", color: "#555", fontWeight: 600 }}>
        {label}
        {required ? " (required)" : " (optional)"}
      </span>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280", lineHeight: 1.45 }}>
        Tap <strong>Take photo</strong> — the app gets GPS first (allow location when prompted), then opens the camera.
        Photos are watermarked with FleetOpt, booking/trip ID, timestamp, and GPS.
        {allowGalleryFallback
          ? " Gallery upload is available if the camera is unavailable (marked for manual review)."
          : ""}
      </p>

      <input
        ref={cameraRef}
        id={`${id}-camera`}
        type="file"
        accept={fullAccept}
        capture="environment"
        disabled={buttonBusy}
        style={{ display: "none" }}
        onChange={(e) => void processFile(e.target.files?.[0], "camera")}
      />
      {allowGalleryFallback ? (
        <input
          ref={galleryRef}
          id={`${id}-gallery`}
          type="file"
          accept={fullAccept}
          disabled={buttonBusy}
          style={{ display: "none" }}
          onChange={(e) => void processFile(e.target.files?.[0], "gallery")}
        />
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          disabled={buttonBusy}
          onClick={() => void openCamera()}
          style={{
            padding: "0.65rem 1.1rem",
            borderRadius: 8,
            border: "none",
            background: "#10B981",
            color: "white",
            fontWeight: 700,
            cursor: buttonBusy ? "not-allowed" : "pointer",
            fontSize: "0.9rem",
            minHeight: 42,
          }}
        >
          {locating ? "Getting GPS…" : busy ? "Processing…" : "Take photo"}
        </button>
        {allowGalleryFallback ? (
          <button
            type="button"
            disabled={buttonBusy}
            onClick={() => void openGallery()}
            style={{
              padding: "0.55rem 0.85rem",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              color: "#6B7280",
              fontWeight: 500,
              cursor: buttonBusy ? "not-allowed" : "pointer",
              fontSize: "0.8rem",
            }}
          >
            Use gallery instead
          </button>
        ) : null}
        {value ? (
          <button
            type="button"
            disabled={busy || gpsBusy || locating}
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

      {gpsReadyHint ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#065F46" }}>{gpsReadyHint}</p>
      ) : null}

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
                    disabled={gpsBusy || busy || locating}
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
              Allow <strong>Location</strong> for this site, turn on phone Location, then tap <strong>Retry GPS</strong>.
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
