import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { countActiveAddedItems } from "@/lib/server/real-debrid/added-items";
import { countSavedItems } from "@/lib/server/saved-items";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "dmaga",
  description: "LAN-first Real-Debrid torrent manager",
};

/** Badge counts must reflect fresh state, so never statically cache them. */
async function getNavCount(query: () => Promise<number>): Promise<number> {
  try {
    return await query();
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
  const [addedCount, savedCount] = await Promise.all([
    getNavCount(countActiveAddedItems),
    getNavCount(countSavedItems),
  ]);

  return (
    <html lang="en">
      <body className={inter.className}>
        <AppShell addedCount={addedCount} savedCount={savedCount}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
