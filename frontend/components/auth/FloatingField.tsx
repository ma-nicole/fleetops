"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "placeholder"> & {
  id: string;
  label: string;
  error?: string;
  /** Quiet helper shown when there is no error (password rules, format hints). */
  hint?: string;
  endSlot?: ReactNode;
};

export default function FloatingField({ id, label, error, hint, endSlot, ...inputProps }: Props) {
  const errClass = error ? "floating-field-input error" : "floating-field-input";
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedByParts: string[] = [];
  if (hint && !error) describedByParts.push(hintId);
  if (error) describedByParts.push(errorId);
  const describedBy = describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

  return (
    <div className="floating-field">
      <div className={`floating-field-row ${endSlot ? "has-end" : ""}`}>
        <div className="floating-field-input-wrap">
          <input
            id={id}
            className={errClass}
            placeholder=" "
            aria-invalid={!!error}
            aria-describedby={describedBy}
            {...inputProps}
          />
          <label htmlFor={id} className="floating-field-label">
            {label}
          </label>
        </div>
        {endSlot ?? null}
      </div>
      {error ? (
        <p id={errorId} className="floating-field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="floating-field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
