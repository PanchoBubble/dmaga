"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

import { TorrentResultCard } from "@/components/torrent-result-card";
import { Button } from "@/components/ui/button";
import { useTitleSources, type TitleSourcesArgs } from "@/hooks/use-title-sources";
import { sortOptions, type SortKey } from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * Download-focused source list for a title (or a selected episode). Streams
 * torrents across every enabled indexer via the shared search pipeline and
 * renders them with the same {@link TorrentResultCard} as the search page, so
 * Add-to-Real-Debrid / Save / Magnet all work identically here.
 */
export function TitleSources({ args }: { args: TitleSourcesArgs }) {
  const [sortKey, setSortKey] = useState<SortKey>("seeds");
  const { results, errors, status, indexersSearched, indexersCompleted, error, retry } =
    useTitleSources(args, sortKey);

  const isLoading = status === "loading";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">
          Sources
          {results.length ? (
            <span className="ml-2 text-sm font-bold text-muted-foreground">
              {results.length}
            </span>
          ) : null}
        </h2>
        <label className="flex items-center gap-2">
          <span className="text-xs font-black uppercase text-muted-foreground">
            Sort
          </span>
          <select
            className="h-8 border-2 border-foreground bg-background px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-ring"
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            value={sortKey}
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 border-2 border-foreground bg-card px-3 py-2 text-sm font-black shadow-line">
          <Loader2 className="size-4 animate-spin" />
          {indexersSearched
            ? `Searching ${indexersCompleted}/${indexersSearched} indexers`
            : "Searching indexers"}
        </div>
      ) : null}

      {errors.length ? (
        <div className="border-2 border-foreground bg-yellow-300 p-3 text-sm text-black">
          <p className="flex items-center gap-2 font-black">
            <AlertTriangle className="size-4" />
            {`${errors.length} ${errors.length === 1 ? "indexer" : "indexers"} failed`}
          </p>
        </div>
      ) : null}

      {results.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {results.map((result, index) => (
            <TorrentResultCard index={index} key={result.id} result={result} />
          ))}
        </section>
      ) : isLoading ? (
        <section className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              className="h-28 animate-pulse border-2 border-foreground bg-muted shadow-line"
              key={index}
            />
          ))}
        </section>
      ) : status === "error" ? (
        <Panel>
          <p className="font-black">{error ?? "Couldn’t load sources."}</p>
          <Button className="mt-3" onClick={retry} variant="outline">
            Retry
          </Button>
        </Panel>
      ) : (
        <Panel>
          <p className="font-black">No sources found.</p>
          <p className={cn("mt-1 text-sm text-muted-foreground")}>
            No indexer returned a torrent for this title.
          </p>
        </Panel>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
      {children}
    </div>
  );
}
