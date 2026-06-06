import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { countActiveAddedItems } from "@/lib/server/real-debrid/added-items";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "dmaga",
  description: "LAN-first Real-Debrid torrent manager",
};

/** Badge count must reflect freshly-added items, so never statically cache it. */
async function getAddedCount(): Promise<number> {
  try {
    return await countActiveAddedItems();
  } catch {
    // DB not reachable yet (e.g. first boot) — fall back to no badge.
    return 0;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const addedCount = await getAddedCount();

  return (
    <html lang="en">
      <body className={inter.className}>
        <AppShell addedCount={addedCount}>{children}</AppShell>
      </body>
    </html>
  );
}
