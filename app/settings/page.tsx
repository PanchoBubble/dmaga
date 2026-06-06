import Link from "next/link";
import { ListFilter, TestTube2 } from "lucide-react";

import { RealDebridAuthPanel } from "@/components/real-debrid-auth-panel";
import { RestartAppCard } from "@/components/restart-app-card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return (
    <div className="space-y-6">
      <RealDebridAuthPanel initialStatus={{ linked: false }} />

      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Settings</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Configure Real-Debrid, indexers, and local runtime services.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/indexers">
              <ListFilter className="size-4" />
              Indexers
            </Link>
          </Button>
        </div>
      </section>

      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <h2 className="text-xl font-black">Services</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["Postgres", "Redis", "FlareSolverr"].map((service) => (
            <div
              className="flex items-center justify-between border-2 border-foreground bg-background p-3"
              key={service}
            >
              <span className="font-bold">{service}</span>
              <Button size="sm" variant="outline">
                <TestTube2 className="size-4" />
                Test
              </Button>
            </div>
          ))}
        </div>
      </section>

      <RestartAppCard />
    </div>
  );
}
