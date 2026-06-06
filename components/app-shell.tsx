"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navigationItems } from "@/lib/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b-2 border-foreground bg-card">
        <div className="container flex min-h-16 items-center justify-between gap-4 py-3">
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

          <nav className="flex items-center gap-1">
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
        </div>
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}
