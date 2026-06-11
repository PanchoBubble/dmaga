"use client";

import { BookOpen, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  chapterSortValue,
  type ProviderChapter,
  type ProviderSeriesDetails,
} from "@/lib/server/manga-providers/types";

/**
 * Provider-native series view. Loads details + chapters from /api/manga/series
 * client-side so the slow byparr Cloudflare solve (~20s) shows a spinner instead
 * of hanging the navigation on a blank "pending" tab.
 */
export function MangaSeries({
  provider,
  seriesId,
}: {
  provider: string;
  seriesId: string;
}) {
  const [series, setSeries] = useState<ProviderSeriesDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setSeries(null);
        setError(null);
        const params = new URLSearchParams({ provider, seriesId });
        const response = await fetch(`/api/manga/series?${params}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | { series: ProviderSeriesDetails }
          | { error?: string };
        if (!response.ok || !("series" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Failed to load.");
        }
        setSeries(payload.series);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(caught instanceof Error ? caught.message : "Failed to load.");
      }
    })();
    return () => controller.abort();
  }, [provider, seriesId]);

  if (error) {
    return (
      <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
        <p className="text-lg font-black">Couldn&apos;t load this series.</p>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="flex items-center gap-2 border-2 border-foreground bg-card p-4 text-sm font-bold shadow-line">
        <Loader2 className="size-4 animate-spin" />
        Clearing Cloudflare &amp; loading chapters… (can take ~20s)
      </div>
    );
  }

  const chapters = [...series.chapters].sort(
    (a, b) => chapterSortValue(a.number) - chapterSortValue(b.number),
  );

  return (
    <div className="space-y-6">
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
                  prefetch={false}
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
