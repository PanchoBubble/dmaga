import {
  PlaybackError,
  resolveSubtitleStream,
} from "@/lib/server/real-debrid/playback";

type RouteContext = { params: Promise<{ id: string }> };

// Resolves a (possibly expiring) Real-Debrid URL on each request, so never cache.
export const dynamic = "force-dynamic";

/**
 * Serves a sidecar subtitle file as WebVTT so the HTML5 player can attach it via
 * a `<track>`. SRT is converted on the fly; VTT is passed through. The link must
 * classify as a subtitle file, and must be one of the browser-servable formats
 * the player offers (srt/vtt) — anything else 415s.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    let stream = await resolveSubtitleStream(id);

    // Subtitle URLs expire like media URLs; on a stale fetch, re-resolve once.
    let response = await fetch(stream.url);
    if (!response.ok) {
      stream = await resolveSubtitleStream(id, { refresh: true });
      response = await fetch(stream.url);
    }
    if (!response.ok) {
      return Response.json(
        { error: "Couldn't fetch the subtitle file." },
        { status: 502 },
      );
    }

    const body = await response.text();
    const vtt = toWebVtt(body);

    return new Response(vtt, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PlaybackError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Unable to load subtitle.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * Converts SubRip (SRT) text to WebVTT: prepends the `WEBVTT` header and rewrites
 * `00:00:20,000` comma decimal separators to the `00:00:20.000` dots VTT requires.
 * Already-VTT input (header present) is normalised and returned as-is.
 */
function toWebVtt(input: string): string {
  // Strip a UTF-8 BOM and normalise line endings.
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  if (/^\s*WEBVTT/.test(text)) {
    return text;
  }

  const converted = text.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2",
  );
  return `WEBVTT\n\n${converted.trimStart()}`;
}
