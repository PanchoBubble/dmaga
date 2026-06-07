import Link from "next/link";
import { ListFilter } from "lucide-react";

import { MyAnimeListAuthPanel } from "@/components/myanimelist-auth-panel";
import { RealDebridAuthPanel } from "@/components/real-debrid-auth-panel";
import { RestartAppCard } from "@/components/restart-app-card";
import { ServiceTests } from "@/components/service-tests";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return (
    <div className="space-y-6">
      <RealDebridAuthPanel initialStatus={{ linked: false }} />
      <MyAnimeListAuthPanel initialStatus={{ linked: false, configured: false }} />

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

      <ServiceTests />

      <RestartAppCard />
    </div>
  );
}
