import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AddedPage() {
  return (
    <section className="border-2 border-foreground bg-card p-4 shadow-line">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Added</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Tracked Real-Debrid items will appear here.
          </p>
        </div>
        <Button aria-label="Added item actions" size="icon" variant="outline">
          <MoreHorizontal className="size-5" />
        </Button>
      </div>

      <div className="mt-8 border-2 border-dashed border-foreground bg-background p-8 text-center">
        <p className="text-lg font-black">No added torrents yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Search results you add will be tracked and polled until links are ready.
        </p>
      </div>
    </section>
  );
}
