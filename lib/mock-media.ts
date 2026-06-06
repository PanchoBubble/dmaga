export const mediaCategories = [
  { id: "all", label: "All" },
  { id: "movies", label: "Movies" },
  { id: "tv", label: "TV" },
  { id: "anime", label: "Anime" },
  { id: "manga", label: "Manga" },
  { id: "games", label: "Games" },
  { id: "music", label: "Music" },
] as const;

export type MediaCategory = (typeof mediaCategories)[number]["id"];
export type FilterableMediaCategory = Exclude<MediaCategory, "all">;

/**
 * The real categories a search can be narrowed to, minus the "all" sentinel.
 * Drives the checkbox list in the category filter modal; "all" is represented
 * implicitly by selecting everything (the `null` scope).
 */
export const filterableMediaCategories = mediaCategories.filter(
  (category) => category.id !== "all",
) as ReadonlyArray<{ id: FilterableMediaCategory; label: string }>;
