"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

type Props = {
  bookingId?: number | null;
  label?: string;
  style?: CSSProperties;
  className?: string;
};

/** Customer CTA into support with optional booking preselect query. */
export default function ContactSupportButton({
  bookingId,
  label = "Contact Support",
  style,
  className,
}: Props) {
  const href =
    bookingId != null && Number.isFinite(bookingId) && bookingId > 0
      ? `/modules/customer/support?booking=${bookingId}`
      : "/modules/customer/support";

  return (
    <Link
      href={href}
      className={className ?? "quick-action-btn"}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {label}
    </Link>
  );
}
