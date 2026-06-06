/**
 * Client-safe playback classification. Shared by the Added card, the player
 * page, and the stream API so "is this playable, and how?" is decided in one
 * place. No server-only imports here — this is bundled into the browser.
 */

export type PlaybackKind = "video" | "audio" | "subtitle" | "other";

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

/** Sidecar subtitle formats often bundled alongside video in a torrent pack. */
const SUBTITLE: Record<string, string> = {
  srt: "application/x-subrip",
  vtt: "text/vtt",
  ass: "text/x-ssa",
  ssa: "text/x-ssa",
  sub: "text/plain",
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
  if (extension && extension in SUBTITLE) {
    return {
      kind: "subtitle",
      browserPlayable: false,
      mimeType: mimeType ?? SUBTITLE[extension],
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
  const { kind } = classifyPlayback(fileName, mimeType);
  return kind === "video" || kind === "audio";
}

/** Whether a file is a sidecar subtitle we can attach to a video as a track. */
export function isSubtitleFile(fileName: string, mimeType?: string | null): boolean {
  return classifyPlayback(fileName, mimeType).kind === "subtitle";
}

/** ISO 639-1/639-2 codes → human label, for subtitle filename language detection. */
const SUBTITLE_LANGUAGES: Record<string, { lang: string; label: string }> = {
  en: { lang: "en", label: "English" },
  eng: { lang: "en", label: "English" },
  english: { lang: "en", label: "English" },
  es: { lang: "es", label: "Spanish" },
  spa: { lang: "es", label: "Spanish" },
  spanish: { lang: "es", label: "Spanish" },
  fr: { lang: "fr", label: "French" },
  fre: { lang: "fr", label: "French" },
  fra: { lang: "fr", label: "French" },
  french: { lang: "fr", label: "French" },
  de: { lang: "de", label: "German" },
  ger: { lang: "de", label: "German" },
  deu: { lang: "de", label: "German" },
  german: { lang: "de", label: "German" },
  it: { lang: "it", label: "Italian" },
  ita: { lang: "it", label: "Italian" },
  italian: { lang: "it", label: "Italian" },
  pt: { lang: "pt", label: "Portuguese" },
  por: { lang: "pt", label: "Portuguese" },
  ru: { lang: "ru", label: "Russian" },
  rus: { lang: "ru", label: "Russian" },
  ja: { lang: "ja", label: "Japanese" },
  jpn: { lang: "ja", label: "Japanese" },
  zh: { lang: "zh", label: "Chinese" },
  chi: { lang: "zh", label: "Chinese" },
  zho: { lang: "zh", label: "Chinese" },
  ko: { lang: "ko", label: "Korean" },
  kor: { lang: "ko", label: "Korean" },
  ar: { lang: "ar", label: "Arabic" },
  ara: { lang: "ar", label: "Arabic" },
  nl: { lang: "nl", label: "Dutch" },
  dut: { lang: "nl", label: "Dutch" },
};

/**
 * Best-effort language guess for a subtitle filename. Looks at the dot- and
 * bracket-delimited tokens before the extension (e.g. `Movie.en.srt`,
 * `Movie.English.srt`, `Movie[eng].srt`). Falls back to the bare filename label
 * when no known language token is present.
 */
export function guessSubtitleLanguage(fileName: string): {
  lang: string | null;
  label: string;
} {
  const base = fileName.replace(/\.[a-z0-9]+\s*$/i, "");
  const tokens = base.toLowerCase().split(/[\s._\-[\]()]+/).filter(Boolean);
  for (const token of tokens.reverse()) {
    const match = SUBTITLE_LANGUAGES[token];
    if (match) {
      return match;
    }
  }
  return { lang: null, label: "Subtitles" };
}
