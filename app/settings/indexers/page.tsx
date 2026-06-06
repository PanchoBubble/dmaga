import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { IndexerSettings } from "@/components/indexer-settings";
import { Button } from "@/components/ui/button";
import type { IndexerDto } from "@/lib/indexers";
import { listIndexers } from "@/lib/server/indexers/manage";

export const dynamic = "force-dynamic";

export default async function IndexerSettingsPage() {
  let indexers: IndexerDto[] = [];
  try {
    indexers = await listIndexers();
  } catch {
    indexers = [];
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="outline">
        <Link href="/settings">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
      </Button>

      <IndexerSettings initialIndexers={indexers} />
    </div>
  );
}
