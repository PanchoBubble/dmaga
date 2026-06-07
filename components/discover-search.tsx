"use client";

import { Loader2, Search, X } from "lucide-react";
import { useRef, useState } from "react";

import { PosterCard } from "@/components/poster-card";
import { Button } from "@/components/ui/button";
import type { CatalogItem, CatalogType } from "@/lib/metadata";

type CatalogResponse = { items: CatalogItem[] };

async function searchCatalog(type: CatalogType, query: string): Promise<CatalogItem[]> {
  const params = new URLSearchParams({ type, search: query });
  const response = await fetch(`/api/catalog?${params}`);
  if (!response.ok) {
    throw new Error("Search failed.");
  }
  const payload = (await response.json()) as CatalogResponse;
  return payload.items ?? [];
}

function mergeSearchResults(results: CatalogItem[][]): CatalogItem[] {
  const seen = new Set<string>();
  const merged: CatalogItem[] = [];

  for (const item of results.flat()) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function DiscoverSearch() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const requestId = useRef(0);

  async function runSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    setQuery(trimmed);

    if (!trimmed) {
      setItems([]);
      setStatus("idle");
      return;
    }

    const id = ++requestId.current;
    setStatus("loading");

    try {
      const results = await Promise.all([
        searchCatalog("movie", trimmed),
        searchCatalog("series", trimmed),
      ]);
      if (id !== requestId.current) {
        return;
      }
      setItems(mergeSearchResults(results));
      setStatus("idle");
    } catch {
      if (id !== requestId.current) {
        return;
      }
      setStatus("error");
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(input);
  }

  function clearSearch() {
    requestId.current += 1;
    setInput("");
    setQuery("");
    setItems([]);
    setStatus("idle");
  }

  const isSearching = status === "loading";
  const hasQuery = Boolean(query);

  return (
    <section className="space-y-4">
      <form
        className="grid gap-2 border-2 border-foreground bg-card p-3 shadow-line sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={submitSearch}
      >
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full border-2 border-foreground bg-background px-9 text-sm font-bold shadow-line outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search movies, shows, anime"
            value={input}
          />
          {input || hasQuery ? (
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

        <Button disabled={isSearching} type="submit">
          {isSearching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Search
        </Button>
      </form>

      {hasQuery ? (
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
          <span className="border-2 border-foreground bg-background px-2 py-1">
            Results across movies and shows: {query}
          </span>
          <Button className="h-8 px-2 text-xs" onClick={clearSearch} variant="outline">
            <X className="size-4" />
            Clear
          </Button>
        </div>
      ) : null}

      {status === "error" ? (
        <Panel>
          <p className="font-black">Couldn&apos;t search titles.</p>
        </Panel>
      ) : hasQuery && !isSearching && items.length === 0 ? (
        <Panel>
          <p className="font-black">No titles found.</p>
        </Panel>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <PosterCard item={item} key={`${item.type}:${item.id}`} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
      {children}
    </div>
  );
}
