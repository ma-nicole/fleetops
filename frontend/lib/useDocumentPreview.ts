"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFullUrl } from "@/lib/api";
import {
  FILE_NOT_FOUND_MESSAGE,
  isImageFilename,
  isImageMime,
  isPdfFilename,
  isPdfMime,
} from "@/lib/documentFileTypes";

export type DocumentPreviewState = {
  url: string;
  fileName: string;
  isPdf: boolean;
  isImage: boolean;
  staticUrl?: string | null;
};

function tokenHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = window.localStorage.getItem("token") || window.localStorage.getItem("authToken");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function useDocumentPreview() {
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closePreview = useCallback(() => {
    setPreview((p) => {
      if (p?.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
      return null;
    });
    setError(null);
  }, []);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview, closePreview]);

  const openFromApi = useCallback(async (apiPath: string, fileName: string, staticUrl?: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiFullUrl(apiPath), {
        headers: tokenHeader(),
        cache: "no-store",
      });
      if (!res.ok) {
        setError(FILE_NOT_FOUND_MESSAGE);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const isPdf = isPdfFilename(fileName) || isPdfMime(blob.type);
      const isImage = isImageFilename(fileName) || isImageMime(blob.type);
      setPreview((prev) => {
        if (prev?.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
        return { url, fileName, isPdf, isImage, staticUrl: staticUrl ?? null };
      });
    } catch {
      setError(FILE_NOT_FOUND_MESSAGE);
    } finally {
      setBusy(false);
    }
  }, []);

  const openStaticUrl = useCallback((staticPath: string, fileName: string) => {
    setError(null);
    const url = apiFullUrl(staticPath);
    const isPdf = isPdfFilename(fileName);
    const isImage = isImageFilename(fileName);
    setPreview((prev) => {
      if (prev?.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      return { url, fileName, isPdf, isImage, staticUrl: staticPath };
    });
  }, []);

  const openDocument = useCallback(
    async ({
      fileName,
      staticUrl,
      apiPath,
    }: {
      fileName: string | null | undefined;
      staticUrl?: string | null;
      apiPath?: string;
    }) => {
      if (!fileName && !staticUrl && !apiPath) {
        setError(FILE_NOT_FOUND_MESSAGE);
        return;
      }
      const label = fileName || "document";
      if (apiPath) {
        await openFromApi(apiPath, label, staticUrl);
        return;
      }
      if (staticUrl) {
        openStaticUrl(staticUrl, label);
        return;
      }
      setError(FILE_NOT_FOUND_MESSAGE);
    },
    [openFromApi, openStaticUrl],
  );

  const openInNewTab = useCallback(() => {
    if (!preview) return;
    const target = preview.staticUrl ? apiFullUrl(preview.staticUrl) : preview.url;
    window.open(target, "_blank", "noopener,noreferrer");
  }, [preview]);

  return {
    preview,
    error,
    busy,
    closePreview,
    openDocument,
    openInNewTab,
    clearError: () => setError(null),
  };
}
