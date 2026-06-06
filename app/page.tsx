"use client";

import { motion } from "framer-motion";
import { Download, Search, ShieldCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/status-card";
import { useSearchStore } from "@/hooks/use-search-store";

const mockResults = [
  {
    title: "Example Movie 2160p WEB-DL",
    size: "18.4 GB",
    seeds: 284,
    age: "2h",
    indexer: "Torznab Demo",
    status: "Ready in Debrid",
  },
  {
    title: "Example Series S01 1080p",
    size: "42.1 GB",
    seeds: 119,
    age: "1d",
    indexer: "Private Demo",
    status: "Addable",
  },
];

export default function SearchPage() {
  const query = useSearchStore((state) => state.query);
  const setQuery = useSearchStore((state) => state.setQuery);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard
          detail="OAuth setup will persist the Real-Debrid session server-side."
          icon={ShieldCheck}
          title="Real-Debrid"
          value="Not linked"
        />
        <StatusCard
          detail="Per-indexer FlareSolverr routing is planned."
          icon={Zap}
          title="Indexers"
          tone="blue"
          value="0 active"
        />
        <StatusCard
          detail="Polling will move finished items into the Added library."
          icon={Download}
          title="Added"
          tone="red"
          value="0 items"
        />
      </section>

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
        {mockResults.map((result, index) => (
          <motion.article
            animate={{ opacity: 1, y: 0 }}
            className="border-2 border-foreground bg-card p-4 shadow-line"
            initial={{ opacity: 0, y: 8 }}
            key={result.title}
            transition={{ delay: index * 0.08 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  {result.indexer}
                </p>
                <h2 className="mt-2 text-xl font-black">{result.title}</h2>
              </div>
              <span className="border-2 border-foreground bg-secondary px-2 py-1 text-xs font-black">
                {result.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm font-semibold">
              <div>Size: {result.size}</div>
              <div>Seeds: {result.seeds}</div>
              <div>Age: {result.age}</div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline">Details</Button>
              <Button>{result.status === "Ready in Debrid" ? "Download" : "Add"}</Button>
            </div>
          </motion.article>
        ))}
      </section>
    </div>
  );
}
