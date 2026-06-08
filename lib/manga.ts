import type { SearchResultDto } from "@/lib/search";

export type MangaCatalogItem = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  query: string;
  poster?: string;
  synopsis?: string;
  score?: number;
  chapters?: number;
  volumes?: number;
  url?: string;
};

export type MangaFileKind = "archive" | "pdf" | "image" | "unsupported";

export type MangaSourceGroup = {
  key: string;
  title: string;
  subtitle?: string;
  sort: number;
  results: SearchResultDto[];
};

export function parseMangaCatalogSlug(slug: string): number | null {
  const id = slug.match(/^mal-(\d+)(?:-|$)/)?.[1];
  if (!id) {
    return null;
  }
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

export function groupMangaSourceResults(
  results: SearchResultDto[],
): MangaSourceGroup[] {
  const groups = new Map<string, MangaSourceGroup>();

  for (const result of results) {
    const marker = parseMangaReleaseMarker(result.title);
    const group = groups.get(marker.key) ?? {
      key: marker.key,
      title: marker.title,
      subtitle: marker.subtitle,
      sort: marker.sort,
      results: [],
    };

    group.results.push(result);
    groups.set(marker.key, group);
  }

  return [...groups.values()].sort(
    (a, b) => a.sort - b.sort || a.title.localeCompare(b.title),
  );
}

export function classifyMangaFile(fileName: string): {
  kind: MangaFileKind;
  mimeType: string | null;
  extension: string | null;
} {
  const extension = fileName.match(/\.([a-z0-9]+)\s*$/i)?.[1]?.toLowerCase() ?? null;

  if (!extension) {
    return { kind: "unsupported", mimeType: null, extension };
  }
  if (extension === "cbz" || extension === "zip") {
    return { kind: "archive", mimeType: "application/zip", extension };
  }
  if (extension === "cbr" || extension === "rar") {
    return { kind: "archive", mimeType: "application/vnd.rar", extension };
  }
  if (extension === "pdf") {
    return { kind: "pdf", mimeType: "application/pdf", extension };
  }
  if (extension in MANGA_IMAGE_MIME_TYPES) {
    return {
      kind: "image",
      mimeType: MANGA_IMAGE_MIME_TYPES[extension],
      extension,
    };
  }

  return { kind: "unsupported", mimeType: null, extension };
}

export function isReadableMangaFile(fileName: string): boolean {
  return classifyMangaFile(fileName).kind !== "unsupported";
}

export function isMangaImageFile(fileName: string): boolean {
  return classifyMangaFile(fileName).kind === "image";
}

export const MANGA_IMAGE_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

function parseMangaReleaseMarker(title: string): {
  key: string;
  title: string;
  subtitle?: string;
  sort: number;
} {
  const volume = matchMangaNumber(
    title,
    /\b(?:vol(?:ume)?\.?|v)\s*0*(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*0*(\d+(?:\.\d+)?))?/i,
  );

  if (volume) {
    return {
      key: `volume:${volume.key}`,
      title: volume.label,
      subtitle: "Volume",
      sort: volume.value,
    };
  }

  const chapter = matchMangaNumber(
    title,
    /\b(?:ch(?:apter)?\.?|c)\s*0*(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*0*(\d+(?:\.\d+)?))?/i,
  );

  if (chapter) {
    return {
      key: `chapter:${chapter.key}`,
      title: chapter.label.replace("Volume", "Chapter"),
      subtitle: "Chapter",
      sort: 10000 + chapter.value,
    };
  }

  return {
    key: "unsorted",
    title: "Unsorted releases",
    subtitle: "No volume or chapter label found",
    sort: Number.MAX_SAFE_INTEGER,
  };
}

function matchMangaNumber(title: string, pattern: RegExp) {
  const match = title.match(pattern);
  if (!match) {
    return null;
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end))) {
    return null;
  }

  const key = end === null ? String(start) : `${start}-${end}`;
  const label =
    end === null
      ? `Volume ${formatMangaNumber(start)}`
      : `Volume ${formatMangaNumber(start)}-${formatMangaNumber(end)}`;

  return { key, label, value: start };
}

function formatMangaNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : String(value);
}
