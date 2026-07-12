"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import SubmitButton from "@/components/ui/SubmitButton";
import { Html5Qrcode } from "html5-qrcode";
import DigitalSignaturePad from "@/components/DigitalSignaturePad";
import EvidenceCaptureInput from "@/components/EvidenceCaptureInput";
import { apiFullUrl } from "@/lib/api";
import type { EvidenceCaptureMetadata } from "@/lib/evidenceCapture";
import { prepareEvidenceFile } from "@/lib/evidenceCapture";
import { WorkflowApi, type DeliveryReceivingStatus } from "@/lib/workflowApi";

type DeliveryCompletionPanelProps = {
  tripId: number;
  bookingId?: number;
  crewName?: string | null;
  onReadyChange?: (ready: boolean) => void;
  compact?: boolean;
};

function tokenHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = window.localStorage.getItem("token") || window.localStorage.getItem("authToken");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem" }}>
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: ok ? "#DCFCE7" : "#FEE2E2",
          color: ok ? "#166534" : "#991B1B",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.72rem",
          fontWeight: 800,
        }}
      >
        {ok ? "✓" : "!"}
      </span>
      <span style={{ color: ok ? "#166534" : "#7F1D1D" }}>{label}</span>
    </div>
  );
}

export default function DeliveryCompletionPanel({
  tripId,
  bookingId,
  crewName,
  onReadyChange,
  compact = false,
}: DeliveryCompletionPanelProps) {
  const scanRegionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<DeliveryReceivingStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [receivingFile, setReceivingFile] = useState<File | null>(null);
  const [receivingMeta, setReceivingMeta] = useState<EvidenceCaptureMetadata | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureMeta, setSignatureMeta] = useState<EvidenceCaptureMetadata | null>(null);
  const [signatureUploadFile, setSignatureUploadFile] = useState<File | null>(null);
  const [signatureUploadMeta, setSignatureUploadMeta] = useState<EvidenceCaptureMetadata | null>(null);
  const [manualQr, setManualQr] = useState("");
  const [scanning, setScanning] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await WorkflowApi.deliveryReceivingStatus(tripId);
      setStatus(s);
      onReadyChange?.(s.ready_for_completion);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load delivery requirements.");
      onReadyChange?.(false);
    }
  }, [tripId, onReadyChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const startScanner = async () => {
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
          await verifyQr(decoded);
        },
        () => undefined,
      );
    } catch (e) {
      setScanning(false);
      setMsg(e instanceof Error ? e.message : "Camera QR scan unavailable. Enter the code manually.");
    }
  };

  const verifyQr = async (payload: string) => {
    setBusy("qr");
    setMsg(null);
    try {
      const s = await WorkflowApi.verifyReceivingQr(tripId, payload);
      setStatus(s);
      onReadyChange?.(s.ready_for_completion);
      setManualQr("");
      setMsg("QR verified.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "QR verification failed.");
    } finally {
      setBusy(null);
    }
  };

  const uploadReceiving = async () => {
    if (!receivingFile) {
      setMsg("Select a receiving document to upload.");
      return;
    }
    setBusy("doc");
    setMsg(null);
    try {
      const s = await WorkflowApi.uploadReceivingDocument(tripId, receivingFile, receivingMeta);
      setStatus(s);
      onReadyChange?.(s.ready_for_completion);
      setReceivingFile(null);
      setReceivingMeta(null);
      setMsg("Receiving document uploaded.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  };

  const uploadSignature = async () => {
    const file = signatureUploadFile || signatureFile;
    const meta = signatureUploadMeta || signatureMeta;
    if (!file) {
      setMsg("Draw or upload a digital signature first.");
      return;
    }
    setBusy("sig");
    setMsg(null);
    try {
      const s = await WorkflowApi.uploadDigitalSignature(tripId, file, meta);
      setStatus(s);
      onReadyChange?.(s.ready_for_completion);
      setSignatureFile(null);
      setSignatureMeta(null);
      setSignatureUploadFile(null);
      setSignatureUploadMeta(null);
      setMsg("Digital signature saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Signature upload failed.");
    } finally {
      setBusy(null);
    }
  };

  const openProtectedFile = useCallback(
    async (apiPath: string) => {
      try {
        const res = await fetch(apiFullUrl(apiPath), {
          headers: tokenHeader(),
          cache: "no-store",
        });
        if (!res.ok) {
          setMsg("Unable to load data.");
          return;
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      } catch {
        setMsg("Something went wrong. Please try again.");
      }
    },
    [],
  );

  if (loadError) {
    return (
      <div style={{ padding: "0.85rem", borderRadius: 8, background: "#FEE2E2", color: "#991B1B", fontSize: "0.88rem" }}>
        {loadError}
      </div>
    );
  }

  const hasDoc = !!status?.receiving_document_uploaded;
  const hasSig = !!status?.digital_signature_uploaded;

  return (
    <div
      style={{
        display: "grid",
        gap: compact ? "0.75rem" : "1rem",
        padding: compact ? "0.85rem" : "1rem",
        border: "1px solid #BFDBFE",
        borderRadius: 10,
        background: "#F8FAFC",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
          Delivery completion requirements
        </h3>
        <p style={{ margin: 0, fontSize: "0.84rem", color: "#475569", lineHeight: 1.45 }}>
          Upload the signed receiving document, verify the trip QR code, and capture the recipient digital signature
          before marking delivery complete.
        </p>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <CheckRow ok={!!status?.receiving_document_uploaded} label="Receiving document uploaded" />
        <CheckRow ok={!!status?.qr_verified} label="QR code verified" />
        <CheckRow ok={!!status?.digital_signature_uploaded} label="Digital signature captured" />
      </div>

      {msg ? (
        <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--brand-text-strong)", fontWeight: 600 }}>{msg}</p>
      ) : null}

      <section style={{ display: "grid", gap: "0.5rem" }}>
        <strong style={{ fontSize: "0.86rem" }}>1. Receiving document</strong>
        {hasDoc ? (
          <button
            type="button"
            className="button"
            style={{ width: "fit-content" }}
            onClick={() => void openProtectedFile(`/workflow/job/${tripId}/receiving-document`)}
          >
            View uploaded document
          </button>
        ) : null}
        <EvidenceCaptureInput
          label="Receiving document photo"
          allowPdf
          watermarkContext={{ bookingId, tripId, crewName }}
          uploaderName={crewName}
          value={receivingFile}
          metadata={receivingMeta}
          onCapture={(file, meta) => {
            setReceivingFile(file);
            setReceivingMeta(meta);
          }}
        />
        <SubmitButton
          type="button"
          className="button"
          busy={busy === "doc"}
          busyLabel="Uploading…"
          label="Upload receiving document"
          disabled={!receivingFile}
          onClick={() => void uploadReceiving()}
        />
      </section>

      <section style={{ display: "grid", gap: "0.5rem" }}>
        <strong style={{ fontSize: "0.86rem" }}>2. QR verification</strong>
        {status?.qr_payload ? (
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748B", wordBreak: "break-all" }}>
            Expected payload: <code>{status.qr_payload}</code>
          </p>
        ) : null}
        <div id={scanRegionId} style={{ width: "100%", maxWidth: 320, minHeight: scanning ? 240 : 0 }} />
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!scanning ? (
            <button type="button" className="button" disabled={busy === "qr"} onClick={() => void startScanner()}>
              Scan QR with camera
            </button>
          ) : (
            <button type="button" className="button" style={{ background: "#6B7280" }} onClick={() => void stopScanner()}>
              Stop scanner
            </button>
          )}
        </div>
        <input
          className="input"
          placeholder="Or paste scanned QR payload manually"
          value={manualQr}
          onChange={(e) => setManualQr(e.target.value)}
        />
        <button
          type="button"
          className="button"
          disabled={busy === "qr" || !manualQr.trim()}
          onClick={() => void verifyQr(manualQr.trim())}
        >
          {busy === "qr" ? "Verifying…" : "Verify QR code"}
        </button>
      </section>

      <section style={{ display: "grid", gap: "0.5rem" }}>
        <strong style={{ fontSize: "0.86rem" }}>3. Digital signature</strong>
        {hasSig ? (
          <button
            type="button"
            className="button"
            style={{ width: "fit-content" }}
            onClick={() => void openProtectedFile(`/workflow/job/${tripId}/digital-signature`)}
          >
            View saved signature
          </button>
        ) : null}
        <DigitalSignaturePad
          disabled={busy === "sig"}
          value={signatureFile}
          onChange={(file) => {
            if (!file) {
              setSignatureFile(null);
              setSignatureMeta(null);
              return;
            }
            void (async () => {
              const { file: prepared, metadata } = await prepareEvidenceFile(file, "live_capture", {
                bookingId,
                tripId,
                crewName,
              }, crewName);
              setSignatureFile(prepared);
              setSignatureMeta(metadata);
            })();
          }}
        />
        <EvidenceCaptureInput
          label="Or upload signature image"
          allowGalleryFallback
          watermarkContext={{ bookingId, tripId, crewName }}
          uploaderName={crewName}
          value={signatureUploadFile}
          metadata={signatureUploadMeta}
          onCapture={(file, meta) => {
            setSignatureUploadFile(file);
            setSignatureUploadMeta(meta);
          }}
        />
        <button type="button" className="button" disabled={busy === "sig"} onClick={() => void uploadSignature()}>
          {busy === "sig" ? "Saving…" : "Save digital signature"}
        </button>
      </section>
    </div>
  );
}
