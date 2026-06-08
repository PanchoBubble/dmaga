import { NextRequest, NextResponse } from "next/server";

import { asCatalogType } from "@/lib/metadata";
import {
  normalizeSubtitleLang,
  subtitleLanguageLabel,
  type SubtitleItem,
} from "@/lib/subtitles";

export const dynamic = "force-dynamic";

const OPENSUBTITLES_ADDON = "https://opensubtitles-v3.strem.io";

type StremioSubtitle = {
  id?: unknown;
  url?: unknown;
  lang?: unknown;
  g?: unknown;
};

export async function GET(request: NextRequest) {
  const type = asCatalogType(request.nextUrl.searchParams.get("type") ?? undefined);
  const imdbId = request.nextUrl.searchParams.get("id")?.trim();
  const season = parsePositiveInt(request.nextUrl.searchParams.get("season"));
  const episode = parsePositiveInt(request.nextUrl.searchParams.get("episode"));

  if (!type || !imdbId?.startsWith("tt")) {
    return NextResponse.json({ error: "A valid type and IMDB id are required." }, { status: 400 });
  }
  if (type === "series" && (!season || !episode)) {
    return NextResponse.json(
      { error: "Series subtitle lookup requires season and episode." },
      { status: 400 },
    );
  }

  const stremioId = type === "series" ? `${imdbId}:${season}:${episode}` : imdbId;
  const url = `${OPENSUBTITLES_ADDON}/subtitles/${type}/${encodeURIComponent(stremioId)}.json`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Subtitle provider returned HTTP ${response.status}.` },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as { subtitles?: StremioSubtitle[] };
    const subtitles = normalizeSubtitles(payload.subtitles ?? []);
    return NextResponse.json({ subtitles });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load subtitles.",
      },
      { status: 502 },
    );
  }
}

function normalizeSubtitles(items: StremioSubtitle[]): SubtitleItem[] {
  const seen = new Set<string>();
  return items
    .flatMap((item): SubtitleItem[] => {
      const id = typeof item.id === "string" ? item.id : undefined;
      const url = typeof item.url === "string" ? item.url : undefined;
      const lang = typeof item.lang === "string" ? item.lang : "und";
      if (!id || !url || seen.has(`${id}:${url}`)) {
        return [];
      }
      seen.add(`${id}:${url}`);
      const normalizedLang = normalizeSubtitleLang(lang);
      return [{
        id,
        url,
        lang: normalizedLang,
        label: subtitleLanguageLabel(lang),
        source: "OpenSubtitles",
        downloads: toNumber(item.g),
      }];
    })
    .sort((a, b) => {
      if (a.lang === "en" && b.lang !== "en") {
        return -1;
      }
      if (a.lang !== "en" && b.lang === "en") {
        return 1;
      }
      return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
    });
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function toNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
