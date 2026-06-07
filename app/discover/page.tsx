import { DiscoverRows } from "@/components/discover-rows";
import { DiscoverSearch } from "@/components/discover-search";
import type { DiscoverRow, DiscoverRowId } from "@/lib/discover";
import { fetchCatalog } from "@/lib/server/metadata/cinemeta";
import { listMyAnimeListAnime } from "@/lib/server/myanimelist/auth-service";
import {
  getDiscoverRowOrder,
  visibleMyAnimeListStatuses,
} from "@/lib/server/myanimelist/discover-preferences";

export const metadata = {
  title: "Discover · dmaga",
};

// Cinemeta catalogs are revalidated at the fetch layer; render on demand.
export const dynamic = "force-dynamic";

/**
 * Discover board: Stremio-style poster rows. We fetch the "Popular" and "New"
 * catalogs for both movies and shows in parallel, then surface them as
 * horizontally-scrolling rows that link into the full per-type grids.
 */
export default async function DiscoverPage() {
  const [popularMovies, popularShows, newMovies, newShows, discoverOrder, malRows] =
    await Promise.all([
      fetchCatalog({ type: "movie", sort: "top" }),
      fetchCatalog({ type: "series", sort: "top" }),
      fetchCatalog({ type: "movie", sort: "year" }),
      fetchCatalog({ type: "series", sort: "year" }),
      getDiscoverRowOrder(),
      Promise.all(
        visibleMyAnimeListStatuses.map(async (status) => {
          try {
            const items = await listMyAnimeListAnime(status.id, 12);
            return {
              id: `mal:${status.id}` as DiscoverRowId,
              kind: "mal" as const,
              title: status.label,
              items,
            };
          } catch {
            return {
              id: `mal:${status.id}` as DiscoverRowId,
              kind: "mal" as const,
              title: status.label,
              items: [],
            };
          }
        }),
      ),
    ]);
  const rows = sortRows(
    [
      ...malRows,
      {
        id: "catalog:popular-movies",
        kind: "catalog",
        title: "Popular Movies",
        href: "/discover/movie",
        items: popularMovies,
      },
      {
        id: "catalog:popular-shows",
        kind: "catalog",
        title: "Popular Shows",
        href: "/discover/series",
        items: popularShows,
      },
      {
        id: "catalog:new-movies",
        kind: "catalog",
        title: "New Movies",
        href: "/discover/movie?sort=year",
        items: newMovies,
      },
      {
        id: "catalog:new-shows",
        kind: "catalog",
        title: "New Shows",
        href: "/discover/series?sort=year",
        items: newShows,
      },
    ],
    discoverOrder,
  );

  return (
    <div className="space-y-8">
      <header className="border-2 border-foreground bg-card p-4">
        <h1 className="text-2xl font-black">Discover</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Search across movies and shows, then grab the best source to your Real-Debrid
          library.
        </p>
      </header>

      <DiscoverSearch />
      <DiscoverRows initialRows={rows} />
    </div>
  );
}

function sortRows(rows: DiscoverRow[], order: DiscoverRowId[]) {
  const orderIndex = new Map(order.map((rowId, index) => [rowId, index]));
  return rows
    .filter((row) => row.items.length > 0)
    .sort(
      (a, b) =>
        (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
}
