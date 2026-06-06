"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navigationItems } from "@/lib/navigation";

export function AppShell({
  children,
  addedCount = 0,
  savedCount = 0,
}: {
  children: React.ReactNode;
  /** Number of tracked Real-Debrid items, badged on the Added tab. */
  addedCount?: number;
  /** Number of starred torrents, badged on the Saved tab. */
  savedCount?: number;
}) {
  const pathname = usePathname();

  // Counts surfaced as small badges on their matching nav tabs.
  const navCounts: Record<string, number> = {
    "/added": addedCount,
    "/saved": savedCount,
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b-2 border-foreground bg-[hsl(52deg_65.22%_95.49%)]">
        <div className="container flex min-h-16 items-center justify-between gap-4 py-3">
          <Link className="flex shrink-0 items-center gap-3" href="/">
            <Image
              alt="dmaga"
              className="h-10 w-auto object-contain"
              height={80}
              priority
              src="/dmaga-logo.png"
              width={160}
            />
            <span className="sr-only">dmaga</span>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const count = navCounts[item.href];

              return (
                <Link
                  className={cn(
                    "relative inline-flex h-10 w-12 items-center justify-center gap-2 border-2 border-foreground px-2 text-sm font-semibold shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-28 sm:px-3",
                    isActive
                      ? "pointer-events-none bg-[hsl(134deg_40%_82%)] text-foreground"
                      : "bg-background text-foreground",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                  {count !== undefined ? (
                    <span
                      aria-label={`${item.label}: ${count}`}
                      className="absolute -bottom-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center border-2 border-foreground bg-background px-1 text-[10px] font-black tabular-nums"
                    >
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}
