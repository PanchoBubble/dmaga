"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PosterCard } from "@/components/poster-card";
import { Button } from "@/components/ui/button";
import {
  catalogGenres,
  catalogSorts,
  type CatalogItem,
  type CatalogSort,
  type CatalogType,
} from "@/lib/metadata";
import { cn } from "@/lib/utils";

type CatalogResponse = { items: CatalogItem[] };

/** Fetches one catalog page. Pure (no React state); returns null on failure. */
async function fetchCatalogPage(args: {
  type: CatalogType;
  sort: CatalogSort;
  genre: string | null;
  search: string;
  skip: number;
}): Promise<CatalogItem[] | null> {
  const params = new URLSearchParams({ type: args.type, sort: args.sort });
  if (args.search.trim()) {
    params.set("search", args.search.trim());
  } else if (args.genre) {
    params.set("genre", args.genre);
  }
  if (args.skip > 0) {
    params.set("skip", String(args.skip));
  }
  try {
    const response = await fetch(`/api/catalog?${params}`);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as CatalogResponse;
    return payload.items ?? [];
  } catch {
    return null;
  }
}

/** Appends a page to existing items, de-duping by id. */
function mergeItems(base: CatalogItem[], page: CatalogItem[]): CatalogItem[] {
  const seen = new Set(base.map((item) => item.id));
  const merged = [...base];
  for (const item of page) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

/**
 * Paginated browse grid for one content type. Sort (Popular/New/Featured) and
 * genre are client-controlled; changing either resets and refetches from the
 * top. "Load more" pages via `skip = items.length` (Cinemeta is offset-based),
 * de-duping by id and stopping when a page comes back empty.
 */
export function DiscoverGrid({
  type,
  initialSort,
}: {
  type: CatalogType;
  initialSort: CatalogSort;
}) {
  const [sort, setSort] = useState<CatalogSort>(initialSort);
  const [genre, setGenre] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  // Starts "loading": the mount effect fetches immediately. Sort/genre changes
  // and Load-more set the pending status from their event handlers, so the
  // effect itself never sets state synchronously (avoids cascading renders).
  const [status, setStatus] = useState<"idle" | "loading" | "more" | "done" | "error">(
    "loading",
  );

  // Guards against a stale in-flight request (slow page) overwriting results
  // from a newer filter selection. Only the latest request commits.
  const requestId = useRef(0);

  // Refetch page 0 whenever sort/genre change (and on mount). State is only set
  // after the awaited fetch (an external system) — never synchronously in the
  // effect body — so this can't trigger cascading renders.
  useEffect(() => {
    const id = ++requestId.current;
    void fetchCatalogPage({ type, sort, genre, search, skip: 0 }).then((page) => {
      if (id !== requestId.current) {
        return; // Superseded by a newer selection.
      }
      if (page === null) {
        setStatus("error");
        return;
      }
      setItems(page);
      setStatus(page.length === 0 ? "done" : "idle");
    });
  }, [type, sort, genre, search]);

  // Load-more runs from a click handler, so state updates here are fine.
  async function loadMore() {
    const id = ++requestId.current;
    setStatus("more");
    const page = await fetchCatalogPage({
      type,
      sort,
      genre,
      search,
      skip: items.length,
    });
    if (id !== requestId.current) {
      return;
    }
    if (page === null) {
      setStatus("error");
      return;
    }
    setItems((current) => mergeItems(current, page));
    setStatus(page.length === 0 ? "done" : "idle");
  }

  // Retry re-fetches page 0 from a click handler (the effect won't re-run when
  // sort/genre are unchanged).
  async function retry() {
    const id = ++requestId.current;
    setStatus("loading");
    const page = await fetchCatalogPage({ type, sort, genre, search, skip: 0 });
    if (id !== requestId.current) {
      return;
    }
    if (page === null) {
      setStatus("error");
      return;
    }
    setItems(page);
    setStatus(page.length === 0 ? "done" : "idle");
  }

  const isInitialLoading = status === "loading";
  const isLoadingMore = status === "more";
  const activeSearch = search.trim();

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = searchInput.trim();
    if (next === search) {
      return;
    }
    setStatus("loading");
    setGenre(null);
    setSearch(next);
  }

  function clearSearch() {
    if (!searchInput && !search) {
      return;
    }
    setSearchInput("");
    setSearch("");
    setStatus("loading");
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 border-2 border-foreground bg-card p-3 shadow-line sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={submitSearch}
      >
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full border-2 border-foreground bg-background px-9 text-sm font-bold shadow-line outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={`Search ${type === "movie" ? "movies" : "shows"} by title`}
            value={searchInput}
          />
          {searchInput || search ? (
            <button
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center border-2 border-transparent hover:border-foreground"
              onClick={clearSearch}
              type="button"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </label>

        <Button disabled={isInitialLoading} type="submit">
          <Search className="size-4" />
          Search
        </Button>
      </form>

      {activeSearch ? (
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
          <span className="border-2 border-foreground bg-background px-2 py-1">
            Results for: {activeSearch}
          </span>
          <Button className="h-8 px-2 text-xs" onClick={clearSearch} variant="outline">
            <X className="size-4" />
            Clear
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {catalogSorts.map((option) => (
          <Button
            className="h-9 px-3 text-xs"
            key={option.id}
            onClick={() => {
              if (sort === option.id) {
                return;
              }
              setStatus("loading");
              setSort(option.id);
            }}
            size="sm"
            type="button"
            variant={sort === option.id ? "secondary" : "outline"}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="-mx-1 flex flex-wrap gap-2 px-1">
        <GenreChip
          active={genre === null}
          disabled={Boolean(activeSearch)}
          label="All"
          onClick={() => {
            if (genre === null) {
              return;
            }
            setStatus("loading");
            setGenre(null);
          }}
        />
        {catalogGenres.map((value) => (
          <GenreChip
            active={genre === value}
            disabled={Boolean(activeSearch)}
            key={value}
            label={value}
            onClick={() => {
              setStatus("loading");
              setGenre(genre === value ? null : value);
            }}
          />
        ))}
      </div>

      {isInitialLoading ? (
        <Grid aria-busy>
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              className="aspect-[2/3] animate-pulse border-2 border-foreground bg-muted"
              key={index}
            />
          ))}
        </Grid>
      ) : status === "error" ? (
        <Panel>
          <p className="font-black">Couldn’t load titles.</p>
          <Button className="mt-3" onClick={() => void retry()} variant="outline">
            Retry
          </Button>
        </Panel>
      ) : items.length === 0 ? (
        <Panel>
          <p className="font-black">No titles found.</p>
        </Panel>
      ) : (
        <>
          <Grid>
            {items.map((item) => (
              <PosterCard item={item} key={`${item.type}:${item.id}`} />
            ))}
          </Grid>
          {status !== "done" ? (
            <div className="flex justify-center pt-2">
              <Button
                disabled={isLoadingMore}
                onClick={() => void loadMore()}
                variant="outline"
              >
                {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                {isLoadingMore ? "Loading" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Grid({
  children,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      {...props}
    >
      {children}
    </div>
  );
}

function GenreChip({
  label,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "border-2 border-foreground px-2.5 py-1 text-xs font-bold transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-foreground text-background" : "bg-background",
        disabled
          ? "cursor-not-allowed opacity-50 hover:translate-x-0 hover:translate-y-0"
          : "",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
      {children}
    </div>
  );
}
