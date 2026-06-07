"use client";

import { ArrowDown, ArrowUp, ChevronRight, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { PosterCard } from "@/components/poster-card";
import { Button } from "@/components/ui/button";
import type { DiscoverRow, DiscoverRowId } from "@/lib/discover";
import type { MangaCatalogItem } from "@/lib/manga";
import type { MyAnimeListAnime } from "@/lib/myanimelist";

export function DiscoverRows({ initialRows }: { initialRows: DiscoverRow[] }) {
  const [rows, setRows] = useState(initialRows);

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) {
      return;
    }

    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    void persistOrder(next.map((row) => row.id));
  }

  return (
    <section className="space-y-6">
      {rows.map((row, index) => (
        <section className="space-y-3" key={row.id}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {row.kind !== "mal" ? (
                <Link
                  className="inline-flex items-center gap-1 hover:text-muted-foreground"
                  href={row.href}
                >
                  <h2 className="text-xl font-black">{row.title}</h2>
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <h2 className="text-xl font-black">{row.title}</h2>
              )}
            </div>

            <div className="flex items-center gap-1">
              {row.kind !== "mal" ? (
                <Link
                  className="mr-2 hidden text-sm font-bold text-muted-foreground hover:text-foreground sm:inline-flex"
                  href={row.href}
                >
                  See all
                </Link>
              ) : null}
              <Button
                aria-label={`Move ${row.title} up`}
                className="size-8"
                disabled={index === 0}
                onClick={() => moveRow(index, -1)}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                aria-label={`Move ${row.title} down`}
                className="size-8"
                disabled={index === rows.length - 1}
                onClick={() => moveRow(index, 1)}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowDown className="size-4" />
              </Button>
            </div>
          </div>

          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {row.kind === "catalog"
              ? row.items.map((item) => (
                  <div
                    className="w-32 shrink-0 sm:w-36"
                    key={`${item.type}:${item.id}`}
                  >
                    <PosterCard item={item} />
                  </div>
                ))
              : row.kind === "manga"
                ? row.items.map((item) => <MangaCard item={item} key={item.slug} />)
                : row.items.map((item) => <AnimeCard item={item} key={item.id} />)}
          </div>
        </section>
      ))}
    </section>
  );
}

async function persistOrder(rowOrder: DiscoverRowId[]) {
  await fetch("/api/discover/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rowOrder }),
  });
}

function MangaCard({ item }: { item: MangaCatalogItem }) {
  return (
    <Link
      className="group flex w-32 shrink-0 flex-col border-2 border-foreground bg-card shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-36"
      href={`/manga/${item.slug}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden border-b-2 border-foreground bg-secondary">
        {item.poster ? (
          <Image
            alt={item.title}
            className="object-cover"
            fill
            sizes="9rem"
            src={item.poster}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm font-black">
            {item.title}
          </div>
        )}
        <span className="absolute right-1 top-1 border-2 border-foreground bg-background px-1.5 py-0.5 text-[10px] font-black uppercase">
          Read
        </span>
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <h3 className="line-clamp-2 min-h-[2.5em] text-sm font-black leading-tight">
          {item.title}
        </h3>
        <span className="line-clamp-1 text-xs font-bold text-muted-foreground">
          {item.subtitle}
        </span>
      </div>
    </Link>
  );
}

function AnimeCard({ item }: { item: MyAnimeListAnime }) {
  return (
    <Link
      className="group flex w-32 shrink-0 flex-col border-2 border-foreground bg-card shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-36"
      href={`/anime/myanimelist/${item.id}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden border-b-2 border-foreground bg-muted">
        {item.picture ? (
          <Image
            alt={item.title}
            className="object-cover"
            fill
            sizes="9rem"
            src={item.picture}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm font-black">
            {item.title}
          </div>
        )}
        <span className="absolute right-1 top-1 border-2 border-foreground bg-background p-1">
          <ExternalLink className="size-3" />
        </span>
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <h3 className="line-clamp-2 min-h-[2.5em] text-sm font-black leading-tight">
          {item.title}
        </h3>
        <span className="text-xs font-bold text-muted-foreground">
          {item.episodesWatched != null
            ? `${item.episodesWatched} watched`
            : item.score
              ? `Score ${item.score}`
              : "\u00a0"}
        </span>
      </div>
    </Link>
  );
}
