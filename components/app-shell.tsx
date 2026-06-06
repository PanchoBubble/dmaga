"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Database, Link2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { navigationItems } from "@/lib/navigation";

type RealDebridStatus = {
  linked: boolean;
  username?: string | null;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [realDebridStatus, setRealDebridStatus] = useState<RealDebridStatus>({
    linked: false,
  });

  useEffect(() => {
    let ignore = false;

    async function loadRealDebridStatus() {
      try {
        const response = await fetch("/api/auth/real-debrid/status", {
          cache: "no-store",
          signal: AbortSignal.timeout(2500),
        });

        if (!response.ok || ignore) {
          return;
        }

        setRealDebridStatus((await response.json()) as RealDebridStatus);
      } catch {
        if (!ignore) {
          setRealDebridStatus({ linked: false });
        }
      }
    }

    void loadRealDebridStatus();

    return () => {
      ignore = true;
    };
  }, []);

  const realDebridLabel = realDebridStatus.linked
    ? realDebridStatus.username
      ? realDebridStatus.username
      : "linked"
    : "offline";

  const serviceCounts = [
    { label: "Indexers", value: "0", icon: Database },
    { label: "Added", value: "0", icon: navigationItems[1].icon },
    { label: "Saved", value: "1", icon: navigationItems[2].icon },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b-2 border-foreground bg-card">
        <div className="container flex min-h-16 flex-col gap-3 py-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex min-h-10 items-center justify-between gap-3 lg:justify-start">
            <Link className="flex min-w-0 items-center gap-3" href="/">
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

            <div className="flex h-10 shrink-0 items-center justify-end gap-1 text-xs font-black uppercase lg:hidden">
              <span className="inline-flex h-8 items-center gap-1 border-2 border-foreground bg-background px-2">
                <Link2 className="size-3.5" />
                <span>RD: {realDebridLabel}</span>
              </span>
              {serviceCounts.map((state) => {
                const Icon = state.icon;

                return (
                  <span
                    aria-label={`${state.label}: ${state.value}`}
                    className="inline-flex h-8 min-w-8 items-center justify-center gap-1 border-2 border-foreground bg-background px-1.5"
                    key={state.label}
                  >
                    <Icon className="size-3.5" />
                    <span>{state.value}</span>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:contents">
            <nav className="grid grid-cols-4 gap-2 sm:flex sm:items-center sm:justify-end lg:col-start-2 lg:row-start-1 lg:justify-center">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    className={cn(
                      "inline-flex h-10 min-w-0 items-center justify-center gap-2 border-2 border-foreground px-2 text-sm font-semibold shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "bg-background text-foreground",
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="hidden h-10 items-center justify-end gap-2 text-xs font-black uppercase lg:col-start-3 lg:row-start-1 lg:flex">
              <span className="inline-flex h-10 items-center gap-1 border-2 border-foreground bg-background px-2">
                <Link2 className="size-3.5" />
                <span>RD: {realDebridLabel}</span>
              </span>
              {serviceCounts.map((state) => {
                const Icon = state.icon;

                return (
                  <span
                    aria-label={`${state.label}: ${state.value}`}
                    className="inline-flex h-10 min-w-10 items-center justify-center gap-1 border-2 border-foreground bg-background px-2"
                    key={state.label}
                  >
                    <Icon className="size-3.5" />
                    <span>{state.value}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}
