import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { PosterCard } from "@/components/poster-card";
import type { CatalogItem } from "@/lib/metadata";

/**
 * A titled, horizontally-scrolling strip of posters for the Discover board —
 * the Stremio "row" pattern. The heading links through to the full grid for
 * that type. Renders nothing when the catalog came back empty.
 */
export function PosterRow({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: CatalogItem[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">{title}</h2>
        <Link
          className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"
          href={href}
        >
          See all
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {items.map((item) => (
          <div className="w-32 shrink-0 sm:w-36" key={`${item.type}:${item.id}`}>
            <PosterCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
