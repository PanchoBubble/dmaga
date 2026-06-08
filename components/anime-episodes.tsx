"use client";

import { useState } from "react";

import { TitleSources } from "@/components/title-sources";
import { buildSourceQuery, type EpisodeInfo } from "@/lib/metadata";
import { cn } from "@/lib/utils";

/**
 * Anime source browser mirroring the series {@link SeasonEpisodes} drilldown:
 * pick an episode and the download source list below resolves to it via an
 * `SxxEyy` keyword query. MAL models each anime as a single season, so there's
 * no season picker — just the episode list. Sources are scoped to the anime
 * Torznab category and tagged to the MAL Added section.
 */
export function AnimeEpisodes({
  title,
  poster,
  episodes,
}: {
  title: string;
  poster?: string;
  episodes: EpisodeInfo[];
}) {
  const [selected, setSelected] = useState<EpisodeInfo | null>(null);

  if (!episodes.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-black uppercase text-muted-foreground">
          Episodes
        </span>
        <span className="border-2 border-foreground bg-background px-2 py-0.5 text-xs font-black tabular-nums">
          {episodes.length}
        </span>
      </div>

      <ul className="space-y-2">
        {episodes.map((episode) => {
          const isSelected = selected?.id === episode.id;
          const episodeLabel = `E${String(episode.episode).padStart(2, "0")}${
            episode.name ? ` · ${episode.name}` : ""
          }`;
          return (
            <li key={episode.id}>
              <button
                aria-expanded={isSelected}
                className={cn(
                  "flex w-full items-start gap-3 border-2 border-foreground p-3 text-left shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected ? "bg-[hsl(134deg_40%_82%)]" : "bg-card",
                )}
                onClick={() => setSelected(isSelected ? null : episode)}
                type="button"
              >
                <span className="mt-0.5 shrink-0 border-2 border-foreground bg-background px-2 py-0.5 text-xs font-black tabular-nums">
                  {episode.episode}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black leading-tight">{episode.name}</span>
                </span>
              </button>

              {isSelected ? (
                <div className="mt-3 border-l-2 border-foreground pl-3">
                  <TitleSources
                    args={{
                      query: buildSourceQuery({
                        name: title,
                        season: episode.season,
                        episode: episode.episode,
                      }),
                      displayTitle: episodeLabel,
                      previewImageUrl: poster,
                      type: "series",
                      season: episode.season,
                      episode: episode.episode,
                      categories: ["5070"],
                      originSection: "mal",
                    }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
