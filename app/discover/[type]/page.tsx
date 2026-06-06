import { notFound } from "next/navigation";

import { DiscoverGrid } from "@/components/discover-grid";
import {
  asCatalogType,
  catalogSorts,
  catalogTypes,
  type CatalogSort,
} from "@/lib/metadata";

/**
 * Full browse grid for one type (`/discover/movie`, `/discover/series`). The
 * type drives the heading + Cinemeta catalog; an optional `?sort=` deep-link
 * (from the board's "New" rows) sets the initial sort. Filtering/paging are
 * handled client-side by {@link DiscoverGrid}.
 */
export default async function DiscoverTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { type: typeParam } = await params;
  const { sort: sortParam } = await searchParams;

  const type = asCatalogType(typeParam);
  if (!type) {
    notFound();
  }

  const label = catalogTypes.find((entry) => entry.type === type)?.label ?? "Titles";
  const initialSort: CatalogSort = catalogSorts.some((s) => s.id === sortParam)
    ? (sortParam as CatalogSort)
    : "top";

  return (
    <div className="space-y-6">
      <header className="border-2 border-foreground bg-card p-4 shadow-line">
        <h1 className="text-2xl font-black">{label}</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Pick a title to see download sources.
        </p>
      </header>

      <DiscoverGrid initialSort={initialSort} type={type} />
    </div>
  );
}
