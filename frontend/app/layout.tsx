import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import AppShell from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FleetOpt",
  description:
    "Fleet logistics platform built for Philippine operations — bookings, dispatch, and analytics with Philippine peso (PHP) and Manila time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-PH" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
