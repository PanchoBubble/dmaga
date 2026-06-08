import { ExternalLink, Star, Tv } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";

import { TitleSources } from "@/components/title-sources";
import { Button } from "@/components/ui/button";
import { getMyAnimeListAnime } from "@/lib/server/myanimelist/auth-service";

export const dynamic = "force-dynamic";

export default async function MyAnimeListAnimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const animeId = Number(id);
  if (!Number.isInteger(animeId) || animeId <= 0) {
    notFound();
  }

  const anime = await getMyAnimeListAnime(animeId);
  if (!anime) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden border-2 border-foreground bg-card shadow-line">
        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:gap-6">
          <div className="relative aspect-[2/3] w-32 shrink-0 self-start overflow-hidden border-2 border-foreground bg-muted sm:w-44">
            {anime.picture ? (
              <Image
                alt={anime.title}
                className="object-cover"
                fill
                sizes="(min-width: 640px) 11rem, 8rem"
                src={anime.picture}
                unoptimized
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight sm:text-3xl">
              {anime.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold">
              {anime.startDate ? (
                <span className="border-2 border-foreground bg-background px-2 py-0.5">
                  {anime.startDate.slice(0, 4)}
                </span>
              ) : null}
              {anime.mean ? (
                <span className="inline-flex items-center gap-1 border-2 border-foreground bg-background px-2 py-0.5 tabular-nums">
                  <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                  {anime.mean}
                </span>
              ) : null}
              {anime.episodes ? (
                <span className="inline-flex items-center gap-1 border-2 border-foreground bg-background px-2 py-0.5">
                  <Tv className="size-3.5" />
                  {anime.episodes} episodes
                </span>
              ) : null}
            </div>

            {anime.synopsis ? (
              <p className="mt-3 max-w-prose text-sm font-semibold leading-relaxed text-muted-foreground">
                {anime.synopsis}
              </p>
            ) : null}

            <div className="mt-4">
              <Button asChild className="h-9 px-3 text-xs" variant="outline">
                <a href={anime.url} rel="noreferrer" target="_blank">
                  <ExternalLink className="size-4" />
                  MyAnimeList
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <TitleSources
        args={{
          query: anime.title,
          type: "series",
          categories: ["5070"],
          originSection: "mal",
        }}
      />
    </div>
  );
}
