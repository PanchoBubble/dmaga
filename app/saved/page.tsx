import { Star } from "lucide-react";

import { TorrentResultCard } from "@/components/torrent-result-card";
import { listSavedItems } from "@/lib/server/saved-items";

// Saved state changes as the user stars/unstars results, so always read fresh.
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  let savedItems: Awaited<ReturnType<typeof listSavedItems>> = [];
  let dbReachable = true;
  try {
    savedItems = await listSavedItems();
  } catch {
    // DB unreachable (e.g. Postgres down or first boot) — degrade gracefully
    // instead of crashing the page; surface a distinct state below.
    dbReachable = false;
  }

  return (
    <div className="space-y-4">
      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex items-center gap-3">
          <Star className="size-6 fill-current" />
          <div>
            <h1 className="text-2xl font-black">Saved</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Starred torrents stay here until you add or remove them.
            </p>
          </div>
        </div>
      </section>

      {!dbReachable ? (
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">Can&apos;t reach the database</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Saved torrents are unavailable right now. Check that Postgres is running,
            then refresh.
          </p>
        </div>
      ) : savedItems.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {savedItems.map((item, index) => (
            <TorrentResultCard index={index} key={item.id} result={item} />
          ))}
        </section>
      ) : (
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">Nothing saved yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the star on search results to save torrents for later.
          </p>
        </div>
      )}
    </div>
  );
}
