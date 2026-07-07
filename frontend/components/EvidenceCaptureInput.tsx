"use client";

import { useId, useRef, useState } from "react";
import EvidenceVerificationBadge from "@/components/EvidenceVerificationBadge";
import {
  type CaptureSource,
  type EvidenceCaptureMetadata,
  type EvidenceWatermarkContext,
  prepareEvidenceFile,
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
  const [error, setError] = useState<string | null>(null);

  const pdfAccept = allowPdf ? ",.pdf,application/pdf" : "";
  const fullAccept = `${accept}${pdfAccept}`;

  const processFile = async (file: File | undefined, source: CaptureSource) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        const gps = await import("@/lib/evidenceCapture").then((m) => m.captureDeviceGeolocation());
        const meta: EvidenceCaptureMetadata = {
          captureSource: source,
          deviceCapturedAt: new Date().toISOString(),
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          gpsAccuracyMeters: gps?.accuracyMeters ?? null,
          uploaderName: uploaderName ?? watermarkContext.crewName ?? null,
          verificationLabel: source === "gallery" ? "Uploaded from Gallery" : "Camera Verified",
          reviewRequired: source === "gallery",
        };
        onCapture(file, meta);
        return;
      }
      const { file: prepared, metadata: meta } = await prepareEvidenceFile(file, source, watermarkContext, uploaderName);
      onCapture(prepared, meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process photo.");
      onCapture(null, null);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    onCapture(null, null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: "0.85rem", color: "#555", fontWeight: 600 }}>
        {label}
        {required ? " (required)" : " (optional)"}
      </span>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280", lineHeight: 1.45 }}>
        Use your device camera for verified proof. Photos are watermarked with FleetOpts, booking/trip ID, timestamp,
        and GPS coordinates.
      </p>

      <input
        ref={cameraRef}
        id={`${id}-camera`}
        type="file"
        accept={fullAccept}
        capture="environment"
        disabled={disabled || busy}
        style={{ display: "none" }}
        onChange={(e) => void processFile(e.target.files?.[0], "camera")}
      />
      {allowGalleryFallback ? (
        <input
          ref={galleryRef}
          id={`${id}-gallery`}
          type="file"
          accept={fullAccept}
          disabled={disabled || busy}
          style={{ display: "none" }}
          onChange={(e) => void processFile(e.target.files?.[0], "gallery")}
        />
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => cameraRef.current?.click()}
          style={{
            padding: "0.55rem 0.9rem",
            borderRadius: 8,
            border: "none",
            background: "#10B981",
            color: "white",
            fontWeight: 700,
            cursor: disabled || busy ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
          }}
        >
          {busy ? "Processing…" : "Take photo"}
        </button>
        {allowGalleryFallback ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => galleryRef.current?.click()}
            style={{
              padding: "0.55rem 0.9rem",
              borderRadius: 8,
              border: "1px solid #D1D5DB",
              background: "white",
              color: "#374151",
              fontWeight: 600,
              cursor: disabled || busy ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
            }}
          >
            Upload from gallery (manual review)
          </button>
        ) : null}
        {value ? (
          <button
            type="button"
            disabled={busy}
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
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151" }}>
            Selected: <strong>{value.name}</strong>
          </p>
          {metadata ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <EvidenceVerificationBadge label={metadata.verificationLabel} reviewRequired={metadata.reviewRequired} />
              {metadata.latitude != null && metadata.longitude != null ? (
                <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                  GPS: {metadata.latitude.toFixed(5)}, {metadata.longitude.toFixed(5)}
                </span>
              ) : (
                <span style={{ fontSize: "0.75rem", color: "#B45309" }}>GPS not captured</span>
              )}
            </div>
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
