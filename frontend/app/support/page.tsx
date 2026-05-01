import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help & contact — FleetOpt",
  description: "FleetOpt support for teams operating in the Philippines. No sign-in required.",
};

/**
 * Public contact page — reachable while logged out (e.g. from sign-in).
 * Booking-linked feedback stays under /modules/customer/support (customer-only).
 */
export default function PublicSupportPage() {
  return (
    <div className="container" style={{ paddingTop: "1.5rem", paddingBottom: "3rem", maxWidth: 640 }}>
      <article className="card" style={{ display: "grid", gap: "1.25rem" }}>
        <header>
          <h1 style={{ margin: 0, fontSize: "var(--font-size-2xl)", color: "var(--primary)" }}>Help & contact</h1>
          <p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)", lineHeight: 1.55 }}>
            FleetOpt help desk for operators in the Philippines (hours shown in Manila / PHT). Reach out if you cannot sign in or have
            questions about bookings and payments in Philippine peso (PHP).
          </p>
        </header>

        <section style={{ display: "grid", gap: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Email</h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            Email{" "}
            <a href="mailto:support@fleetopt.com" className="auth-text-link">
              support@fleetopt.com
            </a>
            . Include the email address on your account if you are having trouble logging in.
          </p>
        </section>

        <section style={{ display: "grid", gap: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Booking-specific feedback</h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            <Link href="/sign-in" className="auth-text-link">
              Sign in
            </Link>{" "}
            first. In the customer portal, open <strong>Support</strong> in the sidebar to send feedback tied to a booking — an active session is required.
          </p>
        </section>

        <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
          <Link href="/sign-in" className="auth-text-link">
            Back to sign in
          </Link>
          {" · "}
          <Link href="/" className="auth-text-link">
            Home
          </Link>
        </p>
      </article>
    </div>
  );
}
