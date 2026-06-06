import { Star } from "lucide-react";

import { MediaCard } from "@/components/media-card";
import { mockMediaItems } from "@/lib/mock-media";

export default function SavedPage() {
  const savedItems = mockMediaItems.filter((item) => item.saved);

  return (
    <div className="space-y-4">
      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex items-center gap-3">
          <Star className="size-6 fill-current" />
          <div>
            <h1 className="text-2xl font-black">Saved</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Starred torrents stay here until you add or remove them.
            </p>
          </div>
        </div>
      </section>

      {savedItems.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {savedItems.map((item, index) => (
            <MediaCard index={index} item={item} key={item.id} />
          ))}
        </section>
      ) : (
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">Nothing saved yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the star on search results to save torrents for later.
          </p>
        </div>
      )}
    </div>
  );
}
