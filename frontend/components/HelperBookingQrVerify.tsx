"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import StatusBanner from "@/components/ui/StatusBanner";
import { ApiError } from "@/lib/api";
import { WorkflowApi } from "@/lib/workflowApi";

type Props = {
  bookingId: number;
  verified?: boolean;
  verifiedAt?: string | null;
  onVerified?: () => void;
};

const BOOKING_QR_RE = /^FLEETOPS-BOOKING(?::|-)(\d+)(?::|-)(.+)$/;

function normalizeDecodedPayload(raw: string): string {
  let text = (raw || "").trim();
  if (!text) return "";
  try {
    text = decodeURIComponent(text);
  } catch {
    /* keep raw */
  }
  text = text.replace(/^\ufeff/, "").trim();
  const idx = text.indexOf("FLEETOPS-BOOKING");
  if (idx >= 0) text = text.slice(idx);
  return text.split(/\s/, 1)[0].trim();
}

function extractBookingId(payload: string): number | null {
  const m = BOOKING_QR_RE.exec(normalizeDecodedPayload(payload));
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Helper scans customer Booking QR before starting the trip (for_pickup). */
export default function HelperBookingQrVerify({
  bookingId,
  verified = false,
  verifiedAt = null,
  onVerified,
}: Props) {
  const scanRegionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
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

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        void scannerRef.current.stop().catch(() => undefined);
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  const stopScanner = async () => {
    if (!scannerRef.current) {
      setScanning(false);
      return;
    }
    try {
      await scannerRef.current.stop();
    } catch {
      /* ignore */
    }
    scannerRef.current.clear();
    scannerRef.current = null;
    setScanning(false);
  };

  const verifyPayload = async (payload: string, method: "camera" | "manual") => {
    const trimmed = normalizeDecodedPayload(payload);
    if (!trimmed) {
      setErr("Enter or scan the Booking QR payload.");
      return;
    }

    if (trimmed.startsWith("FLEETOPS-DELIVERY")) {
      setErr("That is the Delivery QR. Scan the Booking helper QR to start the trip.");
      return;
    }
    if (trimmed.startsWith("FLEETOPS-TRIP-")) {
      setErr("That is a trip receiving QR. Scan the customer Booking helper QR.");
      return;
    }

    const decodedBookingId = extractBookingId(trimmed);
    if (decodedBookingId != null && decodedBookingId !== Number(bookingId)) {
      setErr(
        `QR is for Booking #${decodedBookingId}, but this assignment is Booking #${bookingId}.`,
      );
      return;
    }

    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const result = await WorkflowApi.helperVerifyBookingQr(bookingId, trimmed, method);
      setLocalVerified(true);
      setLocalVerifiedAt(result.verified_at);
      setManualQr("");
      setMsg(result.message);
      onVerified?.();
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "QR verification failed.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  const startScanner = async () => {
    setErr(null);
    setMsg(null);
    try {
      await stopScanner();
      const scanner = new Html5Qrcode(scanRegionId);
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 220, height: 220 } },
        async (decoded) => {
          await stopScanner();
          await verifyPayload(decoded, "camera");
        },
        () => undefined,
      );
    } catch (e) {
      setScanning(false);
      setErr(e instanceof Error ? e.message : "Camera QR scan unavailable. Paste the code manually.");
    }
  };

  if (localVerified) {
    return (
      <StatusBanner tone="success" title="Booking QR verified">
        You may start the trip
        {localVerifiedAt ? ` · ${new Date(localVerifiedAt).toLocaleString()}` : ""}.
      </StatusBanner>
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
        <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 4 }}>Scan Booking QR before start</div>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#78350F", lineHeight: 1.45 }}>
          Ask the customer to show their Booking #{bookingId} helper QR (not the Delivery QR). Scan it or paste the
          code, then continue to Accepted / en route to pickup.
        </p>
      </div>

      <div id={scanRegionId} style={{ width: "100%", maxWidth: 320, margin: "0 auto" }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy || scanning}
          onClick={() => void startScanner()}
          style={{
            padding: "0.55rem 0.9rem",
            borderRadius: 8,
            border: "none",
            background: "#B45309",
            color: "#fff",
            fontWeight: 700,
            cursor: busy || scanning ? "not-allowed" : "pointer",
          }}
        >
          {scanning ? "Scanning…" : "Open camera scanner"}
        </button>
        {scanning ? (
          <button
            type="button"
            onClick={() => void stopScanner()}
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
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#92400E" }}>Or paste QR payload</span>
        <input
          className="input"
          value={manualQr}
          onChange={(e) => setManualQr(e.target.value)}
          placeholder="FLEETOPS-BOOKING:…"
          disabled={busy}
        />
      </label>
      <button
        type="button"
        disabled={busy || !manualQr.trim()}
        onClick={() => void verifyPayload(manualQr, "manual")}
        style={{
          padding: "0.55rem 0.9rem",
          borderRadius: 8,
          border: "none",
          background: "#0EA5E9",
          color: "#fff",
          fontWeight: 700,
          cursor: busy || !manualQr.trim() ? "not-allowed" : "pointer",
          justifySelf: "start",
        }}
      >
        {busy ? "Verifying…" : "Verify code"}
      </button>

      {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}
      {err ? <StatusBanner tone="error">{err}</StatusBanner> : null}
    </div>
  );
}
