export const mediaCategories = [
  { id: "all", label: "All" },
  { id: "movies", label: "Movies" },
  { id: "tv", label: "TV" },
  { id: "anime", label: "Anime" },
  { id: "games", label: "Games" },
] as const;

export type MediaCategory = (typeof mediaCategories)[number]["id"];
export type FilterableMediaCategory = Exclude<MediaCategory, "all">;
