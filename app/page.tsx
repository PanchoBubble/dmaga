"use client";

import { Search } from "lucide-react";

import { MediaCard } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import { useSearchStore } from "@/hooks/use-search-store";
import { mediaCategories, mockMediaItems } from "@/lib/mock-media";
import { cn } from "@/lib/utils";

export default function SearchPage() {
  const query = useSearchStore((state) => state.query);
  const category = useSearchStore((state) => state.category);
  const setQuery = useSearchStore((state) => state.setQuery);
  const setCategory = useSearchStore((state) => state.setCategory);
  const filteredItems = mockMediaItems.filter((item) => {
    const matchesCategory = category === "all" || item.category === category;
    const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase());

    return matchesCategory && matchesQuery;
  });

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

        <div className="mt-4 flex flex-wrap gap-2">
          {mediaCategories.map((option) => (
            <Button
              className={cn(
                "h-9 px-3 text-xs",
                category === option.id && "bg-secondary text-secondary-foreground",
              )}
              key={option.id}
              onClick={() => setCategory(option.id)}
              size="sm"
              variant={category === option.id ? "secondary" : "outline"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </section>

      {filteredItems.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {filteredItems.map((item, index) => (
            <MediaCard index={index} item={item} key={item.id} />
          ))}
        </section>
      ) : (
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">No matches</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another category or search term.
          </p>
        </div>
      )}
    </div>
  );
}
