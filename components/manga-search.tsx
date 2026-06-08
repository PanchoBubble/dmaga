"use client";

import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";

import { TitleSources } from "@/components/title-sources";
import { Button } from "@/components/ui/button";

export function MangaSearch() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draft.trim());
  }

  return (
    <section className="space-y-4">
      <form
        className="flex flex-col gap-3 border-2 border-foreground bg-card p-4 shadow-line md:flex-row"
        onSubmit={handleSubmit}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-12 w-full border-2 border-foreground bg-background pl-11 pr-4 text-base font-semibold outline-none focus:ring-2 focus:ring-ring"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search manga"
            value={draft}
          />
        </div>
        <Button className="h-12" type="submit">
          Search
        </Button>
      </form>

      {query ? (
        <TitleSources
          args={{
            query: `${query} manga`,
            type: "manga",
            categories: ["7030"],
          }}
          mode="manga"
          title="Manga Sources"
        />
      ) : null}
    </section>
  );
}
