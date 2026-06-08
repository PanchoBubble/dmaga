import { AddedItemCard } from "@/components/added-item-card";
import { listAddedItems } from "@/lib/server/real-debrid/added-items";

// Tracking state changes as items are added/polled, so always read fresh.
export const dynamic = "force-dynamic";

export default async function AddedPage() {
  let addedItems: Awaited<ReturnType<typeof listAddedItems>> = [];
  let dbReachable = true;
  try {
    addedItems = await listAddedItems();
  } catch {
    // DB unreachable (e.g. Postgres down or first boot) — degrade gracefully
    // instead of crashing the page; surface a distinct state below.
    dbReachable = false;
  }

  return (
    <div className="space-y-4">
      <section className="border-2 border-foreground bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Tracked</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Tracked Real-Debrid items will appear here.
            </p>
          </div>
        </div>
      </section>

      {!dbReachable ? (
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">Can&apos;t reach the database</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tracked items are unavailable right now. Check that Postgres is running,
            then refresh.
          </p>
        </div>
      ) : addedItems.length ? (
        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          {addedItems.map((item) => (
            <AddedItemCard item={item} key={item.id} />
          ))}
        </section>
      ) : (
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">No added torrents yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Search results you add will be tracked and polled until links are ready.
          </p>
        </div>
      )}
    </div>
  );
}
