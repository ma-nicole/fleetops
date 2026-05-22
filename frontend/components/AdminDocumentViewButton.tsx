"use client";

import { FILE_NOT_FOUND_MESSAGE } from "@/lib/documentFileTypes";

const btnStyle: React.CSSProperties = {
  padding: "0.35rem 0.65rem",
  borderRadius: "6px",
  border: "1px solid #D1D5DB",
  background: "#fff",
  fontSize: "0.8rem",
  cursor: "pointer",
};

type Props = {
  label: string;
  fileName?: string | null;
  staticUrl?: string | null;
  apiPath?: string;
  busy?: boolean;
  onView: () => void;
};

export default function AdminDocumentViewButton({
  label,
  fileName,
  staticUrl,
  apiPath,
  busy,
  onView,
}: Props) {
  const hasFile = !!(staticUrl || apiPath || fileName);

  if (!hasFile) {
    return (
      <span style={{ fontSize: "0.85rem", color: "#B45309" }} title={FILE_NOT_FOUND_MESSAGE}>
        {label}: {FILE_NOT_FOUND_MESSAGE}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onView}
      disabled={busy}
      title={fileName ? `Preview ${fileName}` : `Preview ${label}`}
      style={{
        ...btnStyle,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? "Loading…" : `View ${label}`}
    </button>
  );
}
