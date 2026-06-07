"use client";

import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { MyAnimeListAnime, MyAnimeListStatus } from "@/lib/myanimelist";

export type MyAnimeListDiscoverRow = {
  id: MyAnimeListStatus;
  label: string;
  items: MyAnimeListAnime[];
};

export function MyAnimeListDiscoverRows({
  initialRows,
}: {
  initialRows: MyAnimeListDiscoverRow[];
}) {
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
    <section className="space-y-5">
      <h2 className="text-xl font-black">MyAnimeList</h2>
      {rows.map((row, index) => (
        <AnimeRow
          canMoveDown={index < rows.length - 1}
          canMoveUp={index > 0}
          items={row.items}
          key={row.id}
          onMoveDown={() => moveRow(index, 1)}
          onMoveUp={() => moveRow(index, -1)}
          title={row.label}
        />
      ))}
    </section>
  );
}

async function persistOrder(rowOrder: MyAnimeListStatus[]) {
  await fetch("/api/myanimelist/discover-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rowOrder }),
  });
}

function AnimeRow({
  title,
  items,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  title: string;
  items: MyAnimeListAnime[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black">{title}</h3>
        <div className="flex items-center gap-1">
          <Button
            aria-label={`Move ${title} up`}
            className="size-8"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            size="icon"
            type="button"
            variant="outline"
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            aria-label={`Move ${title} down`}
            className="size-8"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            size="icon"
            type="button"
            variant="outline"
          >
            <ArrowDown className="size-4" />
          </Button>
        </div>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {items.map((item) => (
          <AnimeCard item={item} key={item.id} />
        ))}
      </div>
    </section>
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
        <h4 className="line-clamp-2 min-h-[2.5em] text-sm font-black leading-tight">
          {item.title}
        </h4>
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
