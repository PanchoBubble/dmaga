"use client";

import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ChapterReader } from "@/components/chapter-reader";

type PagesResponse = { pages: string[] };

/**
 * Loads a chapter's page images client-side (behind a spinner) so the provider
 * solve — for VyManga a ~20-60s byparr Cloudflare round-trip — doesn't hang the
 * navigation on a blank "pending" tab. On empty/failed loads it degrades to a
 * clear message with an "open on the source" fallback (some VyManga titles use a
 * protected reader whose images we can't extract).
 */
export function ChapterPages({
  provider,
  chapterId,
  title,
  backHref,
  sourceUrl,
}: {
  provider: string;
  chapterId: string;
  title: string;
  backHref: string;
  sourceUrl: string | null;
}) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setPages(null);
        setError(null);
        const params = new URLSearchParams({ provider, id: chapterId });
        const response = await fetch(`/api/manga/chapter-pages?${params}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as PagesResponse | { error?: string };
        if (!response.ok || !("pages" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Failed to load.");
        }
        setPages(payload.pages);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(caught instanceof Error ? caught.message : "Failed to load.");
      }
    })();
    return () => controller.abort();
  }, [provider, chapterId]);

  if (pages && pages.length > 0) {
    return <ChapterReader backHref={backHref} pages={pages} title={title} />;
  }

  return (
    <div className="space-y-4">
      <Link
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        href={backHref}
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      {!pages && !error ? (
        <div className="flex items-center gap-2 border-2 border-foreground bg-card p-4 text-sm font-bold shadow-line">
          <Loader2 className="size-4 animate-spin" />
          Loading pages… (VyManga clears Cloudflare first — can take ~30s)
        </div>
      ) : (
        <div className="space-y-3 border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">Couldn&apos;t load this chapter&apos;s pages</p>
          <p className="text-sm font-semibold text-muted-foreground">
            {error
              ? error
              : "This title uses a protected reader whose images can't be extracted yet."}
          </p>
          {sourceUrl ? (
            <a
              className="inline-flex items-center gap-2 border-2 border-foreground bg-[hsl(134deg_40%_82%)] px-3 py-2 text-sm font-black shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
              href={sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-4" />
              Open on VyManga
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
