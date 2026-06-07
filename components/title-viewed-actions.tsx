"use client";

import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CatalogType } from "@/lib/metadata";
import { cn } from "@/lib/utils";
import type { ViewedTitleResponse } from "@/lib/viewed";

export function TitleViewedActions({
  catalogType,
  catalogId,
  title,
  initialViewed,
  myAnimeListUrl,
}: {
  catalogType: CatalogType;
  catalogId: string;
  title: string;
  initialViewed: boolean;
  myAnimeListUrl: string;
}) {
  const [viewed, setViewed] = useState(initialViewed);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleViewed() {
    const next = !viewed;
    setPending(true);
    setError(null);
    setViewed(next);

    try {
      const response = await fetch("/api/viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogType,
          catalogId,
          title,
          myAnimeListUrl,
          viewed: next,
        }),
      });
      const payload = (await response.json()) as
        | ViewedTitleResponse
        | { error: string };
      if (!response.ok || !("viewed" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Unable to update viewed state.",
        );
      }
      setViewed(payload.viewed);
    } catch (caught) {
      setViewed(!next);
      setError(caught instanceof Error ? caught.message : "Unable to update viewed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button
        className={cn(
          "h-9 px-3 text-xs",
          viewed ? "bg-emerald-500 text-white hover:bg-emerald-500/90" : "",
        )}
        disabled={pending}
        onClick={() => void toggleViewed()}
        type="button"
        variant={viewed ? "secondary" : "outline"}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className={cn("size-4", viewed ? "fill-emerald-200" : "")} />
        )}
        {viewed ? "Viewed" : "Mark viewed"}
      </Button>

      <Button asChild className="h-9 px-3 text-xs" type="button" variant="outline">
        <a href={myAnimeListUrl} rel="noreferrer" target="_blank">
          <ExternalLink className="size-4" />
          MyAnimeList
        </a>
      </Button>

      {error ? (
        <p className="basis-full text-xs font-bold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
