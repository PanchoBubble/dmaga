import { Compass } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { MangaSearch } from "@/components/manga-search";
import type { MangaCatalogItem } from "@/lib/manga";
import { fetchTopManga } from "@/lib/server/metadata/jikan-manga";

export const metadata = {
  title: "Manga · dmaga",
};

export const dynamic = "force-dynamic";

export default async function MangaPage() {
  // Sequential (not parallel) to stay under Jikan's ~3 req/s rate limit; each
  // fetch fails soft to an empty row, so a hiccup just hides that row.
  const popular = await fetchTopManga("bypopularity", 18);
  const publishing = await fetchTopManga("publishing", 12);
  const topRated = await fetchTopManga(null, 12);

  const rows: { title: string; subtitle: string; items: MangaCatalogItem[] }[] = [
    { title: "Popular Manga", subtitle: "Most members on MyAnimeList.", items: popular },
    {
      title: "Currently Publishing",
      subtitle: "Ongoing series with new chapters.",
      items: publishing,
    },
    { title: "Top Rated", subtitle: "Highest scored of all time.", items: topRated },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-2 border-foreground bg-card p-4 shadow-line">
        <div>
          <h1 className="text-2xl font-black">Manga</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Search manga by title, cover, and metadata, then find readable sources.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 border-2 border-foreground bg-[hsl(134deg_40%_82%)] px-3 py-2 text-sm font-black shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/manga/discover"
        >
          <Compass className="size-4" />
          Browse
        </Link>
      </header>

      <MangaSearch />

      {rows.map((row) =>
        row.items.length ? (
          <MangaRow
            items={row.items}
            key={row.title}
            subtitle={row.subtitle}
            title={row.title}
          />
        ) : null,
      )}
    </div>
  );
}

function MangaRow({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: MangaCatalogItem[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <Link
            className="group flex min-w-0 flex-col border-2 border-foreground bg-card shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={`/manga/${item.slug}`}
            key={item.slug}
          >
            <div className="relative aspect-[2/3] overflow-hidden border-b-2 border-foreground bg-secondary">
              {item.poster ? (
                <Image
                  alt={item.title}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
                  src={item.poster}
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center p-3 text-center text-sm font-black">
                  {item.title}
                </div>
              )}
            </div>
            <div className="p-2">
              <h3 className="line-clamp-2 min-h-[2.5em] text-sm font-black leading-tight">
                {item.title}
              </h3>
              <p className="line-clamp-1 text-xs font-bold text-muted-foreground">
                {item.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
