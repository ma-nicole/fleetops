"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import StatusBanner from "@/components/ui/StatusBanner";
import { ApiError } from "@/lib/api";
import { WorkflowApi } from "@/lib/workflowApi";

type Props = {
  bookingId: number;
  tripId?: number | null;
  verified?: boolean;
  verifiedAt?: string | null;
  enabled?: boolean;
  lockedHint?: string | null;
  onVerified?: () => void;
};

const BOOKING_QR_RE =
  /^(?:booking\s*=\s*(\d+)\s*\|\s*code\s*=\s*(.+)|FLEETOPS-BOOKING(?::|-)(\d+)(?::|-)(.+)|FLEETOPS-DELIVERY:(\d+):(\d+):(.+))$/i;

function isSecureCameraContext(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function normalizeDecodedPayload(raw: string): string {
  let text = (raw || "").trim();
  if (!text) return "";
  try {
    text = decodeURIComponent(text);
  } catch {
    /* keep raw */
  }
  text = text.replace(/^\ufeff/, "").trim();
  const lower = text.toLowerCase();
  for (const marker of ["booking=", "fleetops-booking", "fleetops-delivery", "fleetops-trip-"]) {
    const idx = lower.indexOf(marker);
    if (idx >= 0) {
      text = text.slice(idx).trim();
      break;
    }
  }
  return text.split(/\s/, 1)[0].trim();
}

function extractBookingId(payload: string): number | null {
  const m = BOOKING_QR_RE.exec(normalizeDecodedPayload(payload));
  if (!m) return null;
  const id = Number(m[1] || m[3] || m[5]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function cameraErrorMessage(e: unknown): string {
  const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const combined = `${name} ${msg}`.toLowerCase();
  if (combined.includes("notallowed") || combined.includes("permission") || combined.includes("denied")) {
    return "Camera permission denied. Allow camera access in browser settings, or paste the Booking Completion code below.";
  }
  if (combined.includes("notfound") || combined.includes("no camera") || combined.includes("requested device")) {
    return "No camera found on this device. Paste the Booking Completion code below.";
  }
  if (combined.includes("notreadable") || combined.includes("trackstart") || combined.includes("in use")) {
    return "Camera is in use by another app. Close it and try again, or paste the code manually.";
  }
  if (combined.includes("secure") || combined.includes("https")) {
    return "Camera requires HTTPS (or localhost). Open FleetOps over a secure URL, or paste the code manually.";
  }
  return msg || "Camera QR scan unavailable. Paste the Booking Completion code below.";
}

async function requestCameraPermission(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera API is not available in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" } },
  });
  stream.getTracks().forEach((t) => t.stop());
}

async function pickRearCameraId(): Promise<string | MediaTrackConstraints> {
  const cameras = await Html5Qrcode.getCameras();
  if (!cameras.length) {
    return { facingMode: { ideal: "environment" } };
  }
  const rear =
    cameras.find((c) => /back|rear|environment|trás|arrière|rück/i.test(c.label || "")) ||
    (cameras.length > 1 ? cameras[cameras.length - 1] : cameras[0]);
  return rear.id || { facingMode: { ideal: "environment" } };
}

/** Helper scans customer Booking Completion QR after arrival / POD — final booking confirmation. */
export default function HelperBookingQrVerify({
  bookingId,
  tripId = null,
  verified = false,
  verifiedAt = null,
  enabled = true,
  lockedHint = null,
  onVerified,
}: Props) {
  const reactId = useId().replace(/:/g, "");
  const scanRegionId = `booking-completion-qr-scan-${reactId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const verifyingRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [manualQr, setManualQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [localVerified, setLocalVerified] = useState(verified);
  const [localVerifiedAt, setLocalVerifiedAt] = useState<string | null>(verifiedAt);

  useEffect(() => {
    setLocalVerified(verified);
    setLocalVerifiedAt(verifiedAt);
  }, [verified, verifiedAt]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      setScanning(false);
      return;
    }
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      /* ignore */
    }
    try {
      scanner.clear();
    } catch {
      /* ignore */
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  const verifyPayload = async (payload: string, method: "camera" | "manual") => {
    if (verifyingRef.current || !enabled) return;
    const trimmed = normalizeDecodedPayload(payload);
    // Temporary client diagnostic logging
    // eslint-disable-next-line no-console
    console.info("[booking_qr_scan]", {
      method,
      raw: payload,
      decoded: trimmed,
      currentBooking: bookingId,
      qrBooking: extractBookingId(trimmed),
      endpoint: `/helper/bookings/${bookingId}/verify-qr`,
    });

    if (!trimmed) {
      setErr("Enter or scan the Booking Completion QR payload.");
      return;
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith("fleetops-trip-")) {
      setErr("That is a trip receiving QR. Scan the customer Booking Completion QR.");
      return;
    }

    const decodedBookingId = extractBookingId(trimmed);
    if (decodedBookingId != null && decodedBookingId !== Number(bookingId)) {
      setErr(
        "This QR code does not match the current booking. Ask the customer for the Booking Completion QR for this assignment.",
      );
      return;
    }

    verifyingRef.current = true;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const result = await WorkflowApi.helperVerifyBookingQr(
        bookingId,
        trimmed,
        method,
        tripId ?? undefined,
      );
      // eslint-disable-next-line no-console
      console.info("[booking_qr_scan] VERIFICATION_RESULT=ok", result);
      setLocalVerified(true);
      setLocalVerifiedAt(result.verified_at);
      setManualQr("");
      setMsg(result.message);
      onVerified?.();
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "QR verification failed.";
      // eslint-disable-next-line no-console
      console.warn("[booking_qr_scan] VERIFICATION_RESULT=rejected", { message, decoded: trimmed, bookingId });
      setErr(message);
    } finally {
      verifyingRef.current = false;
      setBusy(false);
    }
  };

  const startScanner = async () => {
    if (!enabled) return;
    setErr(null);
    setMsg(null);

    if (!isSecureCameraContext()) {
      setErr("Camera requires HTTPS (or localhost). Paste the Booking Completion code below.");
      return;
    }

    try {
      await stopScanner();
      await requestCameraPermission();
      setScanning(true);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await new Promise((r) => window.setTimeout(r, 80));

      const el = document.getElementById(scanRegionId);
      if (!el) {
        throw new Error("Scanner view is not ready. Try again.");
      }

      const scanner = new Html5Qrcode(scanRegionId, { verbose: false });
      scannerRef.current = scanner;

      let cameraConfig: string | MediaTrackConstraints;
      try {
        cameraConfig = await pickRearCameraId();
      } catch {
        cameraConfig = { facingMode: { ideal: "environment" } };
      }

      await scanner.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: (viewW, viewH) => {
            const edge = Math.floor(Math.min(viewW, viewH) * 0.75);
            return { width: Math.max(edge, 180), height: Math.max(edge, 180) };
          },
          aspectRatio: 1,
          disableFlip: false,
        },
        async (decoded) => {
          if (verifyingRef.current) return;
          await stopScanner();
          await verifyPayload(decoded, "camera");
        },
        () => undefined,
      );
    } catch (e) {
      await stopScanner();
      setErr(cameraErrorMessage(e));
    }
  };

  if (localVerified) {
    return (
      <StatusBanner tone="success" title="Booking Completion QR verified">
        Booking marked completed
        {localVerifiedAt ? ` · ${new Date(localVerifiedAt).toLocaleString()}` : ""}.
      </StatusBanner>
    );
  }

  if (!enabled) {
    return (
      <div
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          padding: "0.85rem 1rem",
          background: "#F9FAFB",
          color: "#6B7280",
          fontSize: "0.85rem",
          lineHeight: 1.45,
        }}
      >
        {lockedHint ||
          "Booking Completion QR unlocks after you reach Arrived at Destination and finish delivery proof (receiving document + signature)."}
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #FDE68A",
        borderRadius: 10,
        padding: "0.85rem 1rem",
        background: "#FFFBEB",
        display: "grid",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 4 }}>Booking Completion QR</div>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#78350F", lineHeight: 1.45 }}>
          Ask the customer to show their Booking #{bookingId} Completion QR. Scan it, or paste the Manual Verification
          Code / full payload. Same verification logic is used for both. Retry is allowed if verification fails.
        </p>
      </div>

      <div
        id={scanRegionId}
        style={{
          width: "100%",
          maxWidth: 360,
          margin: "0 auto",
          minHeight: scanning ? 260 : 0,
          overflow: "hidden",
          borderRadius: 8,
          background: scanning ? "#111827" : "transparent",
        }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy || scanning}
          onClick={() => void startScanner()}
          className="helper-touch-btn"
          style={{
            padding: "0.65rem 0.9rem",
            borderRadius: 8,
            border: "none",
            background: "#B45309",
            color: "#fff",
            fontWeight: 700,
            cursor: busy || scanning ? "not-allowed" : "pointer",
            minHeight: 48,
          }}
        >
          {scanning ? "Scanning…" : "Open camera scanner"}
        </button>
        {scanning ? (
          <button
            type="button"
            onClick={() => void stopScanner()}
            className="helper-touch-btn"
            style={{
              padding: "0.55rem 0.9rem",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Stop camera
          </button>
        ) : null}
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#92400E" }}>
          Manual Verification Code (fallback)
        </span>
        <input
          className="helper-touch-input input"
          value={manualQr}
          onChange={(e) => setManualQr(e.target.value)}
          placeholder="booking=123|code=… or code alone"
          disabled={busy}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{ fontSize: 16, minHeight: 44 }}
        />
      </label>
      <button
        type="button"
        disabled={busy || !manualQr.trim()}
        onClick={() => void verifyPayload(manualQr, "manual")}
        className="helper-touch-btn"
        style={{
          padding: "0.65rem 0.9rem",
          borderRadius: 8,
          border: "none",
          background: "#0EA5E9",
          color: "#fff",
          fontWeight: 700,
          cursor: busy || !manualQr.trim() ? "not-allowed" : "pointer",
          justifySelf: "start",
          minHeight: 48,
        }}
      >
        {busy ? "Verifying…" : "Verify & complete"}
      </button>

      {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}
      {err ? <StatusBanner tone="error">{err}</StatusBanner> : null}
    </div>
  );
}
