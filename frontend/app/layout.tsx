import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import "./globals.css";
import AppShell from "@/components/AppShell";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FleetOpt",
  description: "Logistics and fleet optimization platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
