export type MediaItem = {
  id: string;
  title: string;
  size: string;
  seeds: number;
  age: string;
  indexer: string;
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
    debridState: "missing",
    saved: false,
    previewTone: "blue",
  },
];
