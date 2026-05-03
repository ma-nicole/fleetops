import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import "./globals.css";
import AppShell from "@/components/AppShell";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FleetOpt",
  description:
    "Fleet logistics platform built for Philippine operations — bookings, dispatch, and analytics with Philippine peso (PHP) and Manila time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-PH" suppressHydrationWarning>
      <body className={spaceGrotesk.className} suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
