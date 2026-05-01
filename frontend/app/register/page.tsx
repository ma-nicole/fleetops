"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CustomerDataFlowService } from "@/lib/customerDataFlowService";
import PhoneInputRow from "@/components/PhoneInputRow";
import {
  validateCustomerPassword,
  validateFullName,
  validateOptionalInternationalPhone,
  isValidEmail,
  buildInternationalPhone,
} from "@/lib/formValidation";
import { DEFAULT_DIAL_CODE } from "@/lib/dialCodes";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneDial, setPhoneDial] = useState(DEFAULT_DIAL_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    phone?: string;
  }>({});

  const validate = (): boolean => {
    const next: typeof fieldErrors = {};
    const fn = validateFullName(fullName);
    if (fn) next.fullName = fn;

    const mail = email.trim();
    if (!mail) next.email = "Email is required.";
    else if (!isValidEmail(mail)) next.email = "Enter a valid email address.";

    const pw = validateCustomerPassword(password);
    if (pw) next.password = pw;

    const ph = validateOptionalInternationalPhone(phoneDial, phoneNational);
    if (ph) next.phone = ph;

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    const combinedPhone = buildInternationalPhone(phoneDial, phoneNational);
    const result = CustomerDataFlowService.register(fullName.trim(), email.trim(), password, combinedPhone || undefined);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/login");
  };

  return (
    <main style={{ padding: "2rem", minHeight: "100vh", background: "#FAFAFA" }}>
      <form
        onSubmit={submit}
        style={{ maxWidth: "460px", margin: "0 auto", background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1.2rem", display: "grid", gap: "0.85rem" }}
        noValidate
      >
        <h1 style={{ margin: 0 }}>Customer registration</h1>
        <p style={{ margin: 0, color: "#4B5563", fontSize: "0.9rem" }}>
          This form is for customers only. Drivers, dispatchers, and managers receive their accounts from the administrator.
        </p>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Full name</span>
          <input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: undefined }));
            }}
            placeholder="Full name"
            aria-invalid={!!fieldErrors.fullName}
            style={{
              padding: "0.7rem",
              border: fieldErrors.fullName ? "2px solid #DC2626" : "1px solid #D1D5DB",
              borderRadius: "6px",
            }}
          />
          {fieldErrors.fullName && (
            <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>{fieldErrors.fullName}</span>
          )}
        </label>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            placeholder="Email"
            aria-invalid={!!fieldErrors.email}
            style={{
              padding: "0.7rem",
              border: fieldErrors.email ? "2px solid #DC2626" : "1px solid #D1D5DB",
              borderRadius: "6px",
            }}
          />
          {fieldErrors.email && (
            <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>{fieldErrors.email}</span>
          )}
        </label>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
            }}
            placeholder="At least 8 characters"
            aria-invalid={!!fieldErrors.password}
            style={{
              padding: "0.7rem",
              border: fieldErrors.password ? "2px solid #DC2626" : "1px solid #D1D5DB",
              borderRadius: "6px",
            }}
          />
          {fieldErrors.password && (
            <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>{fieldErrors.password}</span>
          )}
        </label>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            Phone <span style={{ fontWeight: 400, color: "#6B7280" }}>(optional)</span>
          </span>
          <PhoneInputRow
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
            optional
            error={fieldErrors.phone}
            nationalPlaceholder="9171234567"
            selectId="legacy-register-phone-cc"
            nationalId="legacy-register-phone-national"
          />
        </div>
        {error && <p style={{ margin: 0, color: "#DC2626" }} role="alert">{error}</p>}
        <button type="submit" style={{ border: "none", borderRadius: "6px", background: "#10B981", color: "white", fontWeight: 600, padding: "0.65rem 1rem", cursor: "pointer" }}>
          Create customer account
        </button>
        <Link href="/login" style={{ color: "#2563EB", textDecoration: "none", fontSize: "0.9rem" }}>Already registered? Login</Link>
      </form>
    </main>
  );
}
