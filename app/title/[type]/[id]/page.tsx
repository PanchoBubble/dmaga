import { Clock, Star } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";

import { SeasonEpisodes } from "@/components/season-episodes";
import { TitleSources } from "@/components/title-sources";
import { asCatalogType, buildSourceQuery } from "@/lib/metadata";
import { fetchTitle } from "@/lib/server/metadata/cinemeta";

export const dynamic = "force-dynamic";

/**
 * Stremio-style title detail: hero metadata up top, download sources below.
 * Movies render a single source list; series render a season/episode picker
 * that drives the source list per episode.
 */
export default async function TitleDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type: typeParam, id } = await params;
  const type = asCatalogType(typeParam);
  if (!type) {
    notFound();
  }

  const title = await fetchTitle(type, id);
  if (!title) {
    notFound();
  }

  const year = title.releaseInfo;
  const genres = title.genres?.slice(0, 4) ?? [];

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden border-2 border-foreground bg-card shadow-line">
        {title.background ? (
          <div className="absolute inset-0">
            <Image
              alt=""
              className="object-cover opacity-20"
              fill
              sizes="100vw"
              src={title.background}
              unoptimized
            />
          </div>
        ) : null}

        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:gap-6">
          <div className="relative aspect-[2/3] w-32 shrink-0 self-start overflow-hidden border-2 border-foreground bg-muted sm:w-44">
            {title.poster ? (
              <Image
                alt={title.name}
                className="object-cover"
                fill
                sizes="(min-width: 640px) 11rem, 8rem"
                src={title.poster}
                unoptimized
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight sm:text-3xl">
              {title.name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold">
              {year ? (
                <span className="border-2 border-foreground bg-background px-2 py-0.5">
                  {year}
                </span>
              ) : null}
              {title.imdbRating ? (
                <span className="inline-flex items-center gap-1 border-2 border-foreground bg-background px-2 py-0.5 tabular-nums">
                  <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                  {title.imdbRating}
                </span>
              ) : null}
              {title.runtime ? (
                <span className="inline-flex items-center gap-1 border-2 border-foreground bg-background px-2 py-0.5">
                  <Clock className="size-3.5" />
                  {title.runtime}
                </span>
              ) : null}
            </div>

            {genres.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {genres.map((genre) => (
                  <span
                    className="border-2 border-foreground bg-[hsl(52deg_65.22%_95.49%)] px-2 py-0.5 text-xs font-black"
                    key={genre}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}

            {title.description ? (
              <p className="mt-3 max-w-prose text-sm font-semibold leading-relaxed text-muted-foreground">
                {title.description}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {type === "series" ? (
        <SeasonEpisodes episodes={title.episodes} imdbId={title.id} name={title.name} />
      ) : (
        <TitleSources
          args={{
            query: buildSourceQuery({
              name: title.name,
              releaseInfo: title.releaseInfo,
            }),
            imdbId: title.id,
            type: "movie",
          }}
        />
      )}
    </div>
  );
}
