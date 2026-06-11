import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { MangaDiscover } from "@/components/manga-discover";
import { getDiscoverFeed, getGenres } from "@/lib/server/manga-providers";
import type {
  ProviderGenre,
  ProviderSeries,
} from "@/lib/server/manga-providers/types";

export const metadata = {
  title: "Browse · Manga · dmaga",
};

export const dynamic = "force-dynamic";

export default async function MangaDiscoverPage() {
  // Best-effort: a provider hiccup just yields an empty grid / no genres.
  const [initialSeries, genres] = await Promise.all([
    getDiscoverFeed("popular", 1).catch((): ProviderSeries[] => []),
    getGenres("vymanga").catch((): ProviderGenre[] => []),
  ]);

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        href="/manga"
      >
        <ArrowLeft className="size-4" />
        Back to Manga
      </Link>

      <header className="border-2 border-foreground bg-card p-4 shadow-line">
        <h1 className="text-2xl font-black">Browse Manga</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          New &amp; popular titles straight from VyManga — read online, no download.
        </p>
      </header>

      <MangaDiscover genres={genres} initialSeries={initialSeries} />
    </div>
  );
}
