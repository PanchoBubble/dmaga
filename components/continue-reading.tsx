"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ContinueReadingItem } from "@/lib/progress";

/**
 * "Continue reading" rail on the Manga page — the series you've most recently
 * read, each resuming at the chapter you left off. Renders nothing until there's
 * something to show, so it's invisible on a fresh install.
 */
export function ContinueReading() {
  const [items, setItems] = useState<ContinueReadingItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/manga/progress?continue=1", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ items: ContinueReadingItem[] }>) : null))
      .then((p) => p && setItems(p.items))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-black">Continue Reading</h2>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <li className="w-28 shrink-0" key={item.seriesKey}>
            <Link
              className="group block border-2 border-foreground bg-card shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={resumeHref(item)}
              prefetch={false}
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden border-b-2 border-foreground bg-secondary">
                {item.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={`/api/manga/proxy?u=${encodeURIComponent(item.coverUrl)}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-2 text-center text-[10px] font-black">
                    {item.title}
                  </div>
                )}
              </div>
              <div className="p-1.5">
                <p className="truncate text-[11px] font-black leading-tight">
                  {item.title}
                </p>
                {item.lastChapterNumber ? (
                  <p className="text-[10px] font-bold text-muted-foreground">
                    Ch. {item.lastChapterNumber}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Rebuilds the reader URL for a series' last-read chapter. */
function resumeHref(item: ContinueReadingItem): string {
  const provider = item.lastProvider ?? "mangadex";
  const chapterId = item.lastChapterId ?? "";
  const params = new URLSearchParams({ t: item.title });
  if (item.lastChapterNumber) {
    params.set("ch", item.lastChapterNumber);
  }
  // seriesKey is `mal:{id}` or `{provider}:{seriesId}` — restore the right back-link param.
  const sep = item.seriesKey.indexOf(":");
  const scheme = item.seriesKey.slice(0, sep);
  const rest = item.seriesKey.slice(sep + 1);
  if (scheme === "mal") {
    params.set("s", `mal-${rest}`);
  } else {
    params.set("sid", rest);
  }
  return `/manga/read/${provider}/${chapterId}?${params}`;
}
