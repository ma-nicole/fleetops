"use client";

import type { DocumentPreviewState } from "@/lib/useDocumentPreview";

type Props = {
  preview: DocumentPreviewState;
  onClose: () => void;
  onOpenInNewTab?: () => void;
};

export default function DocumentPreviewModal({ preview, onClose, onOpenInNewTab }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Document preview"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 12,
          maxWidth: "min(960px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          display: "grid",
          gap: "0.75rem",
          padding: "1rem 1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <strong style={{ color: "#111827", wordBreak: "break-all" }}>{preview.fileName}</strong>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            {onOpenInNewTab && (
              <button
                type="button"
                onClick={onOpenInNewTab}
                style={{
                  background: "var(--brand-text)",
                  color: "white",
                  border: "none",
                  padding: "0.45rem 0.85rem",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Open in new tab
              </button>
            )}
            <a
              href={preview.url}
              download={preview.fileName}
              style={{
                background: "#10B981",
                color: "white",
                padding: "0.45rem 0.85rem",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: "0.875rem",
                textDecoration: "none",
              }}
            >
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#F3F4F6",
                color: "#111827",
                border: "1px solid #E5E7EB",
                padding: "0.45rem 0.85rem",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
        {preview.isPdf ? (
          <iframe
            src={preview.url}
            title={preview.fileName}
            style={{
              width: "min(920px, 92vw)",
              height: "min(72vh, 640px)",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
            }}
          />
        ) : preview.isImage ? (
          <img
            src={preview.url}
            alt={preview.fileName}
            style={{
              maxWidth: "100%",
              maxHeight: "72vh",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              justifySelf: "center",
            }}
          />
        ) : (
          <p style={{ margin: 0, color: "#6B7280", fontSize: "0.9rem" }}>
            Preview is not available for this file type. Use Download or Open in new tab.
          </p>
        )}
      </div>
    </div>
  );
}
