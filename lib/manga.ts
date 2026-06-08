export type MangaCatalogItem = {
  slug: string;
  title: string;
  subtitle: string;
  query: string;
  poster?: string;
};

export type MangaFileKind = "archive" | "pdf" | "image" | "unsupported";

export const mangaCatalogItems: MangaCatalogItem[] = [
  {
    slug: "one-piece",
    title: "One Piece",
    subtitle: "Long-running pirate adventure",
    query: "One Piece manga",
    poster: "https://cdn.myanimelist.net/images/manga/2/253146l.jpg",
  },
  {
    slug: "chainsaw-man",
    title: "Chainsaw Man",
    subtitle: "Devils, hunters, sharp turns",
    query: "Chainsaw Man manga",
    poster: "https://cdn.myanimelist.net/images/manga/3/216464l.jpg",
  },
  {
    slug: "spy-x-family",
    title: "Spy x Family",
    subtitle: "Found family espionage comedy",
    query: "Spy x Family manga",
    poster: "https://cdn.myanimelist.net/images/manga/3/219741l.jpg",
  },
  {
    slug: "berserk",
    title: "Berserk",
    subtitle: "Dark fantasy classic",
    query: "Berserk manga",
    poster: "https://cdn.myanimelist.net/images/manga/1/157897l.jpg",
  },
  {
    slug: "vagabond",
    title: "Vagabond",
    subtitle: "Samurai epic",
    query: "Vagabond manga",
    poster: "https://cdn.myanimelist.net/images/manga/1/259070l.jpg",
  },
  {
    slug: "dandadan",
    title: "Dandadan",
    subtitle: "Occult action chaos",
    query: "Dandadan manga",
    poster: "https://cdn.myanimelist.net/images/manga/2/248746l.jpg",
  },
];

export function getMangaCatalogItem(slug: string): MangaCatalogItem | null {
  return mangaCatalogItems.find((item) => item.slug === slug) ?? null;
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
