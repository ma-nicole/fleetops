"use client";

import { getPasswordRequirementChecks } from "@/lib/formValidation";

type Props = {
  password: string;
  id?: string;
};

export default function PasswordRequirements({ password, id = "password-requirements" }: Props) {
  const checks = getPasswordRequirementChecks(password);
  const showIndicators = password.length > 0;

  if (!showIndicators) {
    return (
      <p className="auth-password-requirements-hint" id={id}>
        Use at least 8 characters with uppercase, lowercase, a number, and a special character.
      </p>
    );
  }

  return (
    <ul className="auth-password-requirements" id={id} aria-label="Password requirements">
      {checks.map((check) => (
        <li
          key={check.id}
          className={check.met ? "auth-password-requirement auth-password-requirement--met" : "auth-password-requirement"}
        >
          <span className="auth-password-requirement-icon" aria-hidden="true">
            {check.met ? "✓" : "○"}
          </span>
          <span>{check.label}</span>
        </li>
      ))}
    </ul>
  );
}
