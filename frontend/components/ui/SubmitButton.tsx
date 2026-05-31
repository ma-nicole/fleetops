import type { ButtonHTMLAttributes, ReactNode } from "react";
import Spinner from "@/components/ui/Spinner";

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  busyLabel?: string;
  label: ReactNode;
  showSpinner?: boolean;
};

export default function SubmitButton({
  busy = false,
  busyLabel = "Processing…",
  label,
  showSpinner = true,
  disabled,
  className = "button",
  type = "submit",
  children,
  ...rest
}: SubmitButtonProps) {
  return (
    <button type={type} className={className} disabled={disabled || busy} aria-busy={busy} {...rest}>
      {busy ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
          {showSpinner ? <Spinner size="sm" /> : null}
          {busyLabel}
        </span>
      ) : (
        children ?? label
      )}
    </button>
  );
}
