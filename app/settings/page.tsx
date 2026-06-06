import { Plus, TestTube2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Indexers</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Add Torznab-compatible indexers first, then enable FlareSolverr per
              indexer.
            </p>
          </div>
          <Button>
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="border-2 border-dashed border-foreground bg-background p-6">
            <p className="font-black">No indexers configured</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The first adapter will target generic Torznab/Newznab-style search.
            </p>
          </div>
        </div>
      </section>

      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <h2 className="text-xl font-black">Services</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["Postgres", "Redis", "FlareSolverr"].map((service) => (
            <div
              className="flex items-center justify-between border-2 border-foreground bg-background p-3"
              key={service}
            >
              <span className="font-bold">{service}</span>
              <Button size="sm" variant="outline">
                <TestTube2 className="size-4" />
                Test
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
