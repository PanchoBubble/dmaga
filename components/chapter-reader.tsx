"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { ChapterDownload } from "@/components/chapter-download";
import type { ProgressUpsert } from "@/lib/progress";

/** Identity + metadata needed to persist reading progress for this chapter. */
export type ChapterProgressMeta = Omit<
  ProgressUpsert,
  "lastPage" | "completed"
>;

/**
 * Vertical long-strip reader for online provider chapters — the standard web
 * manga layout. Pages are already proxied URLs; images lazy-load as you scroll.
 *
 * When `progress` is supplied it tracks the furthest page scrolled into view
 * (debounced POST to /api/manga/progress), marks the chapter complete at the
 * end, and resumes at `resumePage` on open.
 */
export function ChapterReader({
  pages,
  title,
  backHref,
  progress,
  resumePage = 0,
}: {
  pages: string[];
  title: string;
  backHref: string;
  progress?: ChapterProgressMeta;
  resumePage?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const maxSeenRef = useRef(0);
  const savedRef = useRef(-1);

  // Resume: scroll the last-read page into view once on mount.
  useEffect(() => {
    if (resumePage <= 0 || !containerRef.current) {
      return;
    }
    const target = containerRef.current.querySelector(
      `[data-page-index="${resumePage}"]`,
    );
    target?.scrollIntoView({ block: "start" });
  }, [resumePage]);

  // Track the furthest page in view and persist progress (debounced).
  useEffect(() => {
    if (!progress || !containerRef.current || pages.length === 0) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      const page = maxSeenRef.current;
      if (page <= savedRef.current) {
        return;
      }
      savedRef.current = page;
      const completed = page >= pages.length - 1;
      void fetch("/api/manga/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          ...progress,
          lastPage: page,
          completed,
          pageCount: pages.length,
        }),
      }).catch(() => {});
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number(
              (entry.target as HTMLElement).dataset.pageIndex ?? "0",
            );
            if (index > maxSeenRef.current) {
              maxSeenRef.current = index;
            }
          }
        }
        clearTimeout(timer);
        timer = setTimeout(save, 1200);
      },
      { threshold: 0.5 },
    );

    const imgs = containerRef.current.querySelectorAll("[data-page-index]");
    imgs.forEach((img) => observer.observe(img));

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      save();
    };
  }, [progress, pages.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 border-2 border-foreground bg-card p-3 shadow-line">
        <Link
          className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
          href={backHref}
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Chapters</span>
        </Link>
        <span className="min-w-0 flex-1 truncate text-center text-sm font-black">
          {title}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-bold tabular-nums text-muted-foreground sm:inline">
            {pages.length} pages
          </span>
          <ChapterDownload pages={pages} title={title} />
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-1" ref={containerRef}>
        {pages.map((src, index) => (
          <img
            alt={`Page ${index + 1}`}
            className="h-auto w-full border-2 border-foreground bg-secondary"
            data-page-index={index}
            decoding="async"
            key={src}
            loading="lazy"
            src={src}
          />
        ))}
      </div>

      <div className="border-2 border-dashed border-foreground p-4 text-center">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
          href={backHref}
        >
          <ArrowLeft className="size-4" />
          Back to chapters
        </Link>
      </div>
    </div>
  );
}
