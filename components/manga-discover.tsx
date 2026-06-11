"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  DiscoverFeed,
  ProviderGenre,
  ProviderSeries,
} from "@/lib/server/manga-providers/types";

type DiscoverResponse = { series: ProviderSeries[]; page: number };

type Tab = DiscoverFeed | "genres";

/**
 * Provider-native browse surface (VyManga): Popular / Latest feeds plus genre
 * browse, paged with a "Load more" button. Cards link to the provider-native
 * series page (`/manga/series/{provider}/{seriesId}`), independent of MAL.
 */
export function MangaDiscover({
  initialSeries,
  genres,
}: {
  initialSeries: ProviderSeries[];
  genres: ProviderGenre[];
}) {
  const [tab, setTab] = useState<Tab>("popular");
  const [genre, setGenre] = useState<ProviderGenre | null>(null);
  const [series, setSeries] = useState<ProviderSeries[]>(initialSeries);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [hasMore, setHasMore] = useState(true);
  // Identifies the active query so stale fetches don't clobber fresh state.
  const requestKey = useRef(0);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      // Genre browse needs a selected genre; otherwise it's the feed.
      if (tab === "genres" && !genre) {
        return;
      }
      const key = ++requestKey.current;
      setStatus("loading");

      const params = new URLSearchParams({ page: String(nextPage) });
      if (tab === "genres" && genre) {
        params.set("genre", genre.id);
      } else {
        params.set("feed", tab);
      }

      try {
        const response = await fetch(`/api/manga/discover?${params}`);
        const payload = (await response.json()) as DiscoverResponse | { error?: string };
        if (key !== requestKey.current) {
          return; // a newer request superseded this one
        }
        if (!response.ok || !("series" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Failed to load.");
        }
        setSeries((current) =>
          replace ? payload.series : [...current, ...payload.series],
        );
        setPage(nextPage);
        setHasMore(payload.series.length > 0);
        setStatus("idle");
      } catch {
        if (key === requestKey.current) {
          setStatus("error");
        }
      }
    },
    [tab, genre],
  );

  // Reload from page 1 whenever the tab or selected genre changes (but not on
  // first mount for the default Popular tab — that's server-rendered).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setSeries([]);
    void load(1, true);
  }, [tab, genre, load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["popular", "latest", "genres"] as const).map((value) => (
          <button
            className={cn(
              "border-2 border-foreground px-3 py-1.5 text-sm font-black shadow-line transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === value
                ? "bg-[hsl(134deg_40%_82%)]"
                : "bg-background text-muted-foreground hover:text-foreground",
            )}
            key={value}
            onClick={() => {
              setTab(value);
              if (value !== "genres") {
                setGenre(null);
              }
            }}
            type="button"
          >
            {value === "popular" ? "Popular" : value === "latest" ? "Latest" : "Genres"}
          </button>
        ))}
      </div>

      {tab === "genres" ? (
        <div className="flex flex-wrap gap-2 border-2 border-foreground bg-card p-3 shadow-line">
          {genres.length === 0 ? (
            <span className="text-sm font-bold text-muted-foreground">
              No genres available.
            </span>
          ) : (
            genres.map((entry) => (
              <button
                className={cn(
                  "border-2 border-foreground px-2 py-1 text-xs font-bold transition-colors",
                  genre?.id === entry.id
                    ? "bg-foreground text-background"
                    : "bg-background hover:bg-accent",
                )}
                key={entry.id}
                onClick={() => setGenre(entry)}
                type="button"
              >
                {entry.name}
              </button>
            ))
          )}
        </div>
      ) : null}

      {tab === "genres" && !genre ? (
        <p className="border-2 border-dashed border-foreground bg-background p-6 text-center text-sm font-bold text-muted-foreground">
          Pick a genre to browse.
        </p>
      ) : (
        <SeriesGrid series={series} />
      )}

      {status === "error" ? (
        <p className="border-2 border-foreground bg-card p-3 text-sm font-bold text-muted-foreground shadow-line">
          Couldn&apos;t load this feed. VyManga may be rate-limiting — try again.
        </p>
      ) : null}

      {(tab !== "genres" || genre) && hasMore ? (
        <div className="flex justify-center">
          <Button
            disabled={status === "loading"}
            onClick={() => void load(page + 1, false)}
            type="button"
            variant="outline"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SeriesGrid({ series }: { series: ProviderSeries[] }) {
  if (series.length === 0) {
    return null;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {series.map((item) => (
        <li key={`${item.provider}:${item.seriesId}`}>
          <Link
            className="group block border-2 border-foreground bg-card shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={`/manga/series/${item.provider}/${item.seriesId}`}
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
                <div className="flex h-full items-center justify-center p-2 text-center text-xs font-black">
                  {item.title}
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-black leading-tight">{item.title}</p>
              {item.latestChapter ? (
                <p className="mt-0.5 truncate text-[10px] font-semibold text-muted-foreground">
                  {item.latestChapter}
                </p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
