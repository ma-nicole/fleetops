"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import PhoneInputRow from "@/components/PhoneInputRow";
import { useState } from "react";
import { DEFAULT_DIAL_CODE } from "@/lib/dialCodes";
import {
  buildInternationalPhone,
  isValidEmail,
  splitInternationalPhone,
  validateFullName,
  validateRequiredInternationalPhone,
} from "@/lib/formValidation";

type CustomerProfile = {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  postal_code: string;
  business_type: string;
  monthly_volume: number;
};

type FieldKey =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "address"
  | "city"
  | "postal_code"
  | "business_type";

type FieldErrors = Partial<Record<FieldKey, string>>;

export default function CustomerProfilePage() {
  useRoleGuard(["customer"]);

  const [profile, setProfile] = useState<CustomerProfile>({
    name: "John Smith",
    email: "john@example.com",
    phone: "+639171234567",
    company: "Smith Logistics",
    address: "123 Business Ave",
    city: "Makati City",
    postal_code: "10001",
    business_type: "Logistics Company",
    monthly_volume: 45,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(profile);
  const [phoneDial, setPhoneDial] = useState(DEFAULT_DIAL_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const border = (key: FieldKey) =>
    fieldErrors[key] ? "2px solid #DC2626" : "1px solid #E8E8E8";

  const validate = (): boolean => {
    const next: FieldErrors = {};

    const nameErr = validateFullName(formData.name);
    if (nameErr) next.name = nameErr;

    const mail = formData.email.trim();
    if (!mail) next.email = "Email is required.";
    else if (!isValidEmail(mail)) next.email = "Enter a valid email address.";

    const phoneErr = validateRequiredInternationalPhone(phoneDial, phoneNational);
    if (phoneErr) next.phone = phoneErr;

    if (formData.company.trim().length < 2) next.company = "Company must be at least 2 characters.";
    if (formData.address.trim().length < 5) next.address = "Enter a complete street address.";
    if (formData.city.trim().length < 2) next.city = "City is required.";
    if (formData.postal_code.trim().length < 3) next.postal_code = "Postal code is required.";
    if (formData.business_type.trim().length < 2) next.business_type = "Business type is required.";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const phoneStr = buildInternationalPhone(phoneDial, phoneNational);
    setProfile({ ...formData, email: formData.email.trim(), phone: phoneStr });
    setIsEditing(false);
    setFieldErrors({});
  };

  const toggleEdit = () => {
    if (isEditing) {
      setIsEditing(false);
      setFieldErrors({});
      return;
    }
    setFormData(profile);
    const sp = splitInternationalPhone(profile.phone);
    setPhoneDial(sp.dial);
    setPhoneNational(sp.national);
    setFieldErrors({});
    setIsEditing(true);
  };

  const clearFieldError = (key: FieldKey) => {
    if (fieldErrors[key]) setFieldErrors((p) => ({ ...p, [key]: undefined }));
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/customer" },
          { label: "Booking & Account" },
          { label: "My Profile" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           My Profile
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Manage your account information and preferences.
        </p>

        <button
          type="button"
          onClick={toggleEdit}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            marginBottom: "1rem",
          }}
        >
          {isEditing ? "Cancel" : "Edit Profile"}
        </button>

        {isEditing ? (
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "rgba(255, 152, 0, 0.05)",
              border: "1px solid #FFE0B2",
            }}
          >
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>
              Edit Profile
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    clearFieldError("name");
                  }}
                  aria-invalid={!!fieldErrors.name}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("name"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.name && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    clearFieldError("email");
                  }}
                  aria-invalid={!!fieldErrors.email}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("email"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.email && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.email}</p>
                )}
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Phone
                </label>
                <PhoneInputRow
                  dialCode={phoneDial}
                  nationalNumber={phoneNational}
                  onDialCodeChange={(d) => {
                    setPhoneDial(d);
                    clearFieldError("phone");
                  }}
                  onNationalChange={(n) => {
                    setPhoneNational(n);
                    clearFieldError("phone");
                  }}
                  error={fieldErrors.phone}
                  nationalPlaceholder="9171234567"
                  selectId="profile-phone-cc"
                  nationalId="profile-phone-national"
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => {
                    setFormData({ ...formData, company: e.target.value });
                    clearFieldError("company");
                  }}
                  aria-invalid={!!fieldErrors.company}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("company"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.company && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.company}</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => {
                    setFormData({ ...formData, address: e.target.value });
                    clearFieldError("address");
                  }}
                  aria-invalid={!!fieldErrors.address}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("address"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.address && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.address}</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => {
                    setFormData({ ...formData, city: e.target.value });
                    clearFieldError("city");
                  }}
                  aria-invalid={!!fieldErrors.city}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("city"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.city && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.city}</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Postal Code
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => {
                    setFormData({ ...formData, postal_code: e.target.value });
                    clearFieldError("postal_code");
                  }}
                  aria-invalid={!!fieldErrors.postal_code}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("postal_code"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.postal_code && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.postal_code}</p>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Business Type
                </label>
                <input
                  type="text"
                  value={formData.business_type}
                  onChange={(e) => {
                    setFormData({ ...formData, business_type: e.target.value });
                    clearFieldError("business_type");
                  }}
                  aria-invalid={!!fieldErrors.business_type}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("business_type"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.business_type && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.business_type}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem",
                background: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save Changes
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: "1.5rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "2rem",
              }}
            >
              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Name</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.name}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Email</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.email}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Phone</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.phone}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Company</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: 0 }}>
                  {profile.company}
                </p>
              </div>

              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Address</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.address}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>City</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.city}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Postal Code</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.postal_code}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Business Type</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: 0 }}>
                  {profile.business_type}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
