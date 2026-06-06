"use client";

import { Search } from "lucide-react";

import { MediaCard } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import { useSearchStore } from "@/hooks/use-search-store";
import { mockMediaItems } from "@/lib/mock-media";

export default function SearchPage() {
  const query = useSearchStore((state) => state.query);
  const setQuery = useSearchStore((state) => state.setQuery);

  return (
    <div className="space-y-6">
      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-12 w-full border-2 border-foreground bg-background pl-11 pr-4 text-base font-semibold outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search torrents"
              value={query}
            />
          </div>
          <Button className="h-12">Search</Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {mockMediaItems.map((item, index) => (
          <MediaCard index={index} item={item} key={item.id} />
        ))}
      </section>
    </div>
  );
}
