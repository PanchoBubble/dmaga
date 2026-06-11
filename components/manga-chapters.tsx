"use client";

import { BookOpen, Check, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useChapterProgress } from "@/components/use-chapter-progress";
import { chapterUnitKey, malSeriesKey } from "@/lib/progress";
import { cn } from "@/lib/utils";
import type { ProviderChapter } from "@/lib/server/manga-providers/types";

type ChaptersResponse = { chapters: ProviderChapter[]; sources: string[] };

/**
 * The primary manga reading path: a complete chapter list from online providers
 * (MangaDex/Comick), read directly — no torrents, no Real-Debrid. Torrent/IA
 * sources render below as a fallback.
 */
export function MangaChapters({
  malId,
  title,
  slug,
}: {
  malId: number;
  title: string;
  slug: string;
}) {
  const [chapters, setChapters] = useState<ProviderChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seriesKey = malSeriesKey(malId);
  const { units, series: resume, markRead } = useChapterProgress(seriesKey);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        setChapters(null);
        setError(null);
        const params = new URLSearchParams({ malId: String(malId), title });
        const response = await fetch(`/api/manga/chapters?${params}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as ChaptersResponse | { error?: string };
        if (!response.ok || !("chapters" in payload)) {
          throw new Error(
            ("error" in payload && payload.error) || "Unable to load chapters.",
          );
        }
        setChapters(payload.chapters);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(caught instanceof Error ? caught.message : "Unable to load chapters.");
      }
    })();

    return () => controller.abort();
  }, [malId, title]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-black">Read Online</h2>
        {chapters ? (
          <span className="border-2 border-foreground bg-background px-2 py-0.5 text-xs font-black tabular-nums">
            {chapters.length}
          </span>
        ) : null}
        <span className="text-sm font-semibold text-muted-foreground">
          Chapters from MangaDex / Weeb Central — instant, no download.
        </span>
        {resume?.lastChapterId ? (
          <Link
            className="ml-auto inline-flex items-center gap-2 border-2 border-foreground bg-[hsl(134deg_40%_82%)] px-3 py-1.5 text-sm font-black shadow-line transition-transform hover:-translate-y-0.5"
            href={`/manga/read/${resume.lastProvider ?? "mangadex"}/${resume.lastChapterId}?${new URLSearchParams(
              {
                t: title,
                s: slug,
                ...(resume.lastChapterNumber ? { ch: resume.lastChapterNumber } : {}),
              },
            )}`}
            prefetch={false}
          >
            <Play className="size-4" />
            Continue{resume.lastChapterNumber ? ` Ch. ${resume.lastChapterNumber}` : ""}
          </Link>
        ) : null}
      </div>

      {chapters === null && !error ? (
        <div className="flex items-center gap-2 border-2 border-foreground bg-card p-3 text-sm font-bold shadow-line">
          <Loader2 className="size-4 animate-spin" />
          Loading chapters…
        </div>
      ) : null}

      {error ? (
        <p className="border-2 border-foreground bg-card p-3 text-sm font-bold text-muted-foreground shadow-line">
          No online chapters found ({error}). Try the sources below.
        </p>
      ) : null}

      {chapters && chapters.length === 0 && !error ? (
        <p className="border-2 border-foreground bg-card p-3 text-sm font-bold text-muted-foreground shadow-line">
          No online chapters found for this title. Try the sources below.
        </p>
      ) : null}

      {chapters && chapters.length ? (
        <ul className="max-h-[28rem] divide-y-2 divide-foreground overflow-y-auto border-2 border-foreground bg-card shadow-line">
          {chapters.map((chapter) => {
            const unitKey = chapterUnitKey(chapter.number, chapter.id);
            const read = units[unitKey]?.completed ?? false;
            return (
              <li className="flex items-center" key={`${chapter.provider}:${chapter.id}`}>
                <Link
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    read && "text-muted-foreground",
                  )}
                  href={chapterHref(chapter, title, slug)}
                >
                  <BookOpen className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black leading-tight">
                      {chapterLabel(chapter)}
                    </span>
                    {chapter.group ? (
                      <span className="block truncate text-xs font-semibold text-muted-foreground">
                        {chapter.group}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 border-2 border-foreground bg-background px-1.5 py-0.5 text-[10px] font-black uppercase">
                    {chapter.provider}
                  </span>
                </Link>
                <button
                  aria-label={read ? "Mark unread" : "Mark read"}
                  className={cn(
                    "mr-2 inline-flex size-7 shrink-0 items-center justify-center border-2 border-foreground transition-colors",
                    read ? "bg-[hsl(134deg_40%_82%)]" : "bg-background hover:bg-accent",
                  )}
                  onClick={() =>
                    void markRead({
                      seriesKey,
                      source: "mal",
                      title,
                      provider: chapter.provider,
                      chapterId: chapter.id,
                      number: chapter.number,
                      unitKey,
                      completed: !read,
                    })
                  }
                  title={read ? "Mark unread" : "Mark read"}
                  type="button"
                >
                  <Check className={cn("size-4", !read && "opacity-25")} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function chapterLabel(chapter: ProviderChapter): string {
  const vol = chapter.volume ? `Vol. ${chapter.volume} · ` : "";
  if (chapter.number) {
    return chapter.title
      ? `${vol}Chapter ${chapter.number} — ${chapter.title}`
      : `${vol}Chapter ${chapter.number}`;
  }
  // No parsed number — show the provider's own label, not a generic "Oneshot".
  return `${vol}${chapter.title ?? "Oneshot"}`;
}

function chapterHref(chapter: ProviderChapter, title: string, slug: string): string {
  const params = new URLSearchParams({ t: title, s: slug });
  if (chapter.number) {
    params.set("ch", chapter.number);
  }
  return `/manga/read/${chapter.provider}/${chapter.id}?${params}`;
}
