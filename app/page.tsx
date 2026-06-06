"use client";

import {
  AlertTriangle,
  ListFilter,
  Loader2,
  Search,
  SettingsIcon,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { CategoryFilterModal } from "@/components/category-filter-modal";
import { IndexerFilterModal } from "@/components/indexer-filter-modal";
import { TorrentResultCard } from "@/components/torrent-result-card";
import { Button } from "@/components/ui/button";
import { useSearchStore } from "@/hooks/use-search-store";
import { filterableMediaCategories } from "@/lib/mock-media";
import { sortOptions, type SortKey } from "@/lib/search";
import { cn } from "@/lib/utils";

export default function SearchPage() {
  const query = useSearchStore((state) => state.query);
  const selectedCategories = useSearchStore((state) => state.selectedCategories);
  const status = useSearchStore((state) => state.status);
  const lastQuery = useSearchStore((state) => state.lastQuery);
  const results = useSearchStore((state) => state.results);
  const indexerErrors = useSearchStore((state) => state.indexerErrors);
  const indexersSearched = useSearchStore((state) => state.indexersSearched);
  const indexersCompleted = useSearchStore((state) => state.indexersCompleted);
  const stopped = useSearchStore((state) => state.stopped);
  const error = useSearchStore((state) => state.error);
  const indexerFilter = useSearchStore((state) => state.indexerFilter);
  const availableIndexers = useSearchStore((state) => state.availableIndexers);
  const selectedIndexerIds = useSearchStore((state) => state.selectedIndexerIds);
  const setQuery = useSearchStore((state) => state.setQuery);
  const setSelectedCategories = useSearchStore((state) => state.setSelectedCategories);
  const setIndexerFilter = useSearchStore((state) => state.setIndexerFilter);
  const loadIndexers = useSearchStore((state) => state.loadIndexers);
  const hydrateSelection = useSearchStore((state) => state.hydrateSelection);
  const setSelectedIndexerIds = useSearchStore((state) => state.setSelectedIndexerIds);
  const runSearch = useSearchStore((state) => state.runSearch);
  const stopSearch = useSearchStore((state) => state.stopSearch);

  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);

  // Restore the persisted indexer scope after mount (kept out of the store
  // initializer to avoid an SSR hydration mismatch), then load the enabled
  // indexer list so the scope modal has something to show.
  useEffect(() => {
    hydrateSelection();
    void loadIndexers();
  }, [hydrateSelection, loadIndexers]);

  const isLoading = status === "loading";
  const totalIndexers = availableIndexers.length;
  const selectedCount = selectedIndexerIds === null ? totalIndexers : selectedIndexerIds.length;
  const allIndexersSelected = selectedIndexerIds === null;
  const totalCategories = filterableMediaCategories.length;
  const selectedCategoryCount =
    selectedCategories === null ? totalCategories : selectedCategories.length;
  const allCategoriesSelected = selectedCategories === null;

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
          {/* Distinct keys force React to mount a fresh element when the action
              flips, instead of reusing the same <button> and mutating its
              `type`. Reusing it let a single mobile tap on Stop re-submit the
              form (button→submit in place), which restarted the search and
              snapped the UI back to the loading state. */}
          {isLoading ? (
            <Button
              className="h-12"
              key="stop"
              onClick={(event) => {
                event.preventDefault();
                stopSearch();
              }}
              type="button"
              variant="outline"
            >
              <Square className="size-4" />
              {indexersSearched
                ? `Stop · ${indexersCompleted}/${indexersSearched}`
                : "Stop"}
            </Button>
          ) : (
            <Button className="h-12" key="search" type="submit">
              Search
            </Button>
          )}
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            className={cn("h-9 px-3 text-xs", !allCategoriesSelected && "font-black")}
            onClick={() => setCategoryFilterOpen(true)}
            size="sm"
            type="button"
            variant={allCategoriesSelected ? "outline" : "secondary"}
          >
            <ListFilter className="size-4" />
            {allCategoriesSelected
              ? "Categories · All"
              : `Categories · ${selectedCategoryCount}/${totalCategories}`}
          </Button>

          {totalIndexers > 0 ? (
            <Button
              className={cn("ml-auto h-9 px-3 text-xs", !allIndexersSelected && "font-black")}
              onClick={() => setFilterOpen(true)}
              size="sm"
              type="button"
              variant={allIndexersSelected ? "outline" : "secondary"}
            >
              <SlidersHorizontal className="size-4" />
              {`Indexers · ${selectedCount}/${totalIndexers}`}
            </Button>
          ) : null}
        </div>

        {selectedCategories?.length === 0 ? (
          <p className="mt-2 text-xs font-bold text-destructive">
            No categories selected — pick at least one to search.
          </p>
        ) : null}

        {selectedIndexerIds?.length === 0 ? (
          <p className="mt-2 text-xs font-bold text-destructive">
            No indexers selected — pick at least one to search.
          </p>
        ) : null}
      </section>

      {categoryFilterOpen ? (
        <CategoryFilterModal
          categories={filterableMediaCategories}
          onApply={setSelectedCategories}
          onClose={() => setCategoryFilterOpen(false)}
          selectedIds={selectedCategories}
        />
      ) : null}

      {filterOpen ? (
        <IndexerFilterModal
          indexers={availableIndexers}
          onApply={setSelectedIndexerIds}
          onClose={() => setFilterOpen(false)}
          selectedIds={selectedIndexerIds}
        />
      ) : null}

      <SearchBody
        error={error}
        indexerErrors={indexerErrors}
        indexerFilter={indexerFilter}
        indexersCompleted={indexersCompleted}
        indexersSearched={indexersSearched}
        lastQuery={lastQuery}
        onRetry={() => void runSearch()}
        onSelectIndexer={setIndexerFilter}
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
  indexerFilter: string | null;
  indexersSearched: number;
  indexersCompleted: number;
  lastQuery: string;
  error: string | null;
  stopped: boolean;
  onRetry: () => void;
  onSelectIndexer: (indexerName: string | null) => void;
};

function SearchBody({
  status,
  results,
  indexerErrors,
  indexerFilter,
  indexersSearched,
  indexersCompleted,
  lastQuery,
  error,
  stopped,
  onRetry,
  onSelectIndexer,
}: SearchBodyProps) {
  const sortKey = useSearchStore((state) => state.sortKey);
  const setSortKey = useSearchStore((state) => state.setSortKey);

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

  // No indexers enabled: only meaningful once a search *completed* on its own
  // and reported zero. A user-stopped search may abort before the `start` event
  // lands (indexersSearched still 0), so don't mistake that for a setup gap.
  if (!isLoading && !stopped && indexersSearched === 0) {
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

  // Indexers that actually returned results, with per-provider counts, so the
  // filter only ever offers buckets that contain something. An active filter
  // that no longer matches (e.g. mid-stream) simply yields an empty grid.
  const indexerCounts = new Map<string, number>();
  for (const result of results) {
    indexerCounts.set(result.indexerName, (indexerCounts.get(result.indexerName) ?? 0) + 1);
  }
  const providers = [...indexerCounts.entries()].sort((a, b) => b[1] - a[1]);
  const activeFilter =
    indexerFilter && indexerCounts.has(indexerFilter) ? indexerFilter : null;
  const visibleResults = activeFilter
    ? results.filter((result) => result.indexerName === activeFilter)
    : results;

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

      {results.length ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {providers.length > 1 ? (
              <IndexerFilter
                active={activeFilter}
                onSelect={onSelectIndexer}
                providers={providers}
                total={results.length}
              />
            ) : null}
            <SortControl active={sortKey} onSelect={setSortKey} />
          </div>
          {indexerErrors.length ? (
            <PartialFailureNotice errors={indexerErrors} />
          ) : null}
          <section className="grid gap-4 lg:grid-cols-2">
            {visibleResults.map((result, index) => (
              <TorrentResultCard index={index} key={result.id} result={result} />
            ))}
          </section>
        </>
      ) : isLoading ? (
        <section className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <ResultSkeleton key={index} />
          ))}
        </section>
      ) : (
        <>
          {indexerErrors.length ? (
            <PartialFailureNotice errors={indexerErrors} />
          ) : null}
          <Panel title="No results">
            <p className="mt-2 text-sm text-muted-foreground">
              {`No torrents matched "${lastQuery}" across ${indexersSearched} ${
                indexersSearched === 1 ? "indexer" : "indexers"
              }.`}
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}

function IndexerFilter({
  providers,
  active,
  total,
  onSelect,
}: {
  providers: [name: string, count: number][];
  active: string | null;
  total: number;
  onSelect: (indexerName: string | null) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-black uppercase text-muted-foreground">
        Indexer
      </span>
      <select
        className={cn(
          "h-8 max-w-[12rem] border-2 border-foreground bg-background px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-ring",
          active !== null && "font-black",
        )}
        onChange={(event) => onSelect(event.target.value || null)}
        value={active ?? ""}
      >
        <option value="">{`All · ${total}`}</option>
        {providers.map(([name, count]) => (
          <option key={name} value={name}>
            {`${name} · ${count}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortControl({
  active,
  onSelect,
}: {
  active: SortKey;
  onSelect: (key: SortKey) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-black uppercase text-muted-foreground">Sort</span>
      <select
        className="h-8 border-2 border-foreground bg-background px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => onSelect(event.target.value as SortKey)}
        value={active}
      >
        {sortOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
    <div className="border-2 border-foreground bg-yellow-300 p-3 text-sm text-black">
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
