import {
  MyAnimeListDiscoverRows,
  type MyAnimeListDiscoverRow,
} from "@/components/myanimelist-discover-rows";
import { Button } from "@/components/ui/button";
import type { MyAnimeListStatus } from "@/lib/myanimelist";
import { listMyAnimeListAnime } from "@/lib/server/myanimelist/auth-service";
import {
  getMyAnimeListDiscoverOrder,
  visibleMyAnimeListStatuses,
} from "@/lib/server/myanimelist/discover-preferences";

export async function MyAnimeListDiscoverSection() {
  const order = await getMyAnimeListDiscoverOrder().catch(() =>
    visibleMyAnimeListStatuses.map((status) => status.id),
  );
  const statusById = new Map<
    MyAnimeListStatus,
    (typeof visibleMyAnimeListStatuses)[number]
  >(visibleMyAnimeListStatuses.map((status) => [status.id, status]));
  const rows: Array<MyAnimeListDiscoverRow | null> = await Promise.all(
    order.map(async (statusId) => {
      const status = statusById.get(statusId);
      if (!status) {
        return null;
      }
      try {
        const items = await listMyAnimeListAnime(status.id, 12);
        return { id: status.id, label: status.label, items };
      } catch {
        return { id: status.id, label: status.label, items: [] };
      }
    }),
  );
  const visibleRows = rows.filter(
    (row): row is MyAnimeListDiscoverRow => row !== null && row.items.length > 0,
  );

  if (!visibleRows.length) {
    return (
      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">MyAnimeList</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Link MAL in Settings to show Watching and Want to Watch anime here.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href="/settings">Settings</a>
          </Button>
        </div>
      </section>
    );
  }

  return <MyAnimeListDiscoverRows initialRows={visibleRows} />;
}
