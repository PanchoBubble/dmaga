"use client";

import { AlertTriangle, Loader2, Search, SettingsIcon, Square } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";

import { TorrentResultCard } from "@/components/torrent-result-card";
import { Button } from "@/components/ui/button";
import { useSearchStore } from "@/hooks/use-search-store";
import { mediaCategories } from "@/lib/mock-media";
import { cn } from "@/lib/utils";

export default function SearchPage() {
  const query = useSearchStore((state) => state.query);
  const category = useSearchStore((state) => state.category);
  const status = useSearchStore((state) => state.status);
  const lastQuery = useSearchStore((state) => state.lastQuery);
  const results = useSearchStore((state) => state.results);
  const indexerErrors = useSearchStore((state) => state.indexerErrors);
  const indexersSearched = useSearchStore((state) => state.indexersSearched);
  const indexersCompleted = useSearchStore((state) => state.indexersCompleted);
  const stopped = useSearchStore((state) => state.stopped);
  const error = useSearchStore((state) => state.error);
  const setQuery = useSearchStore((state) => state.setQuery);
  const setCategory = useSearchStore((state) => state.setCategory);
  const runSearch = useSearchStore((state) => state.runSearch);
  const stopSearch = useSearchStore((state) => state.stopSearch);

  const isLoading = status === "loading";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch();
  }

  return (
    <div className="space-y-6">
      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSubmit}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-12 w-full border-2 border-foreground bg-background pl-11 pr-4 text-base font-semibold outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search torrents"
              value={query}
            />
          </div>
          {/* While loading the button becomes Stop, so a slow indexer never traps
              the user. Otherwise it submits — we don't gate on empty input
              because iOS Safari leaves the button stuck-disabled with the
              keyboard focused, and runSearch() already no-ops on an empty query. */}
          {isLoading ? (
            <Button
              className="h-12"
              onClick={() => stopSearch()}
              type="button"
              variant="outline"
            >
              <Square className="size-4" />
              {indexersSearched
                ? `Stop · ${indexersCompleted}/${indexersSearched}`
                : "Stop"}
            </Button>
          ) : (
            <Button className="h-12" type="submit">
              Search
            </Button>
          )}
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {mediaCategories.map((option) => (
            <Button
              aria-pressed={category === option.id}
              className={cn("h-9 px-3 text-xs", category === option.id && "font-black")}
              key={option.id}
              onClick={() => setCategory(option.id)}
              size="sm"
              type="button"
              variant={category === option.id ? "secondary" : "outline"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </section>

      <SearchBody
        error={error}
        indexerErrors={indexerErrors}
        indexersCompleted={indexersCompleted}
        indexersSearched={indexersSearched}
        lastQuery={lastQuery}
        onRetry={() => void runSearch()}
        results={results}
        status={status}
        stopped={stopped}
      />
    </div>
  );
}

type SearchBodyProps = {
  status: ReturnType<typeof useSearchStore.getState>["status"];
  results: ReturnType<typeof useSearchStore.getState>["results"];
  indexerErrors: ReturnType<typeof useSearchStore.getState>["indexerErrors"];
  indexersSearched: number;
  indexersCompleted: number;
  lastQuery: string;
  error: string | null;
  stopped: boolean;
  onRetry: () => void;
};

function SearchBody({
  status,
  results,
  indexerErrors,
  indexersSearched,
  indexersCompleted,
  lastQuery,
  error,
  stopped,
  onRetry,
}: SearchBodyProps) {
  if (status === "idle") {
    return (
      <Panel title="Search across your indexers">
        <p className="mt-2 text-sm text-muted-foreground">
          Enter a title above to query every enabled indexer at once.
        </p>
      </Panel>
    );
  }

  if (status === "error") {
    return (
      <Panel tone="destructive" title="Search failed">
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "Something went wrong. Try again."}
        </p>
        <Button className="mt-4" onClick={onRetry} variant="outline">
          Retry
        </Button>
      </Panel>
    );
  }

  const isLoading = status === "loading";

  // No indexers enabled: only meaningful once a completed search reports zero.
  if (!isLoading && indexersSearched === 0) {
    return (
      <Panel title="No indexers enabled">
        <p className="mt-2 text-sm text-muted-foreground">
          Add and enable at least one indexer to start searching.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/settings">
            <SettingsIcon className="size-4" />
            Go to settings
          </Link>
        </Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <ProgressStrip
          completed={indexersCompleted}
          total={indexersSearched}
          loaded={results.length}
        />
      ) : null}

      {stopped ? (
        <Notice tone="accent">
          {`Stopped early — showing partial results from ${indexersCompleted} of ${indexersSearched} ${
            indexersSearched === 1 ? "indexer" : "indexers"
          }.`}
        </Notice>
      ) : null}

      {indexerErrors.length ? <PartialFailureNotice errors={indexerErrors} /> : null}

      {results.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {results.map((result, index) => (
            <TorrentResultCard index={index} key={result.id} result={result} />
          ))}
        </section>
      ) : isLoading ? (
        <section className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <ResultSkeleton key={index} />
          ))}
        </section>
      ) : (
        <Panel title="No results">
          <p className="mt-2 text-sm text-muted-foreground">
            {`No torrents matched "${lastQuery}" across ${indexersSearched} ${
              indexersSearched === 1 ? "indexer" : "indexers"
            }.`}
          </p>
        </Panel>
      )}
    </div>
  );
}

function ProgressStrip({
  completed,
  total,
  loaded,
}: {
  completed: number;
  total: number;
  loaded: number;
}) {
  return (
    <div className="flex items-center justify-between border-2 border-foreground bg-card px-3 py-2 text-sm font-black shadow-line">
      <span className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        {total ? `Searching ${completed}/${total} indexers` : "Searching indexers"}
      </span>
      {loaded ? (
        <span className="text-muted-foreground">{`${loaded} ${loaded === 1 ? "result" : "results"}`}</span>
      ) : null}
    </div>
  );
}

function PartialFailureNotice({
  errors,
}: {
  errors: SearchBodyProps["indexerErrors"];
}) {
  return (
    <div className="border-2 border-foreground bg-accent p-3 text-sm shadow-line">
      <p className="flex items-center gap-2 font-black">
        <AlertTriangle className="size-4" />
        {`${errors.length} ${errors.length === 1 ? "indexer" : "indexers"} failed`}
      </p>
      <ul className="mt-2 space-y-1 text-xs font-semibold text-muted-foreground">
        {errors.map((indexerError) => (
          <li key={indexerError.indexerName}>
            <span className="font-black text-foreground">
              {indexerError.indexerName}:
            </span>{" "}
            {indexerError.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notice({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent";
}) {
  return (
    <div
      className={cn(
        "border-2 border-foreground p-3 text-sm font-bold shadow-line",
        tone === "accent" && "bg-accent",
      )}
    >
      {children}
    </div>
  );
}

function Panel({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "destructive";
}) {
  return (
    <div
      className={cn(
        "border-2 border-dashed border-foreground bg-background p-8 text-center",
        tone === "destructive" && "border-solid border-destructive",
      )}
    >
      <p className="text-lg font-black">{title}</p>
      {children}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3 border-2 border-foreground bg-card p-4 shadow-line">
      <div className="h-3 w-24 bg-muted" />
      <div className="h-6 w-3/4 bg-muted" />
      <div className="mt-2 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-10 bg-muted" key={index} />
        ))}
      </div>
      <div className="mt-2 h-10 w-32 self-end bg-muted" />
    </div>
  );
}
