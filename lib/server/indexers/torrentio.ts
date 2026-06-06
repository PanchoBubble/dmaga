import { fetchIndexerText } from "@/lib/server/indexers/fetch";
import { magnetFromInfoHash, normalizeHash } from "@/lib/server/indexers/info-hash";
import {
  IndexerError,
  type IndexerAdapter,
  type IndexerConfig,
  type IndexerTestOutcome,
  type IndexerType,
  type TorrentSearchParams,
  type TorrentSearchResult,
} from "@/lib/server/indexers/types";

/**
 * Torrentio is a Stremio addon that aggregates many torrent sources keyed by
 * IMDB id (not free-text). Our search box is keyword-based, so this adapter
 * first resolves the query to an IMDB id via Stremio's Cinemeta catalog, then
 * asks Torrentio for streams. Torrentio returns each stream's `infoHash`, which
 * flows through the same dedupe + Real-Debrid availability pipeline as every
 * other indexer — no RD key is ever sent to Torrentio.
 *
 * Movies resolve from the bare query. Series only resolve when the query
 * carries an episode marker (`S01E02`, `1x02`), since Torrentio needs a
 * season/episode to return episode streams.
 */
const CINEMETA_BASE = "https://v3-cinemeta.strem.io/";

type CinemetaResponse = {
  metas?: Array<{ id?: string; imdb_id?: string; name?: string }>;
};

type TorrentioResponse = {
  streams?: Array<{
    name?: string;
    title?: string;
    infoHash?: string;
    behaviorHints?: { filename?: string };
  }>;
};

type ResolvedTarget = {
  /** Torrentio stream type. */
  type: "movie" | "series";
  /** Torrentio video id: `tt123` for movies, `tt123:season:episode` for series. */
  videoId: string;
};

export class TorrentioIndexerAdapter implements IndexerAdapter {
  readonly type: IndexerType = "torrentio";

  async search(
    config: IndexerConfig,
    params: TorrentSearchParams,
  ): Promise<TorrentSearchResult[]> {
    const target = await resolveTarget(config, params);
    if (!target) {
      return [];
    }

    const url = streamUrl(config, target);
    const payload = parseJson<TorrentioResponse>(
      config,
      await fetchIndexerText(config, url, { signal: params.signal }),
    );
    return normalizeStreams(config, payload.streams ?? [], params.limit);
  }

  async test(config: IndexerConfig): Promise<IndexerTestOutcome> {
    const results = await this.search(config, { query: "Interstellar 2014", limit: 1 });
    const suffix = results.length ? " and returned a result" : "";
    return { ok: true, message: `Torrentio responded${suffix}.` };
  }
}

/** Parses a `S01E02` / `1x02` marker; strips it from the query when found. */
function parseEpisode(query: string): {
  title: string;
  season: number;
  episode: number;
} | null {
  const match =
    query.match(/\bs(\d{1,2})\s*[._\s-]*e(\d{1,3})\b/i) ??
    query.match(/\b(\d{1,2})x(\d{1,3})\b/);
  if (!match) {
    return null;
  }
  const title = query.replace(match[0], " ").replace(/\s+/g, " ").trim();
  return { title, season: Number(match[1]), episode: Number(match[2]) };
}

/** Resolves the keyword query to a Torrentio movie/series target via Cinemeta. */
async function resolveTarget(
  config: IndexerConfig,
  params: TorrentSearchParams,
): Promise<ResolvedTarget | null> {
  const episode = parseEpisode(params.query);
  const cinemetaType = episode ? "series" : "movie";
  const title = episode ? episode.title : params.query;

  const imdbId = await resolveImdbId(config, cinemetaType, title, params.signal);
  if (!imdbId) {
    return null;
  }

  return episode
    ? { type: "series", videoId: `${imdbId}:${episode.season}:${episode.episode}` }
    : { type: "movie", videoId: imdbId };
}

async function resolveImdbId(
  config: IndexerConfig,
  type: "movie" | "series",
  query: string,
  signal: AbortSignal | undefined,
): Promise<string | undefined> {
  const url = new URL(
    `catalog/${type}/top/search=${encodeURIComponent(query)}.json`,
    CINEMETA_BASE,
  );
  const payload = parseJson<CinemetaResponse>(
    config,
    await fetchIndexerText(config, url.toString(), { signal }),
  );
  const meta = payload.metas?.find((entry) =>
    (entry.imdb_id ?? entry.id)?.startsWith("tt"),
  );
  return meta?.imdb_id ?? meta?.id;
}

/**
 * Builds the Torrentio stream URL. Optional provider/sort options come from the
 * indexer's stored `settings.options` (e.g. `sort=qualitysize|qualityfilter=480p`).
 */
function streamUrl(config: IndexerConfig, target: ResolvedTarget): string {
  const options = optionsSegment(config);
  return new URL(
    `${options}stream/${target.type}/${target.videoId}.json`,
    ensureTrailingSlash(config.baseUrl),
  ).toString();
}

function optionsSegment(config: IndexerConfig): string {
  const options = config.settings?.options;
  return typeof options === "string" && options.trim()
    ? `${options.trim().replace(/^\/+|\/+$/g, "")}/`
    : "";
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function normalizeStreams(
  config: IndexerConfig,
  streams: TorrentioResponse["streams"] & object,
  limit: number | undefined,
): TorrentSearchResult[] {
  const results: TorrentSearchResult[] = [];
  const seen = new Set<string>();

  for (const stream of streams ?? []) {
    const infoHash = normalizeHash(stream.infoHash);
    if (!infoHash || seen.has(infoHash)) {
      continue;
    }
    seen.add(infoHash);

    const title = streamTitle(stream);
    results.push({
      id: `${config.id}:${infoHash}`,
      title,
      sizeBytes: parseSize(stream.title),
      seeders: parseSeeders(stream.title),
      indexerId: config.id,
      indexerName: config.name,
      magnetUrl: magnetFromInfoHash(infoHash, title),
      infoHash,
    });

    if (results.length >= (limit ?? 50)) {
      break;
    }
  }

  return results;
}

/** Prefers the resolved filename (sans extension), else the title's first line. */
function streamTitle(stream: {
  title?: string;
  behaviorHints?: { filename?: string };
}): string {
  const filename = stream.behaviorHints?.filename?.replace(/\.[a-z0-9]{2,4}$/i, "");
  if (filename) {
    return filename;
  }
  const firstLine = stream.title?.split("\n")[0]?.trim();
  return firstLine && firstLine.length ? firstLine : "Untitled";
}

/** Torrentio encodes seeders in the stream title as `👤 42`. */
function parseSeeders(title: string | undefined): number | undefined {
  const match = title?.match(/👤\s*(\d+)/);
  return match ? Number(match[1]) : undefined;
}

/** Torrentio encodes size in the stream title as `💾 12.26 GB`. */
function parseSize(title: string | undefined): number | undefined {
  const match = title?.match(/💾\s*([\d.]+)\s*([KMGT]?i?B)/i);
  if (!match) {
    return undefined;
  }
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  const multiplier = unit.startsWith("T")
    ? 1024 ** 4
    : unit.startsWith("G")
      ? 1024 ** 3
      : unit.startsWith("M")
        ? 1024 ** 2
        : unit.startsWith("K")
          ? 1024
          : 1;
  return Number.isFinite(amount) ? Math.round(amount * multiplier) : undefined;
}

function parseJson<T>(config: IndexerConfig, body: string): T {
  try {
    return JSON.parse(body) as T;
  } catch (cause) {
    throw new IndexerError("Failed to parse Torrentio/Cinemeta response.", {
      indexerId: config.id,
      indexerName: config.name,
      cause,
    });
  }
}
