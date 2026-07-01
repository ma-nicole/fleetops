"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SignOutConfirmDialog({ open, onCancel, onConfirm }: Props) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="auth-confirm-overlay" role="presentation" onClick={onCancel}>
      <div
        className="auth-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="signout-confirm-title"
        aria-describedby="signout-confirm-body"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="signout-confirm-title" className="auth-confirm-title">
          Sign out?
        </h2>
        <p id="signout-confirm-body" className="auth-confirm-body">
          Are you sure you want to sign out?
        </p>
        <div className="auth-confirm-actions">
          <button ref={cancelRef} type="button" className="auth-confirm-btn auth-confirm-btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="auth-confirm-btn auth-confirm-btn--primary" onClick={onConfirm}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
