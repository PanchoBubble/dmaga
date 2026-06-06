/**
 * Client-safe playback classification. Shared by the Added card, the player
 * page, and the stream API so "is this playable, and how?" is decided in one
 * place. No server-only imports here — this is bundled into the browser.
 */

export type PlaybackKind = "video" | "audio" | "other";

export type PlaybackInfo = {
  kind: PlaybackKind;
  /**
   * Whether a mainstream desktop browser's HTML5 `<video>`/`<audio>` element can
   * natively decode this container/codec. When false the UI falls back to an
   * external-player (VLC) handoff instead of an embedded web player.
   */
  browserPlayable: boolean;
  /** Best-guess MIME type for the `<source>` element, when known. */
  mimeType: string | null;
  /** Lower-cased file extension without the dot, when present. */
  extension: string | null;
};

/** Containers a browser `<video>` element plays natively across Chrome/Safari/Firefox. */
const BROWSER_VIDEO: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
};

/** Video containers we recognise as media but that browsers can't reliably decode. */
const EXTERNAL_VIDEO: Record<string, string> = {
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  ts: "video/mp2t",
  m2ts: "video/mp2t",
};

/** Audio containers a browser `<audio>` element plays natively. */
const BROWSER_AUDIO: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  flac: "audio/flac",
};

/** Audio containers we recognise but don't expect to play in-browser. */
const EXTERNAL_AUDIO: Record<string, string> = {
  wma: "audio/x-ms-wma",
  ape: "audio/x-ape",
  dts: "audio/vnd.dts",
};

function extensionOf(fileName: string): string | null {
  const match = /\.([a-z0-9]+)\s*$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : null;
}

/**
 * Classifies a file by name (and optional server-reported MIME type) into a
 * playback strategy. A provided `mimeType` only refines the MIME guess; the
 * playable/kind decision is driven by the file extension, which is what
 * Real-Debrid filenames reliably carry.
 */
export function classifyPlayback(
  fileName: string,
  mimeType?: string | null,
): PlaybackInfo {
  const extension = extensionOf(fileName);

  if (extension && extension in BROWSER_VIDEO) {
    return {
      kind: "video",
      browserPlayable: true,
      mimeType: mimeType ?? BROWSER_VIDEO[extension],
      extension,
    };
  }
  if (extension && extension in EXTERNAL_VIDEO) {
    return {
      kind: "video",
      browserPlayable: false,
      mimeType: mimeType ?? EXTERNAL_VIDEO[extension],
      extension,
    };
  }
  if (extension && extension in BROWSER_AUDIO) {
    return {
      kind: "audio",
      browserPlayable: true,
      mimeType: mimeType ?? BROWSER_AUDIO[extension],
      extension,
    };
  }
  if (extension && extension in EXTERNAL_AUDIO) {
    return {
      kind: "audio",
      browserPlayable: false,
      mimeType: mimeType ?? EXTERNAL_AUDIO[extension],
      extension,
    };
  }

  return {
    kind: "other",
    browserPlayable: false,
    mimeType: mimeType ?? null,
    extension,
  };
}

/** Whether a file is media we can offer a Play action for (web player or handoff). */
export function isPlayableMedia(fileName: string, mimeType?: string | null): boolean {
  return classifyPlayback(fileName, mimeType).kind !== "other";
}
