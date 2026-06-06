import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, debridLinks } from "@/lib/db/schema";
import { classifyPlayback, type PlaybackKind } from "@/lib/playback";
import { createAuthenticatedRealDebridClient } from "@/lib/server/real-debrid/auth-service";
import { RealDebridApiError } from "@/lib/server/real-debrid/client";

export class PlaybackError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PlaybackError";
  }
}

/** A resolved, directly-streamable media link for the web player or VLC handoff. */
export type PlayableLink = {
  id: string;
  debridItemId: string;
  fileName: string;
  fileSizeBytes: number | null;
  host: string | null;
  /** Direct, range-capable URL the browser or VLC can stream from. */
  url: string;
  kind: PlaybackKind;
  /** True when an embedded HTML5 player can decode the file in-browser. */
  browserPlayable: boolean;
  mimeType: string | null;
};

type GetPlayableLinkOptions = {
  /** Force a fresh `unrestrict/link` call instead of reusing the stored URL. */
  refresh?: boolean;
};

/**
 * Resolves a debrid link to a playable media URL. Reuses the URL captured by the
 * poller when present; otherwise (or when `refresh` is set, e.g. after an expired
 * link) re-unrestricts the original link via Real-Debrid and persists the result.
 *
 * Throws {@link PlaybackError} with an HTTP-ish status for the API/page layers to
 * map: 404 missing, 409 not ready, 415 not media, 502 no URL available.
 */
export async function getPlayableLink(
  linkId: string,
  options: GetPlayableLinkOptions = {},
): Promise<PlayableLink> {
  const [link] = await db
    .select()
    .from(debridLinks)
    .where(eq(debridLinks.id, linkId))
    .limit(1);

  if (!link) {
    throw new PlaybackError("Link not found.", 404);
  }

  const [item] = await db
    .select({ status: debridItems.status })
    .from(debridItems)
    .where(eq(debridItems.id, link.debridItemId))
    .limit(1);

  if (!item || item.status === "deleted") {
    throw new PlaybackError("This item is no longer available.", 404);
  }
  if (item.status !== "ready") {
    throw new PlaybackError("This item isn't ready to play yet.", 409);
  }

  const info = classifyPlayback(link.fileName, link.mimeType);
  if (info.kind === "other") {
    throw new PlaybackError("This file isn't a playable media file.", 415);
  }

  const url =
    (!options.refresh ? link.unrestrictedLink : null) ??
    (await resolveFreshUrl(link.id, link.originalLink));

  if (!url) {
    throw new PlaybackError("No streamable URL is available for this file.", 502);
  }

  return {
    id: link.id,
    debridItemId: link.debridItemId,
    fileName: link.fileName,
    fileSizeBytes: link.fileSizeBytes,
    host: link.host,
    url,
    kind: info.kind,
    browserPlayable: info.browserPlayable,
    mimeType: info.mimeType,
  };
}

/**
 * Re-runs `unrestrict/link` for the original Real-Debrid link and persists the
 * fresh direct URL (and any updated size/host) back onto the row.
 */
async function resolveFreshUrl(
  linkId: string,
  originalLink: string,
): Promise<string | null> {
  let response;
  try {
    const client = await createAuthenticatedRealDebridClient();
    response = await client.unrestrictLink(originalLink);
  } catch (error) {
    if (error instanceof RealDebridApiError) {
      throw new PlaybackError(
        `Real-Debrid couldn't resolve this link: ${error.message}`,
        502,
      );
    }
    throw error;
  }

  const url = response.download ?? null;

  await db
    .update(debridLinks)
    .set({
      unrestrictedLink: url,
      fileSizeBytes: response.filesize ?? undefined,
      host: response.host ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(debridLinks.id, linkId));

  return url;
}
