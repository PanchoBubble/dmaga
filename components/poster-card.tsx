import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { CatalogItem } from "@/lib/metadata";

/**
 * One poster tile in a browse grid/row. Links to the title detail page. Posters
 * are 2:3; we reserve the aspect box so the grid never reflows as images load,
 * and fall back to the title text when a poster is missing.
 */
export function PosterCard({ item }: { item: CatalogItem }) {
  const year = item.releaseInfo?.match(/\d{4}/)?.[0];
  const rating = item.imdbRating;

  return (
    <Link
      className="group flex flex-col border-2 border-foreground bg-card shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href={`/title/${item.type}/${item.id}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden border-b-2 border-foreground bg-muted">
        {item.poster ? (
          <Image
            alt={item.name}
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 45vw"
            src={item.poster}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm font-black">
            {item.name}
          </div>
        )}
        {rating ? (
          <span className="absolute right-1 top-1 inline-flex items-center gap-1 border-2 border-foreground bg-background px-1.5 py-0.5 text-[11px] font-black tabular-nums">
            <Star className="size-3 fill-yellow-400 text-yellow-400" />
            {rating}
          </span>
        ) : null}
      </div>
      {/* Fixed-height footer: the title always reserves two lines and the year
          row is always present, so every card (and thus every poster) is the
          same height and the grid lines up cleanly. */}
      <div className="flex flex-col gap-0.5 p-2">
        <h3 className="line-clamp-2 min-h-[2.5em] text-sm font-black leading-tight">
          {item.name}
        </h3>
        <span className="text-xs font-bold text-muted-foreground">{year ?? " "}</span>
      </div>
    </Link>
  );
}
