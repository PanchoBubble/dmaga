export type MyAnimeListStatus =
  | "watching"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_watch";

export const myAnimeListStatuses = [
  { id: "watching", label: "Watching" },
  { id: "plan_to_watch", label: "Want to Watch" },
  { id: "completed", label: "Completed" },
  { id: "on_hold", label: "On Hold" },
  { id: "dropped", label: "Dropped" },
] as const satisfies Array<{ id: MyAnimeListStatus; label: string }>;

export type MyAnimeListAnime = {
  id: number;
  title: string;
  picture?: string;
  url: string;
  status?: MyAnimeListStatus;
  synopsis?: string;
  mean?: number;
  episodes?: number;
  startDate?: string;
  episodesWatched?: number;
  score?: number;
};

export type MyAnimeListAuthStatus =
  | { linked: false; configured: boolean }
  | {
      linked: true;
      configured: boolean;
      username?: string | null;
      accountId?: string | null;
      accessTokenExpiresAt?: string | null;
      lastAuthenticatedAt?: string | null;
      needsRefresh?: boolean;
    };
