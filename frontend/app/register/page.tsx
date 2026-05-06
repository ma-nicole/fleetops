"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CustomerDataFlowService } from "@/lib/customerDataFlowService";
import PhoneInputRow from "@/components/PhoneInputRow";
import {
  validateCustomerPassword,
  validateCompanyName,
  validateConfirmPassword,
  validateFirstName,
  validateLastName,
  validateRequiredInternationalPhone,
  isValidEmail,
  buildInternationalPhone,
} from "@/lib/formValidation";
import { DEFAULT_DIAL_CODE } from "@/lib/dialCodes";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneDial, setPhoneDial] = useState(DEFAULT_DIAL_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    companyName?: string;
    password?: string;
    confirmPassword?: string;
    phone?: string;
  }>({});

  const validate = (): boolean => {
    const next: typeof fieldErrors = {};
    const fn = validateFirstName(firstName);
    if (fn) next.firstName = fn;
    const ln = validateLastName(lastName);
    if (ln) next.lastName = ln;

    const mail = email.trim();
    if (!mail) next.email = "Email is required.";
    else if (!isValidEmail(mail)) next.email = "Enter a valid email address.";

    const co = validateCompanyName(companyName);
    if (co) next.companyName = co;

    const pw = validateCustomerPassword(password);
    if (pw) next.password = pw;

    const cpw = validateConfirmPassword(password, confirmPassword);
    if (cpw) next.confirmPassword = cpw;

    const ph = validateRequiredInternationalPhone(phoneDial, phoneNational);
    if (ph) next.phone = ph;

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    const combinedPhone = buildInternationalPhone(phoneDial, phoneNational);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const result = CustomerDataFlowService.register(fullName, email.trim(), password, combinedPhone || undefined);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/login");
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", minHeight: "100vh", background: "#FAFAFA" }}>
      <form
        onSubmit={submit}
        style={{ maxWidth: "460px", margin: "0 auto", background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1.2rem", display: "grid", gap: "0.85rem" }}
        noValidate
      >
        <h1 style={{ margin: 0 }}>Customer registration</h1>
        <p style={{ margin: 0, color: "#4B5563", fontSize: "0.9rem" }}>
          This form is for customers only. Drivers, dispatchers, and managers receive their accounts from the administrator.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>First name</span>
            <input
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (fieldErrors.firstName) setFieldErrors((p) => ({ ...p, firstName: undefined }));
              }}
              placeholder="First name"
              aria-invalid={!!fieldErrors.firstName}
              style={{
                padding: "0.7rem",
                border: fieldErrors.firstName ? "2px solid #DC2626" : "1px solid #D1D5DB",
                borderRadius: "6px",
              }}
            />
            {fieldErrors.firstName && (
              <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>{fieldErrors.firstName}</span>
            )}
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Last name</span>
            <input
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (fieldErrors.lastName) setFieldErrors((p) => ({ ...p, lastName: undefined }));
              }}
              placeholder="Last name"
              aria-invalid={!!fieldErrors.lastName}
              style={{
                padding: "0.7rem",
                border: fieldErrors.lastName ? "2px solid #DC2626" : "1px solid #D1D5DB",
                borderRadius: "6px",
              }}
            />
            {fieldErrors.lastName && (
              <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>{fieldErrors.lastName}</span>
            )}
          </label>
        </div>
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
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Company name</span>
          <input
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              if (fieldErrors.companyName) setFieldErrors((p) => ({ ...p, companyName: undefined }));
            }}
            placeholder="Company name"
            aria-invalid={!!fieldErrors.companyName}
            style={{
              padding: "0.7rem",
              border: fieldErrors.companyName ? "2px solid #DC2626" : "1px solid #D1D5DB",
              borderRadius: "6px",
            }}
          />
          {fieldErrors.companyName && (
            <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>{fieldErrors.companyName}</span>
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
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
            }}
            placeholder="Repeat your password"
            aria-invalid={!!fieldErrors.confirmPassword}
            style={{
              padding: "0.7rem",
              border: fieldErrors.confirmPassword ? "2px solid #DC2626" : "1px solid #D1D5DB",
              borderRadius: "6px",
            }}
          />
          {fieldErrors.confirmPassword && (
            <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>{fieldErrors.confirmPassword}</span>
          )}
        </label>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            Phone
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
