"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFullUrl } from "@/lib/api";
import PhoneInputRow from "@/components/PhoneInputRow";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import FloatingField from "@/components/auth/FloatingField";
import PasswordRequirements from "@/components/auth/PasswordRequirements";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  AUTH_COMPANY_MAX_LENGTH,
  AUTH_EMAIL_MAX_LENGTH,
  AUTH_NAME_MAX_LENGTH,
  AUTH_PASSWORD_MAX_LENGTH,
  buildInternationalPhone,
  normalizeAuthName,
  sanitizeAuthEmail,
  sanitizeAuthNameInput,
  sanitizeAuthPassword,
  sanitizeAuthText,
  validateCustomerPassword,
  validateCompanyName,
  validateConfirmPassword,
  validateFirstName,
  validateLastName,
  validateRequiredInternationalPhone,
} from "@/lib/formValidation";
import { DEFAULT_DIAL_CODE } from "@/lib/dialCodes";
import { announce } from "@/lib/useAnnouncer";

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  companyName?: string;
  password?: string;
  confirmPassword?: string;
  phone?: string;
  terms?: string;
};

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phoneDial, setPhoneDial] = useState(DEFAULT_DIAL_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (error && errorBannerRef.current) {
      errorBannerRef.current.focus();
      announce(error, "assertive");
    }
  }, [error]);

  const validateFields = (): boolean => {
    const next: FieldErrors = {};
    const normalizedFirst = normalizeAuthName(firstName, AUTH_NAME_MAX_LENGTH);
    const normalizedLast = normalizeAuthName(lastName, AUTH_NAME_MAX_LENGTH);
    if (normalizedFirst !== firstName) setFirstName(normalizedFirst);
    if (normalizedLast !== lastName) setLastName(normalizedLast);

    const fnErr = validateFirstName(normalizedFirst);
    if (fnErr) next.firstName = fnErr;

    const lnErr = validateLastName(normalizedLast);
    if (lnErr) next.lastName = lnErr;

    const mail = sanitizeAuthEmail(email);
    if (!mail) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      next.email = "Enter a valid email address (e.g. you@example.com).";
    }

    const coErr = validateCompanyName(sanitizeAuthText(companyName, AUTH_COMPANY_MAX_LENGTH));
    if (coErr) next.companyName = coErr;

    const pwErr = validateCustomerPassword(password);
    if (pwErr) next.password = pwErr;

    const cpwErr = validateConfirmPassword(sanitizeAuthPassword(password), sanitizeAuthPassword(confirmPassword));
    if (cpwErr) next.confirmPassword = cpwErr;

    const phoneErr = validateRequiredInternationalPhone(phoneDial, phoneNational);
    if (phoneErr) next.phone = phoneErr;

    if (!acceptedTerms) {
      next.terms = "Please accept the terms to continue.";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validateFields()) return;
    setIsSubmitting(true);

    const mail = sanitizeAuthEmail(email);
    const combinedPhone = buildInternationalPhone(phoneDial, phoneNational);
    const fullName = normalizeAuthName(
      `${normalizeAuthName(firstName, AUTH_NAME_MAX_LENGTH)} ${normalizeAuthName(lastName, AUTH_NAME_MAX_LENGTH)}`,
      AUTH_NAME_MAX_LENGTH,
    );
    const safePassword = sanitizeAuthPassword(password);

    try {
      const response = await fetch(apiFullUrl("/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: mail,
          password: safePassword,
          full_name: fullName,
          company_name: sanitizeAuthText(companyName, AUTH_COMPANY_MAX_LENGTH),
          phone: combinedPhone,
          role: "customer",
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.text();
        let message = "Unable to register";
        try {
          const parsed = JSON.parse(body);
          message = parsed.detail || message;
        } catch {
          if (body) message = body;
        }
        throw new Error(message);
      }

      announce("Account created. Redirecting to sign in.", "polite");
      setSuccess("Customer account created. Redirecting to sign in...");
      setTimeout(() => router.push("/sign-in"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register");
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      ctaHeading={
        <>
          Get <span className="auth-cta-title-accent">Started</span>
        </>
      }
      ctaSubtitle="Already have an account?"
      ctaHref="/sign-in"
      ctaButtonLabel="Log in"
    >
      <h1 className="auth-page-title" id="signup-title">
        Create Account
      </h1>
      <p className="auth-page-lede">
        Customer accounts only — dispatchers and drivers get invites from your administrator.
      </p>

      <form className="auth-form-stack" onSubmit={handleSubmit} noValidate aria-labelledby="signup-title">
        {error ? (
          <div ref={errorBannerRef} className="auth-banner auth-banner--error" role="alert" tabIndex={-1}>
            <span className="auth-banner-icon" aria-hidden="true">
              !
            </span>
            <div className="auth-banner-text">
              <p className="auth-banner-title">Something went wrong</p>
              <p className="auth-banner-body">{error}</p>
            </div>
          </div>
        ) : null}
        {success ? (
          <div className="auth-banner auth-banner--success" role="status" aria-live="polite">
            <span className="auth-banner-icon auth-banner-icon--success" aria-hidden="true">
              ✓
            </span>
            <div className="auth-banner-text">
              <p className="auth-banner-title">You&apos;re all set</p>
              <p className="auth-banner-body">{success}</p>
            </div>
          </div>
        ) : null}

        <div className="auth-two-col">
          <FloatingField
            id="signup-first-name"
            label="First name"
            autoComplete="given-name"
            value={firstName}
            maxLength={AUTH_NAME_MAX_LENGTH}
            onChange={(event) => {
              setFirstName(sanitizeAuthNameInput(event.target.value, AUTH_NAME_MAX_LENGTH));
              if (fieldErrors.firstName) setFieldErrors((p) => ({ ...p, firstName: undefined }));
            }}
            onBlur={() => setFirstName((v) => normalizeAuthName(v, AUTH_NAME_MAX_LENGTH))}
            error={fieldErrors.firstName}
          />
          <FloatingField
            id="signup-last-name"
            label="Last name"
            autoComplete="family-name"
            value={lastName}
            maxLength={AUTH_NAME_MAX_LENGTH}
            onChange={(event) => {
              setLastName(sanitizeAuthNameInput(event.target.value, AUTH_NAME_MAX_LENGTH));
              if (fieldErrors.lastName) setFieldErrors((p) => ({ ...p, lastName: undefined }));
            }}
            onBlur={() => setLastName((v) => normalizeAuthName(v, AUTH_NAME_MAX_LENGTH))}
            error={fieldErrors.lastName}
          />
        </div>

        <FloatingField
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          maxLength={AUTH_EMAIL_MAX_LENGTH}
          onChange={(event) => {
            setEmail(sanitizeAuthEmail(event.target.value));
            if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
          }}
          error={fieldErrors.email}
          hint={!fieldErrors.email ? "Booking confirmations and receipts go here." : undefined}
        />

        <FloatingField
          id="signup-company"
          label="Company name"
          autoComplete="organization"
          value={companyName}
          maxLength={AUTH_COMPANY_MAX_LENGTH}
          onChange={(event) => {
            setCompanyName(sanitizeAuthText(event.target.value, AUTH_COMPANY_MAX_LENGTH));
            if (fieldErrors.companyName) setFieldErrors((p) => ({ ...p, companyName: undefined }));
          }}
          error={fieldErrors.companyName}
        />

        <FloatingField
          id="signup-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          maxLength={AUTH_PASSWORD_MAX_LENGTH}
          onChange={(event) => {
            setPassword(sanitizeAuthPassword(event.target.value));
            if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
          }}
          error={fieldErrors.password}
          aria-describedby={fieldErrors.password ? "signup-password-error password-requirements" : "password-requirements"}
          endSlot={
            <button
              type="button"
              className="auth-icon-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          }
        />

        <PasswordRequirements password={password} />

        <FloatingField
          id="signup-confirm-password"
          label="Confirm password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          maxLength={AUTH_PASSWORD_MAX_LENGTH}
          onChange={(event) => {
            setConfirmPassword(sanitizeAuthPassword(event.target.value));
            if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
          }}
          error={fieldErrors.confirmPassword}
        />

        <div className="auth-phone-block">
          <div className="auth-field-label">
            Phone
          </div>
          <PhoneInputRow
            variant="light"
            dialCode={phoneDial}
            nationalNumber={phoneNational}
            onDialCodeChange={(d) => {
              setPhoneDial(d);
              if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
            }}
            onNationalChange={(n) => {
              setPhoneNational(n);
              if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
            }}
            error={fieldErrors.phone}
            nationalPlaceholder="9171234567"
            selectId="signup-phone-cc"
            nationalId="signup-phone-national"
          />
        </div>

        <fieldset className="auth-terms-fieldset">
          <legend className="sr-only">Terms</legend>
          <div className="auth-terms-stack">
            <div className="auth-terms-row">
              <input
                id="signup-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  if (fieldErrors.terms) setFieldErrors((p) => ({ ...p, terms: undefined }));
                }}
                aria-invalid={!!fieldErrors.terms}
                className="auth-terms-checkbox"
              />
              <label htmlFor="signup-terms" className="auth-terms-label">
                I accept the terms of the agreement.
              </label>
            </div>
            <p className="auth-terms-meta">
              <Link href="/support" className="auth-text-link">
                Policies & customer support
              </Link>
            </p>
          </div>
          {fieldErrors.terms ? (
            <p className="floating-field-error auth-terms-error" role="alert">
              {fieldErrors.terms}
            </p>
          ) : null}
        </fieldset>

        <SubmitButton className="auth-primary-btn" busy={isSubmitting} busyLabel="Creating account…" label="Create account" />
      </form>

      <footer className="auth-form-footer">
        <p className="auth-footnote">
          Staff member? Ask your administrator to create your FleetOpt account.
        </p>
      </footer>
    </AuthSplitLayout>
  );
}
