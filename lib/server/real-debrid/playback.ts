import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, debridLinks } from "@/lib/db/schema";
import {
  classifyPlayback,
  guessSubtitleLanguage,
  isSubtitleFile,
  type PlaybackKind,
} from "@/lib/playback";
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

/** A sidecar subtitle file from the same torrent pack, offered as a video track. */
export type PlayableSubtitle = {
  /** Debrid link id of the subtitle file; serve its VTT via the subtitle route. */
  id: string;
  fileName: string;
  /** BCP-47 language code guessed from the filename, or null when unknown. */
  lang: string | null;
  label: string;
};

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
  /** Sidecar subtitle files in the same pack (video only); empty otherwise. */
  subtitles: PlayableSubtitle[];
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
  const { link, url } = await resolveLinkStream(linkId, options);
  const info = classifyPlayback(link.fileName, link.mimeType);

  // The web player only handles audio/video; subtitles and other files aren't
  // independently playable here (subtitles attach to a video as a track).
  if (info.kind !== "video" && info.kind !== "audio") {
    throw new PlaybackError("This file isn't a playable media file.", 415);
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
    subtitles:
      info.kind === "video" ? await findSubtitleSiblings(link.debridItemId) : [],
  };
}

/** A resolved subtitle file's direct URL, for the VTT-serving route. */
export type SubtitleStream = { fileName: string; url: string };

/**
 * Resolves a sidecar subtitle link to its direct URL (without the video/audio
 * gating of {@link getPlayableLink}). Throws 415 if the link isn't a subtitle.
 */
export async function resolveSubtitleStream(
  linkId: string,
  options: GetPlayableLinkOptions = {},
): Promise<SubtitleStream> {
  const { link, url } = await resolveLinkStream(linkId, options);
  if (classifyPlayback(link.fileName, link.mimeType).kind !== "subtitle") {
    throw new PlaybackError("This link is not a subtitle file.", 415);
  }
  return { fileName: link.fileName, url };
}

/** A resolved direct download URL for any file in a ready item. */
export type DownloadStream = { fileName: string; url: string };

/**
 * Resolves any debrid link to a fresh, direct download URL — no media-kind
 * gating, so it works for archives, ISOs, subtitles, etc. Used by the download
 * route to redirect the browser straight at Real-Debrid's CDN.
 */
export async function resolveDownloadStream(
  linkId: string,
  options: GetPlayableLinkOptions = {},
): Promise<DownloadStream> {
  const { link, url } = await resolveLinkStream(linkId, options);
  return { fileName: link.fileName, url };
}

type DebridLinkRow = typeof debridLinks.$inferSelect;

/**
 * Shared lookup + URL resolution for a debrid link: validates the link and its
 * parent item are present and ready, then returns the row plus a direct URL
 * (reusing the stored one unless `refresh` is set or it's absent).
 */
async function resolveLinkStream(
  linkId: string,
  options: GetPlayableLinkOptions,
): Promise<{ link: DebridLinkRow; url: string }> {
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

  const url =
    (!options.refresh ? link.unrestrictedLink : null) ??
    (await resolveFreshUrl(link.id, link.originalLink));

  if (!url) {
    throw new PlaybackError("No streamable URL is available for this file.", 502);
  }

  return { link, url };
}

/**
 * Finds sidecar subtitle files (`.srt`/`.vtt`/…) in the same torrent pack so the
 * player can offer them as `<track>` selections. Sorted by guessed language label.
 */
async function findSubtitleSiblings(
  debridItemId: string,
): Promise<PlayableSubtitle[]> {
  const siblings = await db
    .select({ id: debridLinks.id, fileName: debridLinks.fileName })
    .from(debridLinks)
    .where(eq(debridLinks.debridItemId, debridItemId));

  return siblings
    .filter((sibling) => {
      // Only formats we can serve as WebVTT are selectable as browser tracks;
      // ASS/SSA/SUB need a heavier renderer and are left to the external player.
      const { extension } = classifyPlayback(sibling.fileName);
      return (
        isSubtitleFile(sibling.fileName) &&
        (extension === "srt" || extension === "vtt")
      );
    })
    .map((sibling) => ({
      id: sibling.id,
      fileName: sibling.fileName,
      ...guessSubtitleLanguage(sibling.fileName),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
