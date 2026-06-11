import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSeriesNative } from "@/lib/server/manga-providers";
import {
  chapterSortValue,
  type MangaProviderKey,
  type ProviderChapter,
} from "@/lib/server/manga-providers/types";

type SeriesPageProps = {
  params: Promise<{ provider: string; seriesId: string }>;
};

export const dynamic = "force-dynamic";

const NATIVE_PROVIDERS = new Set<MangaProviderKey>(["vymanga"]);

export default async function MangaSeriesPage({ params }: SeriesPageProps) {
  const { provider, seriesId } = await params;
  if (!NATIVE_PROVIDERS.has(provider as MangaProviderKey)) {
    notFound();
  }

  let series;
  try {
    series = await getSeriesNative(provider as MangaProviderKey, seriesId);
  } catch {
    notFound();
  }

  // Ascending (oldest first), matching the MAL-path chapter list convention.
  const chapters = [...series.chapters].sort(
    (a, b) => chapterSortValue(a.number) - chapterSortValue(b.number),
  );

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        href="/manga/discover"
      >
        <ArrowLeft className="size-4" />
        Back to Browse
      </Link>

      <section className="grid gap-4 border-2 border-foreground bg-card p-4 shadow-line sm:grid-cols-[9rem_1fr]">
        <div className="relative aspect-[2/3] w-36 max-w-full overflow-hidden border-2 border-foreground bg-secondary sm:w-full">
          {series.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={series.title}
              className="h-full w-full object-cover"
              src={`/api/manga/proxy?u=${encodeURIComponent(series.coverUrl)}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-3 text-center text-sm font-black">
              {series.title}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-black leading-tight sm:text-3xl">
            {series.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
            <span className="border-2 border-foreground bg-background px-2 py-1 uppercase">
              {series.provider}
            </span>
            {series.status ? (
              <span className="border-2 border-foreground bg-background px-2 py-1">
                {series.status}
              </span>
            ) : null}
            {series.author ? (
              <span className="border-2 border-foreground bg-background px-2 py-1">
                {series.author}
              </span>
            ) : null}
          </div>
          {series.genres.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {series.genres.map((genre) => (
                <span
                  className="border-2 border-foreground bg-background px-1.5 py-0.5 text-[10px] font-bold"
                  key={genre}
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}
          {series.description ? (
            <p className="mt-3 line-clamp-5 text-sm font-semibold leading-6">
              {series.description}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-black">Chapters</h2>
          <span className="border-2 border-foreground bg-background px-2 py-0.5 text-xs font-black tabular-nums">
            {chapters.length}
          </span>
        </div>

        {chapters.length === 0 ? (
          <p className="border-2 border-foreground bg-card p-3 text-sm font-bold text-muted-foreground shadow-line">
            No chapters found for this title.
          </p>
        ) : (
          <ul className="max-h-[32rem] divide-y-2 divide-foreground overflow-y-auto border-2 border-foreground bg-card shadow-line">
            {chapters.map((chapter) => (
              <li key={`${chapter.provider}:${chapter.id}`}>
                <Link
                  className="flex items-center gap-3 px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={chapterHref(chapter, series.title, series.seriesId)}
                >
                  <BookOpen className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-black leading-tight">
                    {chapterLabel(chapter)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function chapterLabel(chapter: ProviderChapter): string {
  if (chapter.number) {
    return chapter.title
      ? `Chapter ${chapter.number} — ${chapter.title}`
      : `Chapter ${chapter.number}`;
  }
  return chapter.title ?? "Oneshot";
}

function chapterHref(
  chapter: ProviderChapter,
  title: string,
  seriesId: string,
): string {
  const params = new URLSearchParams({ t: title, sid: seriesId });
  if (chapter.number) {
    params.set("ch", chapter.number);
  }
  return `/manga/read/${chapter.provider}/${chapter.id}?${params}`;
}
