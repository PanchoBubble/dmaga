"use client";

import { useMemo, useState } from "react";

import { TitleSources } from "@/components/title-sources";
import { buildSourceQuery, type EpisodeInfo } from "@/lib/metadata";
import { cn } from "@/lib/utils";

/**
 * Series source browser: pick a season, then an episode, and the download
 * source list below resolves to that exact episode (id-aware via the IMDB id,
 * plus an `SxxEyy` keyword query for non-id indexers).
 */
export function SeasonEpisodes({
  imdbId,
  name,
  episodes,
}: {
  imdbId: string;
  name: string;
  episodes: EpisodeInfo[];
}) {
  // Group episodes by season, preserving sorted order.
  const seasons = useMemo(() => {
    const map = new Map<number, EpisodeInfo[]>();
    for (const episode of episodes) {
      const list = map.get(episode.season) ?? [];
      list.push(episode);
      map.set(episode.season, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [episodes]);

  const [season, setSeason] = useState<number>(seasons[0]?.[0] ?? 1);
  const [selected, setSelected] = useState<EpisodeInfo | null>(null);

  const seasonEpisodes = seasons.find(([number]) => number === season)?.[1] ?? [];

  if (!seasons.length) {
    return (
      <p className="border-2 border-dashed border-foreground bg-background p-6 text-center font-bold">
        No episode information available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label
          className="text-xs font-black uppercase text-muted-foreground"
          htmlFor="season"
        >
          Season
        </label>
        <select
          className="h-9 border-2 border-foreground bg-background px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
          id="season"
          onChange={(event) => {
            setSeason(Number(event.target.value));
            setSelected(null);
          }}
          value={season}
        >
          {seasons.map(([number]) => (
            <option key={number} value={number}>
              Season {number}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-2">
        {seasonEpisodes.map((episode) => {
          const isSelected = selected?.id === episode.id;
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
                  {episode.overview ? (
                    <span className="mt-0.5 line-clamp-2 block text-xs font-semibold text-muted-foreground">
                      {episode.overview}
                    </span>
                  ) : null}
                </span>
              </button>

              {isSelected ? (
                <div className="mt-3 border-l-2 border-foreground pl-3">
                  <TitleSources
                    args={{
                      query: buildSourceQuery({
                        name,
                        season: episode.season,
                        episode: episode.episode,
                      }),
                      imdbId,
                      type: "series",
                      season: episode.season,
                      episode: episode.episode,
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
