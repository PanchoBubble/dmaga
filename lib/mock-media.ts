export const mediaCategories = [
  { id: "all", label: "All" },
  { id: "movies", label: "Movies" },
  { id: "tv", label: "TV" },
  { id: "anime", label: "Anime" },
] as const;

export type MediaCategory = (typeof mediaCategories)[number]["id"];
export type FilterableMediaCategory = Exclude<MediaCategory, "all">;

export type MediaItem = {
  id: string;
  title: string;
  size: string;
  seeds: number;
  age: string;
  indexer: string;
  category: FilterableMediaCategory;
  labels: string[];
  debridState: "ready" | "missing";
  saved: boolean;
  previewTone: "green" | "blue";
};

export const mockMediaItems: MediaItem[] = [
  {
    id: "movie-2160p",
    title: "Example Movie 2160p WEB-DL",
    size: "18.4 GB",
    seeds: 284,
    age: "2h",
    indexer: "Torznab Demo",
    category: "movies",
    labels: ["Movie", "2160p", "WEB-DL"],
    debridState: "ready",
    saved: true,
    previewTone: "green",
  },
  {
    id: "series-s01",
    title: "Example Series S01 1080p",
    size: "42.1 GB",
    seeds: 119,
    age: "1d",
    indexer: "Private Demo",
    category: "tv",
    labels: ["TV", "Season Pack", "1080p"],
    debridState: "missing",
    saved: false,
    previewTone: "blue",
  },
  {
    id: "anime-simulcast",
    title: "Example Anime S02 1080p Multi-Subs",
    size: "12.7 GB",
    seeds: 86,
    age: "5h",
    indexer: "Anime Demo",
    category: "anime",
    labels: ["Anime", "Multi-Subs", "1080p"],
    debridState: "missing",
    saved: false,
    previewTone: "green",
  },
];
