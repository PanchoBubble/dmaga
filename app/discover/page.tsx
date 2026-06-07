import { DiscoverSearch } from "@/components/discover-search";
import { MyAnimeListDiscoverSection } from "@/components/myanimelist-discover-section";
import { PosterRow } from "@/components/poster-row";
import { fetchCatalog } from "@/lib/server/metadata/cinemeta";

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
  const [popularMovies, popularShows, newMovies, newShows] = await Promise.all([
    fetchCatalog({ type: "movie", sort: "top" }),
    fetchCatalog({ type: "series", sort: "top" }),
    fetchCatalog({ type: "movie", sort: "year" }),
    fetchCatalog({ type: "series", sort: "year" }),
  ]);

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
      <MyAnimeListDiscoverSection />

      <PosterRow href="/discover/movie" items={popularMovies} title="Popular Movies" />
      <PosterRow href="/discover/series" items={popularShows} title="Popular Shows" />
      <PosterRow
        href="/discover/movie?sort=year"
        items={newMovies}
        title="New Movies"
      />
      <PosterRow href="/discover/series?sort=year" items={newShows} title="New Shows" />
    </div>
  );
}
