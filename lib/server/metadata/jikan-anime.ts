import "server-only";

import type { EpisodeInfo } from "@/lib/metadata";

const JIKAN_BASE = "https://api.jikan.moe/v4";
const REVALIDATE_SECONDS = 60 * 60;
// MAL treats each anime entry as a single season/cour, so episodes all live
// under season 1. Cap pagination so a marathon series (One Piece, etc.) can't
// fan out into an unbounded number of upstream requests.
const ANIME_SEASON = 1;
const MAX_EPISODE_PAGES = 26;

type JikanEpisodesResponse = {
  data?: RawJikanEpisode[];
  pagination?: {
    has_next_page?: boolean;
  };
};

type RawJikanEpisode = {
  mal_id?: number;
  title?: string | null;
  title_japanese?: string | null;
  aired?: string | null;
};

/**
 * Builds a season-1 episode list for an anime so its source browser can mirror
 * the series season → episode → sources drilldown. Episode titles come from the
 * Jikan API (`/anime/{id}/episodes`); when Jikan is unavailable we fall back to
 * numbering 1..N from MyAnimeList's episode count, and to an empty list when no
 * count is known (e.g. an ongoing series) so the caller can whole-title search.
 */
export async function fetchAnimeEpisodes(
  malId: number,
  totalEpisodes?: number,
): Promise<EpisodeInfo[]> {
  const fromJikan = await fetchJikanEpisodes(malId);
  if (fromJikan.length) {
    return fromJikan;
  }

  if (totalEpisodes && totalEpisodes > 0) {
    return Array.from({ length: totalEpisodes }, (_, index) =>
      synthesizeEpisode(malId, index + 1),
    );
  }

  return [];
}

async function fetchJikanEpisodes(malId: number): Promise<EpisodeInfo[]> {
  const episodes: EpisodeInfo[] = [];

  for (let page = 1; page <= MAX_EPISODE_PAGES; page += 1) {
    let payload: JikanEpisodesResponse;
    try {
      const response = await fetch(
        `${JIKAN_BASE}/anime/${malId}/episodes?page=${page}`,
        { next: { revalidate: REVALIDATE_SECONDS } },
      );
      if (!response.ok) {
        break;
      }
      payload = (await response.json()) as JikanEpisodesResponse;
    } catch {
      break;
    }

    for (const raw of payload.data ?? []) {
      const number = raw.mal_id;
      if (!number || number <= 0) {
        continue;
      }
      episodes.push({
        id: `mal-${malId}-${number}`,
        season: ANIME_SEASON,
        episode: number,
        name: raw.title?.trim() || raw.title_japanese?.trim() || `Episode ${number}`,
        released: raw.aired ?? undefined,
      });
    }

    if (!payload.pagination?.has_next_page) {
      break;
    }
  }

  return episodes;
}

function synthesizeEpisode(malId: number, number: number): EpisodeInfo {
  return {
    id: `mal-${malId}-${number}`,
    season: ANIME_SEASON,
    episode: number,
    name: `Episode ${number}`,
  };
}
