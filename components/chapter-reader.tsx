"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ChapterDownload } from "@/components/chapter-download";

/**
 * Vertical long-strip reader for online provider chapters — the standard web
 * manga layout. Pages are already proxied URLs; images lazy-load as you scroll.
 */
export function ChapterReader({
  pages,
  title,
  backHref,
}: {
  pages: string[];
  title: string;
  backHref: string;
}) {
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

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-1">
        {pages.map((src, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`Page ${index + 1}`}
            className="h-auto w-full border-2 border-foreground bg-secondary"
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
