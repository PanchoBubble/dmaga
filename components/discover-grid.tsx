"use client";

import { Loader2 } from "lucide-react";
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
  skip: number;
}): Promise<CatalogItem[] | null> {
  const params = new URLSearchParams({ type: args.type, sort: args.sort });
  if (args.genre) {
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
    void fetchCatalogPage({ type, sort, genre, skip: 0 }).then((page) => {
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
  }, [type, sort, genre]);

  // Load-more runs from a click handler, so state updates here are fine.
  async function loadMore() {
    const id = ++requestId.current;
    setStatus("more");
    const page = await fetchCatalogPage({ type, sort, genre, skip: items.length });
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
    const page = await fetchCatalogPage({ type, sort, genre, skip: 0 });
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

  return (
    <div className="space-y-4">
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
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "border-2 border-foreground px-2.5 py-1 text-xs font-bold transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-foreground text-background" : "bg-background",
      )}
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
