import Image from "next/image";
import Link from "next/link";

import { MangaSearch } from "@/components/manga-search";
import { fetchPopularMangaCatalog } from "@/lib/server/metadata/jikan-manga";

export const metadata = {
  title: "Manga · dmaga",
};

export const dynamic = "force-dynamic";

export default async function MangaPage() {
  const popularManga = await fetchPopularMangaCatalog(18);

  return (
    <div className="space-y-6">
      <header className="border-2 border-foreground bg-card p-4 shadow-line">
        <h1 className="text-2xl font-black">Manga</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Search manga by title, cover, and metadata, then find readable sources.
        </p>
      </header>

      <MangaSearch />

      <div>
        <h2 className="text-xl font-black">Popular Manga</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Powered by Jikan&apos;s MyAnimeList catalog.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {popularManga.map((item) => (
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
              <h2 className="line-clamp-2 min-h-[2.5em] text-sm font-black leading-tight">
                {item.title}
              </h2>
              <p className="line-clamp-1 text-xs font-bold text-muted-foreground">
                {item.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
