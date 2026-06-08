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

export function parseMangaCatalogSlug(slug: string): number | null {
  const id = slug.match(/^mal-(\d+)(?:-|$)/)?.[1];
  if (!id) {
    return null;
  }
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
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
