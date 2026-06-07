import "server-only";

import type { MyAnimeListAnime, MyAnimeListStatus } from "@/lib/myanimelist";

const API_BASE = "https://api.myanimelist.net/v2";
const OAUTH_BASE = "https://myanimelist.net/v1/oauth2";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type ViewerResponse = {
  id?: number;
  name?: string;
};

type AnimeListResponse = {
  data?: Array<{
    node?: {
      id?: number;
      title?: string;
      main_picture?: {
        medium?: string;
        large?: string;
      };
    };
    list_status?: {
      status?: MyAnimeListStatus;
      score?: number;
      num_episodes_watched?: number;
    };
  }>;
};

type AnimeDetailResponse = {
  id?: number;
  title?: string;
  synopsis?: string;
  mean?: number;
  num_episodes?: number;
  start_date?: string;
  main_picture?: {
    medium?: string;
    large?: string;
  };
};

export class MyAnimeListApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MyAnimeListApiError";
  }
}

export function buildMyAnimeListAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}) {
  const url = new URL(`${OAUTH_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function exchangeMyAnimeListCode(input: {
  clientId: string;
  clientSecret?: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  return requestToken({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    body: {
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    },
  });
}

export async function refreshMyAnimeListToken(input: {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}) {
  return requestToken({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    body: {
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    },
  });
}

async function requestToken(input: {
  clientId: string;
  clientSecret?: string;
  body: Record<string, string>;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    ...input.body,
  });
  if (input.clientSecret) {
    body.set("client_secret", input.clientSecret);
  }

  const response = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response
    .json()
    .catch(() => ({}))) as Partial<TokenResponse> & {
    error?: string;
    message?: string;
  };

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new MyAnimeListApiError(
      payload.message ?? payload.error ?? "MyAnimeList token request failed.",
      response.status,
    );
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_in: payload.expires_in ?? 3600,
  };
}

export class MyAnimeListClient {
  constructor(private readonly accessToken: string) {}

  async getViewer() {
    return this.get<ViewerResponse>("/users/@me");
  }

  async getAnimeList(
    status: MyAnimeListStatus,
    limit = 18,
  ): Promise<MyAnimeListAnime[]> {
    const params = new URLSearchParams({
      status,
      sort: "list_updated_at",
      limit: String(limit),
      fields: "list_status,main_picture",
    });
    const payload = await this.get<AnimeListResponse>(`/users/@me/animelist?${params}`);

    return (payload.data ?? [])
      .map((entry): MyAnimeListAnime | null => {
        const node = entry.node;
        if (!node?.id || !node.title) {
          return null;
        }

        return {
          id: node.id,
          title: node.title,
          picture: node.main_picture?.large ?? node.main_picture?.medium,
          url: `https://myanimelist.net/anime/${node.id}`,
          status,
          episodesWatched: entry.list_status?.num_episodes_watched,
          score: entry.list_status?.score,
        };
      })
      .filter((item): item is MyAnimeListAnime => item !== null);
  }

  async getAnime(id: number): Promise<MyAnimeListAnime | null> {
    const params = new URLSearchParams({
      fields: "id,title,synopsis,mean,num_episodes,start_date,main_picture",
    });
    const anime = await this.get<AnimeDetailResponse>(`/anime/${id}?${params}`);
    if (!anime.id || !anime.title) {
      return null;
    }

    return {
      id: anime.id,
      title: anime.title,
      synopsis: anime.synopsis,
      mean: anime.mean,
      episodes: anime.num_episodes,
      startDate: anime.start_date,
      picture: anime.main_picture?.large ?? anime.main_picture?.medium,
      url: `https://myanimelist.net/anime/${anime.id}`,
    };
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as T & {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new MyAnimeListApiError(
        payload.message ?? payload.error ?? "MyAnimeList API request failed.",
        response.status,
      );
    }

    return payload;
  }
}
