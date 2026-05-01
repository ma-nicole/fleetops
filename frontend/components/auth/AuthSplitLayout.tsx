"use client";

import Link from "next/link";

type Props = {
  children: React.ReactNode;
  /** Main heading inside the accent panel (can include markup via React fragment). */
  ctaHeading: React.ReactNode;
  ctaSubtitle: string;
  ctaHref: string;
  ctaButtonLabel: string;
};

export default function AuthSplitLayout({ children, ctaHeading, ctaSubtitle, ctaHref, ctaButtonLabel }: Props) {
  return (
    <section className="auth-split" aria-label="Account">
      <div className="auth-split-decor" aria-hidden="true">
        <span className="auth-split-circle auth-split-circle-a" />
        <span className="auth-split-circle auth-split-circle-b" />
        <span className="auth-split-circle auth-split-circle-c" />
      </div>

      <div className="auth-split-inner">
        <div className="auth-unified-shell">
          <div className="auth-unified-blob" aria-hidden="true" />
          <div className="auth-unified-grid">
            <div className="auth-unified-form-side">
              <nav className="auth-form-nav" aria-label="Account navigation">
                <Link href="/" className="auth-back-link">
                  <span aria-hidden="true" className="auth-back-arrow">
                    ‹
                  </span>
                  Home Page
                </Link>
              </nav>

              <header className="auth-form-brand-row">
                <p className="auth-form-brand-mark">FleetOpt</p>
                <p className="auth-form-brand-tagline">Fleet operations platform</p>
              </header>

              {children}
            </div>

            <aside className="auth-unified-cta-side" aria-label="Alternative account actions">
              <div className="auth-unified-cta-content">
                <h2 className="auth-cta-title">{ctaHeading}</h2>
                <p className="auth-cta-subtitle">{ctaSubtitle}</p>
                <Link href={ctaHref} className="auth-cta-btn-outline">
                  {ctaButtonLabel}
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
