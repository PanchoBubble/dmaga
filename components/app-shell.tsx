"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

  const serviceState = [
    {
      label: "RD",
      value: realDebridStatus.linked
        ? realDebridStatus.username
          ? realDebridStatus.username
          : "linked"
        : "offline",
    },
    { label: "Indexers", value: "0" },
    { label: "Added", value: "0" },
    { label: "Saved", value: "1" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b-2 border-foreground bg-card">
        <div className="container flex min-h-16 flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <Link className="flex items-center gap-3" href="/">
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

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
            <nav className="flex items-center justify-between gap-1 sm:justify-end">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    className={cn(
                      "inline-flex h-10 items-center gap-2 border-2 border-transparent px-3 text-sm font-semibold transition-colors",
                      isActive
                        ? "border-foreground bg-accent text-accent-foreground shadow-line"
                        : "text-muted-foreground hover:text-foreground",
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

            <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
              {serviceState.map((state) => (
                <span
                  className="border-2 border-foreground bg-background px-2 py-1"
                  key={state.label}
                >
                  {state.label}: {state.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}
