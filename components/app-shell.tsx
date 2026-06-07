"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navigationItems } from "@/lib/navigation";

const HALFTONE_COLUMNS = 34;
const HALFTONE_ROWS = 26;
const HALFTONE_SPACING = 18;
const HALFTONE_DOTS = Array.from(
  { length: HALFTONE_COLUMNS * HALFTONE_ROWS },
  (_, index) => {
    const col = index % HALFTONE_COLUMNS;
    const row = Math.floor(index / HALFTONE_COLUMNS);
    const x = col * HALFTONE_SPACING + HALFTONE_SPACING / 2;
    const y = row * HALFTONE_SPACING + HALFTONE_SPACING / 2;
    const fromCorner = Math.hypot(col, HALFTONE_ROWS - 1 - row);
    const maxDistance = Math.hypot(HALFTONE_COLUMNS - 1, HALFTONE_ROWS - 1);
    const strength = Math.max(0, 1 - fromCorner / maxDistance);
    const radius = 0.65 + strength ** 1.7 * 4.6;

    return { x, y, radius };
  },
);

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
    <div className="relative isolate min-h-dvh overflow-hidden bg-background text-foreground">
      <HalftoneBackdrop id="bottom-left" />
      <HalftoneBackdrop
        className="bottom-auto left-auto right-0 top-0 rotate-180 opacity-[0.08]"
        id="top-right"
      />

      <header className="relative z-10 border-b-2 border-foreground bg-[hsl(52deg_65.22%_95.49%)]">
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

      <main className="container relative z-10 py-6">{children}</main>
    </div>
  );
}

function HalftoneBackdrop({ className, id }: { className?: string; id: string }) {
  const fadeId = `halftone-fade-${id}`;
  const maskId = `halftone-mask-${id}`;

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed bottom-0 left-0 z-0 h-[min(78vh,760px)] w-[min(78vw,900px)] text-foreground opacity-[0.11]",
        className,
      )}
      focusable="false"
      preserveAspectRatio="xMinYMax meet"
      viewBox={`0 0 ${HALFTONE_COLUMNS * HALFTONE_SPACING} ${
        HALFTONE_ROWS * HALFTONE_SPACING
      }`}
    >
      <defs>
        <linearGradient id={fadeId} x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor="white" />
          <stop offset="64%" stopColor="white" stopOpacity="0.78" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId}>
          <rect fill={`url(#${fadeId})`} height="100%" width="100%" />
        </mask>
      </defs>
      <g fill="currentColor" mask={`url(#${maskId})`}>
        {HALFTONE_DOTS.map((dot) => (
          <circle cx={dot.x} cy={dot.y} key={`${dot.x}-${dot.y}`} r={dot.radius} />
        ))}
      </g>
    </svg>
  );
}
