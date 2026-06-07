import Image from "next/image";

import { Button } from "@/components/ui/button";
import { myAnimeListStatuses, type MyAnimeListAnime } from "@/lib/myanimelist";
import { listMyAnimeListAnime } from "@/lib/server/myanimelist/auth-service";

export async function MyAnimeListDiscoverSection() {
  const rows = await Promise.all(
    myAnimeListStatuses.slice(0, 4).map(async (status) => {
      try {
        const items = await listMyAnimeListAnime(status.id, 12);
        return { ...status, items };
      } catch {
        return { ...status, items: [] };
      }
    }),
  );
  const visibleRows = rows.filter((row) => row.items.length > 0);

  if (!visibleRows.length) {
    return (
      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">MyAnimeList</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Link MAL in Settings to show Watching, Want to Watch, and Completed anime
              here.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href="/settings">Settings</a>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-black">MyAnimeList</h2>
      {visibleRows.map((row) => (
        <AnimeRow items={row.items} key={row.id} title={row.label} />
      ))}
    </section>
  );
}

function AnimeRow({ title, items }: { title: string; items: MyAnimeListAnime[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">{title}</h3>
        <a
          className="text-sm font-bold text-muted-foreground hover:text-foreground"
          href="https://myanimelist.net/animelist/"
          rel="noreferrer"
          target="_blank"
        >
          Open MAL
        </a>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {items.map((item) => (
          <AnimeCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}

function AnimeCard({ item }: { item: MyAnimeListAnime }) {
  return (
    <a
      className="group flex w-32 shrink-0 flex-col border-2 border-foreground bg-card shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-36"
      href={item.url}
      rel="noreferrer"
      target="_blank"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden border-b-2 border-foreground bg-muted">
        {item.picture ? (
          <Image
            alt={item.title}
            className="object-cover"
            fill
            sizes="9rem"
            src={item.picture}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm font-black">
            {item.title}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <h4 className="line-clamp-2 min-h-[2.5em] text-sm font-black leading-tight">
          {item.title}
        </h4>
        <span className="text-xs font-bold text-muted-foreground">
          {item.episodesWatched != null
            ? `${item.episodesWatched} watched`
            : item.score
              ? `Score ${item.score}`
              : "\u00a0"}
        </span>
      </div>
    </a>
  );
}
