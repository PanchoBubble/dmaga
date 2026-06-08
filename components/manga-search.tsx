"use client";

/* eslint-disable @next/next/no-img-element */

import { Loader2, Search, Star, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { TitleSources } from "@/components/title-sources";
import { Button } from "@/components/ui/button";
import type { MangaCatalogItem } from "@/lib/manga";

type MangaCatalogResponse = {
  items: MangaCatalogItem[];
};

export function MangaSearch() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MangaCatalogItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const requestId = useRef(0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(draft);
  }

  async function runSearch(value: string) {
    const trimmed = value.trim();
    setQuery(trimmed);
    if (!trimmed) {
      setItems([]);
      setStatus("idle");
      return;
    }

    const id = ++requestId.current;
    setStatus("loading");
    try {
      const params = new URLSearchParams({ q: trimmed });
      const response = await fetch(`/api/manga/catalog?${params}`);
      if (!response.ok) {
        throw new Error("Search failed.");
      }
      const payload = (await response.json()) as MangaCatalogResponse;
      if (id !== requestId.current) {
        return;
      }
      setItems(payload.items ?? []);
      setStatus("idle");
    } catch {
      if (id !== requestId.current) {
        return;
      }
      setStatus("error");
    }
  }

  function clearSearch() {
    requestId.current += 1;
    setDraft("");
    setQuery("");
    setItems([]);
    setStatus("idle");
  }

  const isSearching = status === "loading";

  return (
    <section className="space-y-4">
      <form
        className="flex flex-col gap-3 border-2 border-foreground bg-card p-4 shadow-line md:flex-row"
        onSubmit={handleSubmit}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-12 w-full border-2 border-foreground bg-background pl-11 pr-4 text-base font-semibold outline-none focus:ring-2 focus:ring-ring"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search manga"
            value={draft}
          />
          {draft || query ? (
            <button
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center border-2 border-transparent hover:border-foreground"
              onClick={clearSearch}
              type="button"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Button className="h-12" disabled={isSearching} type="submit">
          {isSearching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Search
        </Button>
      </form>

      {status === "error" ? (
        <Panel>Couldn&apos;t search manga.</Panel>
      ) : query && !isSearching && items.length === 0 ? (
        <Panel>No manga found.</Panel>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((item) => (
            <MangaResultCard item={item} key={item.slug} />
          ))}
        </div>
      ) : null}

      {query ? (
        <TitleSources
          args={{
            query: `${query} manga`,
            type: "manga",
            categories: ["7030"],
          }}
          mode="manga"
          title="Manga Sources"
        />
      ) : null}
    </section>
  );
}

function MangaResultCard({ item }: { item: MangaCatalogItem }) {
  return (
    <Link
      className="group flex min-w-0 flex-col border-2 border-foreground bg-card shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href={`/manga/${item.slug}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden border-b-2 border-foreground bg-secondary">
        {item.poster ? (
          <img
            alt={item.title}
            className="h-full w-full object-cover"
            src={item.poster}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm font-black">
            {item.title}
          </div>
        )}
        {item.score ? (
          <span className="absolute right-1 top-1 inline-flex items-center gap-1 border-2 border-foreground bg-background px-1.5 py-0.5 text-[11px] font-black">
            <Star className="size-3 fill-yellow-400 text-yellow-400" />
            {item.score.toFixed(1)}
          </span>
        ) : null}
      </div>
      <div className="p-2">
        <h2 className="line-clamp-2 min-h-[2.5em] text-sm font-black leading-tight">
          {item.title}
        </h2>
        <p className="line-clamp-1 text-xs font-bold text-muted-foreground">
          {item.subtitle}
        </p>
      </div>
    </Link>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-dashed border-foreground bg-background p-8 text-center font-black">
      {children}
    </div>
  );
}
